// Seed per-location sp_pois rows for multi-location favorites.
//
// Context: favorites.ts declares multi-location restaurants (Bamboo Sushi,
// Hat Yai, etc.) but sp_pois typically holds ONE row per restaurant tagged
// to ONE neighborhood — so filtered searches miss the other branches. This
// script seeds the missing rows via Google Places API (New).
//
// Run: npx tsx --env-file=.env.local scripts/seed-favorite-locations.ts
//      → writes scripts/.seed-favorite-locations.preview.json
// Apply: npx tsx --env-file=.env.local scripts/seed-favorite-locations.ts --apply
//
// Address → neighborhood slug uses a conservative street heuristic. If the
// heuristic can't pick a known slug, the row is flagged for manual review
// and excluded from --apply.

import { Pool } from "pg";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { searchPlace, photoUrl } from "@/lib/pois/seed/google-places";
import { FAVORITES } from "@/lib/plan/favorites";

function findFavoriteByName(name: string) {
  return FAVORITES.find((f) => f.nameMatch === name);
}

// Fallback description when neither an existing sp_pois row nor a
// favorites.ts `note` provides one. Keeps sp_pois.description satisfied
// (NOT NULL). Can be upgraded later via pass-3 AI tagging.
function buildFallbackDescription(
  favoriteName: string,
  category: string,
  note: string | undefined
): string {
  if (note && note.trim().length > 0) return note;
  return `${favoriteName} — ${category} in Portland, Oregon.`;
}

type Target = {
  // Must match an entry in favorites.ts (normalized name matching handles variants)
  favoriteName: string;
  // What to query Google Places for. Be specific.
  query: string;
  // Friendly name to tag in sp_pois (e.g. "Bamboo Sushi (NW 23rd)"). Falls
  // back to the Places displayName if empty.
  displayName?: string;
  // Expected category slug (copied to sp_pois.category). Match existing values.
  category: string;
  // Expected neighborhood slug (must be in the sp_pois vocabulary below).
  neighborhood: string;
};

// Sensible defaults for no-template inserts, so filter searches
// (tags/time_slots/party_types) still surface these rows. All these locations
// are on the favorites list, which means Hayden has personally vouched for
// them — `local_legend` is appropriate. Metadata matches the dominant
// profile of existing sp_pois rows in the same category.
const CATEGORY_DEFAULTS: Record<
  string,
  {
    tags: string[];
    time_slots: string[];
    party_types: string[];
    price_level: number | null;
  }
> = {
  restaurant: {
    tags: ["mid_range", "indoor", "walkable_from_transit", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "solo"],
    price_level: 2,
  },
  coffee: {
    tags: ["mid_range", "indoor", "walkable_from_transit", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["solo", "friends", "couple"],
    price_level: 1,
  },
  bar: {
    tags: [
      "mid_range",
      "indoor",
      "walkable_from_transit",
      "local_legend",
      "group_friendly",
    ],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple", "solo"],
    price_level: 2,
  },
  activity: {
    tags: ["local_legend", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["friends", "couple", "family", "solo"],
    price_level: 2,
  },
  viewpoint: {
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  shop: {
    tags: ["indoor", "walkable_from_transit", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 2,
  },
};

const VALID_SLUGS = [
  "alberta",
  "astoria",
  "buckman",
  "cannon_beach",
  "carlton",
  "columbia_gorge",
  "division",
  "downtown",
  "dundee",
  "hawthorne",
  "hollywood",
  "hood_river",
  "kerns",
  "lloyd",
  "mcminnville",
  "mt_hood",
  "mt_tabor",
  "nob_hill",
  "north_portland",
  "northwest",
  "other",
  "pearl",
  "richmond",
  "se_industrial",
  "seaside",
  "sellwood",
  "st_johns",
  "tillamook",
  "turner",
  "woodstock",
];

// Target list, grouped by favorite. Each entry declares the specific branch
// to seed. Existing rows (pre-seeded in sp_pois) are NOT re-queried.
const TARGETS: Target[] = [
  // Por Qué No — 0 existing rows, 2 branches
  {
    favoriteName: "Por Qué No",
    query: "Por Qué No Taqueria 3524 N Mississippi Ave Portland OR",
    displayName: "Por Qué No (Mississippi)",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Por Qué No",
    query: "Por Qué No Taqueria 4635 SE Hawthorne Blvd Portland OR",
    displayName: "Por Qué No (Hawthorne)",
    category: "restaurant",
    neighborhood: "hawthorne",
  },

  // Coava — 1 existing row (Buckman/Grand). Three Portland cafés, all
  // east-side: SE Grand (existing), SE Main (Public Brew Bar), SE Hawthorne.
  // Favorite's "Northwest" declaration was wrong — no Coava NW location.
  {
    favoriteName: "Coava",
    query: "Coava Coffee Public Brew Bar 1015 SE Main St Portland OR",
    displayName: "Coava Public Brew Bar",
    category: "coffee",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Coava",
    query: "Coava Coffee Roasters 2631 SE Hawthorne Blvd Portland OR",
    displayName: "Coava (Hawthorne)",
    category: "coffee",
    neighborhood: "hawthorne",
  },

  // Bamboo Sushi — 1 existing row (SW 12th, tagged nob_hill — data bug but
  // we'll leave it). Missing: Alberta, NW 23rd, SE 28th (Kerns)
  {
    favoriteName: "Bamboo Sushi",
    query: "Bamboo Sushi 1409 NE Alberta St Portland OR",
    displayName: "Bamboo Sushi (Alberta)",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Bamboo Sushi",
    query: "Bamboo Sushi 836 NW 23rd Ave Portland OR",
    displayName: "Bamboo Sushi (NW 23rd)",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Bamboo Sushi",
    query: "Bamboo Sushi 310 SE 28th Ave Portland OR",
    displayName: "Bamboo Sushi (SE 28th)",
    category: "restaurant",
    neighborhood: "kerns",
  },

  // Fire on the Mountain — 0 existing rows, 3 branches
  {
    favoriteName: "Fire on the Mountain",
    query: "Fire on the Mountain 1708 E Burnside St Portland OR",
    displayName: "Fire on the Mountain (E Burnside)",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Fire on the Mountain",
    query: "Fire on the Mountain 4225 N Interstate Ave Portland OR",
    displayName: "Fire on the Mountain (N Interstate)",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Fire on the Mountain",
    query: "Fire on the Mountain 3443 NE 57th Ave Portland OR",
    displayName: "Fire on the Mountain (NE Fremont)",
    category: "restaurant",
    neighborhood: "alberta",
  },

  // PDX Sliders — 1 existing row (Sellwood). Missing: Division, N Williams
  {
    favoriteName: "PDX Sliders",
    query: "PDX Sliders 3004 SE Division St Portland OR",
    displayName: "PDX Sliders (Division)",
    category: "restaurant",
    neighborhood: "division",
  },
  {
    favoriteName: "PDX Sliders",
    query: "PDX Sliders 3350 N Williams Ave Portland OR",
    displayName: "PDX Sliders (Williams)",
    category: "restaurant",
    neighborhood: "north_portland",
  },

  // Screen Door — 1 existing row (Eastside/E Burnside). Missing: Pearl
  {
    favoriteName: "Screen Door",
    query: "Screen Door Pearl 1101 NW Couch St Portland OR",
    displayName: "Screen Door (Pearl)",
    category: "restaurant",
    neighborhood: "pearl",
  },

  // Fried Egg I'm in Love — 0 existing rows, 3 branches
  {
    favoriteName: "Fried Egg I'm in Love",
    query: "Fried Egg I'm in Love 801 SW Broadway Portland OR",
    displayName: "Fried Egg I'm in Love (Downtown)",
    category: "restaurant",
    neighborhood: "downtown",
  },
  {
    favoriteName: "Fried Egg I'm in Love",
    query: "Fried Egg I'm in Love 3549 SE Hawthorne Blvd Portland OR",
    displayName: "Fried Egg I'm in Love (Hawthorne)",
    category: "restaurant",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Fried Egg I'm in Love",
    query: "Fried Egg I'm in Love 3818 N Mississippi Ave Portland OR",
    displayName: "Fried Egg I'm in Love (Mississippi)",
    category: "restaurant",
    neighborhood: "north_portland",
  },

  // Matt's BBQ Tacos — 1 existing row (Division/Hinterland). Missing: Alberta/Great Notion
  {
    favoriteName: "Matt's BBQ Tacos",
    query:
      "Matt's BBQ Tacos Great Notion Alberta 2204 NE Alberta St Portland OR",
    displayName: "Matt's BBQ Tacos (Alberta)",
    category: "restaurant",
    neighborhood: "alberta",
  },

  // Good Coffee — 0 existing rows, 3 branches
  {
    favoriteName: "Good Coffee",
    query: "Good Coffee 1659 NW Raleigh St Portland OR",
    displayName: "Good Coffee (Slabtown)",
    category: "coffee",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Good Coffee",
    query: "Good Coffee 4325 SE Division St Portland OR",
    displayName: "Good Coffee (Division)",
    category: "coffee",
    neighborhood: "division",
  },
  {
    favoriteName: "Good Coffee",
    query: "Good Coffee 1784 SE 12th Ave Portland OR",
    displayName: "Good Coffee (SE 12th)",
    category: "coffee",
    neighborhood: "buckman",
  },

  // Barista — 1 existing row (NW 23rd). Missing: Pearl flagship, Alberta, Downtown
  {
    favoriteName: "Barista",
    query: "Barista coffee 539 NW 13th Ave Portland OR",
    displayName: "Barista (Pearl)",
    category: "coffee",
    neighborhood: "pearl",
  },
  {
    favoriteName: "Barista",
    query: "Barista coffee 1725 NE Alberta St Portland OR",
    displayName: "Barista (Alberta)",
    category: "coffee",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Barista",
    query: "Barista coffee 529 SW Third Ave Portland OR",
    displayName: "Barista (Downtown Hamilton)",
    category: "coffee",
    neighborhood: "downtown",
  },

  // Hat Yai — 0 existing rows, 2 branches
  {
    favoriteName: "Hat Yai",
    query: "Hat Yai 1605 NE Killingsworth St Portland OR",
    displayName: "Hat Yai (Killingsworth)",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Hat Yai",
    query: "Hat Yai 3526 SE Belmont St Portland OR",
    displayName: "Hat Yai (Belmont)",
    category: "restaurant",
    neighborhood: "buckman",
  },

  // Life of Pie — 0 existing rows, 2 branches
  {
    favoriteName: "Life of Pie",
    query: "Life of Pie Pizza 3632 N Williams Ave Portland OR",
    displayName: "Life of Pie (Williams)",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Life of Pie",
    query: "Life of Pie Pizza 1765 NW 23rd Ave Portland OR",
    displayName: "Life of Pie (NW 23rd)",
    category: "restaurant",
    neighborhood: "nob_hill",
  },

  // Papa Haydn — 1 existing row (NW 23rd). Missing: Sellwood
  {
    favoriteName: "Papa Haydn",
    query: "Papa Haydn 5829 SE Milwaukie Ave Portland OR",
    displayName: "Papa Haydn (Sellwood)",
    category: "restaurant",
    neighborhood: "sellwood",
  },

  // Breakside — 1 existing row (Slabtown). Missing: Woodlawn/Dekum flagship
  {
    favoriteName: "Breakside",
    query: "Breakside Brewery 820 NE Dekum St Portland OR",
    displayName: "Breakside Brewery (Dekum)",
    category: "bar",
    neighborhood: "alberta",
  },

  // Matador — 0 existing rows, 3 branches (disambiguated via Places lookups
  // on 2026-04-22: NW 23rd at 1438, E Burnside at 2424, N Williams at 4111).
  {
    favoriteName: "Matador",
    query: "Matador NW Portland 1438 NW 23rd Ave",
    displayName: "Matador (NW 23rd)",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Matador",
    query: "Matador East Portland 2424 E Burnside",
    displayName: "Matador (E Burnside)",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Matador",
    query: "Matador North Portland 4111 N Williams Ave",
    displayName: "Matador (N Williams)",
    category: "restaurant",
    neighborhood: "north_portland",
  },

  // Casa Italia — single location. The favorite's "Division" + "Richmond"
  // entries are two neighborhood names for the same physical spot on SE
  // Division in Richmond. Seed one row and use `division` slug.
  {
    favoriteName: "Casa Italia",
    query: "Casa Italia 3035 SE Division St Portland OR",
    displayName: "Casa Italia",
    category: "restaurant",
    neighborhood: "division",
  },

  // Killer Burger — Portland locations (ignoring Moda Center + Providence
  // Park stadium concessions and suburban outposts).
  {
    favoriteName: "Killer Burger",
    query: "Killer Burger 4644 NE Sandy Blvd Portland OR",
    displayName: "Killer Burger (Hollywood)",
    category: "restaurant",
    neighborhood: "hollywood",
  },
  {
    favoriteName: "Killer Burger",
    query: "Killer Burger 510 SW 3rd Ave Portland OR",
    displayName: "Killer Burger (Downtown)",
    category: "restaurant",
    neighborhood: "downtown",
  },
  {
    favoriteName: "Killer Burger",
    query: "Killer Burger 8728 SE 17th Ave Portland OR",
    displayName: "Killer Burger (Sellwood)",
    category: "restaurant",
    neighborhood: "sellwood",
  },

  // === 2026-04-22 batch 3: seed 34 dead-letter favorites ===
  // These favorites exist in favorites.ts but had zero active sp_pois rows,
  // so the agent couldn't surface them even with the ranking boost. Addresses
  // verified via Google Places lookups before adding.
  {
    favoriteName: "Stepping Stone",
    query: "Stepping Stone Cafe 2390 NW Quimby St Portland OR",
    displayName: "Stepping Stone Cafe",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Bernstein",
    query: "Bernstein's Bagels 816 N Russell St Portland OR",
    displayName: "Bernstein's Bagels",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Baker's Mark",
    query: "Baker's Mark 1126 SE Division St Portland OR",
    displayName: "The Baker's Mark (Division)",
    category: "restaurant",
    neighborhood: "division",
  },
  {
    favoriteName: "Baker's Mark",
    query: "Baker's Mark 301 NW 10th Ave Portland OR",
    displayName: "The Baker's Mark (Pearl)",
    category: "restaurant",
    neighborhood: "pearl",
  },
  {
    favoriteName: "De Ponte",
    query: "De Ponte Cellars 17545 NE Archery Summit Rd Dayton OR",
    displayName: "De Ponte Cellars",
    category: "activity",
    neighborhood: "dundee",
  },
  {
    favoriteName: "Han Oak",
    query: "Han Oak Korean 511 NE 24th Ave Portland OR",
    displayName: "Han Oak",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Kachka",
    query: "Kachka Russian 960 SE 11th Ave Portland OR",
    displayName: "Kachka",
    category: "restaurant",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Luce",
    query: "Luce Italian 2138 E Burnside St Portland OR",
    displayName: "Luce",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Nostrana",
    query: "Nostrana 1401 SE Morrison St Portland OR",
    displayName: "Nostrana",
    category: "restaurant",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Ringside",
    query: "Ringside Steakhouse 2165 W Burnside St Portland OR",
    displayName: "RingSide Steakhouse",
    category: "restaurant",
    neighborhood: "northwest",
  },
  {
    favoriteName: "Phuket Cafe",
    query: "Phuket Cafe 1818 NW 23rd Pl Portland OR",
    displayName: "Phuket Cafe",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Cafe Rowan",
    query: "Cafe Rowan brunch Portland OR",
    displayName: "Cafe Rowan",
    category: "restaurant",
    neighborhood: "other",
  },
  {
    favoriteName: "Gabbiano's",
    query: "Gabbiano's Italian Concordia Portland OR",
    displayName: "Gabbiano's",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Tov Coffee",
    query: "Tov Coffee Egyptian double decker bus Portland OR",
    displayName: "Tov Coffee",
    category: "coffee",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Daawat A Ishq",
    query: "Daawat A Ishq 5427 NE 42nd Ave Portland OR",
    displayName: "Daawat A Ishq",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Dolly Olive",
    query: "Dolly Olive 527 SW 12th Ave Portland OR",
    displayName: "Dolly Olive",
    category: "restaurant",
    neighborhood: "downtown",
  },
  {
    favoriteName: "Bluto's",
    query: "Bluto's Greek 3610 SE Belmont St Portland OR",
    displayName: "Bluto's",
    category: "restaurant",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Rose City Coffee",
    query: "Rose City Coffee 5202 SE Milwaukie Ave Portland OR",
    displayName: "Rose City Coffee",
    category: "coffee",
    neighborhood: "sellwood",
  },
  {
    favoriteName: "Rimsky-Korsakoffee",
    query: "Rimsky-Korsakoffee 707 SE 12th Ave Portland OR",
    displayName: "Rimsky-Korsakoffee House",
    category: "restaurant",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Pinolo Gelato",
    query: "Pinolo Gelato 3707 SE Division St Portland OR",
    displayName: "Pinolo Gelato",
    category: "coffee",
    neighborhood: "richmond",
  },
  {
    favoriteName: "Maruti",
    query: "Maruti Indian 3808 SE Hawthorne Blvd Portland OR",
    displayName: "Maruti",
    category: "restaurant",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "TwentySix Cafe",
    query: "TwentySix Cafe 2601 NE 7th Ave Portland OR",
    displayName: "TwentySix Cafe",
    category: "coffee",
    neighborhood: "lloyd",
  },
  {
    favoriteName: "Big's Chicken",
    query: "Big's Chicken 4606 NE Glisan St Portland OR",
    displayName: "Big's Chicken",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Spitz",
    query: "Spitz Mediterranean 2103 N Killingsworth St Portland OR",
    displayName: "Spitz",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Ken's Artisan Pizza",
    query: "Ken's Artisan Pizza 304 SE 28th Ave Portland OR",
    displayName: "Ken's Artisan Pizza",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Cheese & Crack",
    query: "Cheese and Crack 22 SE 28th Ave Portland OR",
    displayName: "Cheese & Crack",
    category: "restaurant",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Noho's",
    query: "Noho's Hawaiian Cafe 4627 NE Fremont St Portland OR",
    displayName: "Noho's Hawaiian Cafe",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "The 1905",
    query: "The 1905 jazz club 830 N Shaver St Portland OR",
    displayName: "The 1905",
    category: "bar",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Jam on Hawthorne",
    query: "Jam on Hawthorne 2239 SE Hawthorne Blvd Portland OR",
    displayName: "Jam on Hawthorne",
    category: "restaurant",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Tamale Boy",
    query: "Tamale Boy 1764 NE Dekum St Portland OR",
    displayName: "Tamale Boy (Dekum)",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Tamale Boy",
    query: "Tamale Boy N Russell Portland OR",
    displayName: "Tamale Boy (Russell)",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Trail Blazers",
    query: "Moda Center 1 N Center Court St Portland OR",
    displayName: "Moda Center (Trail Blazers)",
    category: "activity",
    neighborhood: "lloyd",
  },
  {
    favoriteName: "Portland Timbers",
    query: "Providence Park 1844 SW Morrison St Portland OR",
    displayName: "Portland Timbers (Providence Park)",
    category: "activity",
    neighborhood: "downtown",
  },
  {
    favoriteName: "Alloro",
    query: "Alloro Vineyard 22185 SW Lebeau Rd Sherwood OR",
    displayName: "Alloro Vineyard",
    category: "activity",
    neighborhood: "other",
  },
  {
    favoriteName: "Bible Club",
    query: "Bible Club PDX 6716 SE 16th Ave Portland OR",
    displayName: "Bible Club",
    category: "bar",
    neighborhood: "sellwood",
  },
  {
    favoriteName: "Focacceria",
    query: "Focacceria Montelupo 1613 SE Bybee Blvd Portland OR",
    displayName: "The Focacceria by Montelupo",
    category: "restaurant",
    neighborhood: "sellwood",
  },
  {
    favoriteName: "Holy Ghost",
    query: "Holy Ghost cocktail bar 4107 SE 28th Ave Portland OR",
    displayName: "Holy Ghost",
    category: "bar",
    neighborhood: "other",
  },

  // === 2026-04-22 batch 5: catch-up for the rest of today's favorites ===
  // Mississippi Studios + Prost are in the Boise/Mississippi corridor — north_portland slug.
  // Voodoo NE Davis is closest to Kerns (NE 15th & Davis).
  // Andina is Pearl District.
  {
    favoriteName: "Mississippi Studios",
    query: "Mississippi Studios 3939 N Mississippi Ave Portland OR",
    displayName: "Mississippi Studios",
    category: "bar",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Prost",
    query: "Prost German bier hall 4237 N Mississippi Ave Portland OR",
    displayName: "Prost",
    category: "bar",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Andina",
    query: "Andina Peruvian 1314 NW Glisan St Portland OR",
    displayName: "Andina",
    category: "restaurant",
    neighborhood: "pearl",
  },
  {
    favoriteName: "Voodoo Doughnut",
    query: "Voodoo Doughnut 1501 NE Davis St Portland OR",
    displayName: "Voodoo Doughnut (NE Davis)",
    category: "restaurant",
    neighborhood: "kerns",
  },

  // === 2026-04-22 batch 6: Twisted Croissant + Cedo's Falafel ===
  // Twisted Croissant: two Portland locations — Irvington (NE Broadway, lloyd
  // is the closest slug for inner NE near MLK) and Sellwood-Moreland (SE Bybee).
  // Cedo's: one location at 3901 NE MLK in King neighborhood — north_portland
  // slug fits since N/NE MLK is on the dividing line.
  {
    favoriteName: "Twisted Croissant",
    query: "Twisted Croissant 2129 NE Broadway St Portland OR",
    displayName: "Twisted Croissant (Broadway)",
    category: "restaurant",
    neighborhood: "lloyd",
  },
  {
    favoriteName: "Twisted Croissant",
    query: "Twisted Croissant 1625 SE Bybee Blvd Portland OR",
    displayName: "Twisted Croissant (Sellwood)",
    category: "restaurant",
    neighborhood: "sellwood",
  },
  {
    favoriteName: "Cedo's Falafel",
    query:
      "Cedo's Falafel and Gyros 3901 NE Martin Luther King Jr Blvd Portland OR",
    displayName: "Cedo's Falafel and Gyros",
    category: "restaurant",
    neighborhood: "north_portland",
  },

  // === 2026-04-22 batch 7: Cafe Olli ===
  // One location at 3925 NE MLK (King neighborhood) — same block as Cedo's;
  // reuse the north_portland slug pattern for NE MLK.
  {
    favoriteName: "Cafe Olli",
    query: "Cafe Olli 3925 NE Martin Luther King Jr Blvd Portland OR",
    displayName: "Cafe Olli",
    category: "restaurant",
    neighborhood: "north_portland",
  },

  // === 2026-04-23 batch 8: shops + theaters + cocktail bars + multi-location pasta/pizza ===
  // Scottie's NW 21st covers the Northwest District; SE Division already exists.
  // Ranch Pizza: both Portland locations (SE 11th Piehall + NE Dekum/Woodlawn).
  // Aalto + Nate's are next-door on SE Belmont (33xx, east of 20th) — hawthorne slug is the adjacent geographic fit.
  // Urbanite sits at SE Grand/Yamhill — buckman slug per the SE-Belmont-near-8th-20th heuristic.
  // Tulip Shop Tavern at 825 N Killingsworth is Humboldt — north_portland.
  // Paymaster Lounge at 1020 NW 17th is Slabtown-adjacent Alphabet District — northwest.
  // Too Soon at 18 NE 28th is Kerns.
  // Laurelhurst Theater at 2735 E Burnside at NE 28th — kerns.
  // McMenamins Back Stage Bar + Greater Trumps are the Bagdad Theater complex on SE Hawthorne (36xx-37xx) — hawthorne.
  // Grassa has 3 Portland locations worth surfacing (skip the airport satellite).
  {
    favoriteName: "Scottie's",
    query: "Scottie's Pizza Parlor 685 NW 21st Ave Portland OR",
    displayName: "Scottie's Pizza Parlor (NW 21st)",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Ranch Pizza",
    query: "Ranch Pizza 2239 SE 11th Ave Portland OR",
    displayName: "Ranch Pizza (SE 11th)",
    category: "restaurant",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Ranch Pizza",
    query: "Ranch Pizza 1760 NE Dekum St Portland OR",
    displayName: "Ranch Pizza (Woodlawn)",
    category: "restaurant",
    neighborhood: "alberta",
  },
  {
    favoriteName: "Aalto",
    query: "Aalto Lounge 3356 SE Belmont St Portland OR",
    displayName: "Aalto Lounge",
    category: "bar",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Nate's Oatmeal Cookies",
    query: "Nate's Oatmeal Cookies 3308 SE Belmont St Portland OR",
    displayName: "Nate's Oatmeal Cookies",
    category: "restaurant",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Urbanite",
    query: "Urbanite 1005 SE Grand Ave Portland OR",
    displayName: "Urbanite",
    category: "activity",
    neighborhood: "buckman",
  },
  {
    favoriteName: "Tulip Shop Tavern",
    query: "Tulip Shop Tavern 825 N Killingsworth St Portland OR",
    displayName: "Tulip Shop Tavern",
    category: "restaurant",
    neighborhood: "north_portland",
  },
  {
    favoriteName: "Paymaster",
    query: "Paymaster Lounge 1020 NW 17th Ave Portland OR",
    displayName: "Paymaster Lounge",
    category: "bar",
    neighborhood: "northwest",
  },
  {
    favoriteName: "Too Soon",
    query: "Too Soon 18 NE 28th Ave Portland OR",
    displayName: "Too Soon",
    category: "bar",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Laurelhurst Theater",
    query: "Laurelhurst Theater 2735 E Burnside St Portland OR",
    displayName: "Laurelhurst Theater",
    category: "activity",
    neighborhood: "kerns",
  },
  {
    favoriteName: "Back Stage Bar",
    query: "McMenamins Back Stage Bar 3702 SE Hawthorne Blvd Portland OR",
    displayName: "McMenamins Back Stage Bar",
    category: "bar",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Greater Trumps",
    query: "McMenamins Greater Trumps 1520 SE 37th Ave Portland OR",
    displayName: "McMenamins Greater Trumps",
    category: "bar",
    neighborhood: "hawthorne",
  },
  {
    favoriteName: "Grassa",
    query: "Grassa 1205 SW Washington St Portland OR",
    displayName: "Grassa (Downtown)",
    category: "restaurant",
    neighborhood: "downtown",
  },
  {
    favoriteName: "Grassa",
    query: "Grassa 1506 NW 23rd Ave Portland OR",
    displayName: "Grassa (NW 23rd)",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Grassa",
    query: "Grassa 1375 SE Hawthorne Blvd Portland OR",
    displayName: "Grassa (Hawthorne)",
    category: "restaurant",
    neighborhood: "hawthorne",
  },

  // === 2026-04-23 batch 9: Salt & Straw NW 23rd (missing branch), Afuri Slabtown, Hale Pele, Kann ===
  // Salt & Straw has Alberta + Division seeded; NW 23rd (838 NW 23rd) was missing.
  // Afuri Izakaya SE already exists; Slabtown (1620 NW 21st) is the Northwest District counterpart.
  // Hale Pele at 2733 NE Broadway is Sullivan's Gulch / Irvington — lloyd slug is the nearest fit (same pattern as TwentySix Cafe + Twisted Croissant Broadway).
  // Kann at 548 SE Ash St is Buckman / Central Eastside.
  {
    favoriteName: "Salt & Straw",
    query: "Salt & Straw 838 NW 23rd Ave Portland OR",
    displayName: "Salt & Straw (NW 23rd)",
    category: "coffee",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Afuri",
    query: "AFURI Slabtown 1620 NW 21st Ave Portland OR",
    displayName: "AFURI Slabtown",
    category: "restaurant",
    neighborhood: "nob_hill",
  },
  {
    favoriteName: "Hale Pele",
    query: "Hale Pele tiki bar 2733 NE Broadway Portland OR",
    displayName: "Hale Pele",
    category: "bar",
    neighborhood: "lloyd",
  },
  {
    favoriteName: "Kann",
    query: "Kann Haitian 548 SE Ash St Portland OR",
    displayName: "Kann",
    category: "restaurant",
    neighborhood: "buckman",
  },

  // === 2026-04-23 batch 10: Hayden-personal day trips — Pacific City + Gearhart ===
  // Pacific City is in Tillamook County — tillamook is the closest valid coast slug.
  // Gearhart is immediately adjacent to Seaside on the North Coast — seaside slug.
  // Pelican Brewing seeded as 'restaurant' (brewpub with full kitchen); Gearhart Golf as 'activity' (no golf category).
  {
    favoriteName: "Pelican Brewing",
    query: "Pelican Brewing 33180 Cape Kiwanda Dr Pacific City OR",
    displayName: "Pelican Brewing (Pacific City)",
    category: "restaurant",
    neighborhood: "tillamook",
  },
  {
    favoriteName: "Cape Kiwanda",
    query: "Cape Kiwanda State Natural Area Pacific City OR",
    displayName: "Cape Kiwanda",
    category: "viewpoint",
    neighborhood: "tillamook",
  },
  {
    favoriteName: "Gearhart Golf",
    query: "Gearhart Golf Links Gearhart OR",
    displayName: "Gearhart Golf Links",
    category: "activity",
    neighborhood: "seaside",
  },

  // === 2026-04-23 batch 11: Portland Gear — Portland-branded apparel ===
  // Flagship at 403 SW 10th Ave (downtown, corner of Harvey Milk next to Ace
  // Hotel). Other locations (Washington Square, Bridgeport Village, PDX) are
  // suburban mall / airport — not in Portland-neighborhood slugs and not
  // realistic tourist-itinerary stops from SP rentals, so only seeding the
  // downtown flagship.
  {
    favoriteName: "Portland Gear",
    query: "Portland Gear 403 SW 10th Ave Portland OR",
    displayName: "Portland Gear (Downtown)",
    category: "shop",
    neighborhood: "downtown",
  },
];

function slugId(name: string, neighborhood: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${neighborhood}`;
}

// Copy category + tags + time_slots + party_types + price_level from an
// existing sp_pois row with the same favoriteName (if any). Keeps the
// cross-location metadata consistent.
async function getTemplateRow(pool: Pool, favoriteName: string) {
  const norm = favoriteName
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = norm.split(" ").filter(Boolean);
  const whereParts = tokens
    .map((_, i) => `LOWER(name) LIKE $${i + 1}`)
    .join(" AND ");
  const values = tokens.map((t) => `%${t}%`);
  const r = await pool.query(
    `SELECT category, tags, time_slots, party_types, price_level, description
     FROM sp_pois WHERE status='active' AND ${whereParts}
     ORDER BY name LIMIT 1`,
    values
  );
  return r.rows[0] ?? null;
}

type PreviewRow = {
  target: Target;
  placeId: string | null;
  resolvedName: string | null;
  resolvedAddress: string | null;
  lat: number | null;
  lng: number | null;
  photoName: string | null;
  template: {
    category: string | null;
    tags: string[] | null;
    time_slots: string[] | null;
    party_types: string[] | null;
    price_level: number | null;
    description: string | null;
  };
  plannedInsert: Record<string, unknown> | null;
  error: string | null;
};

(async () => {
  const apply = process.argv.includes("--apply");
  const previewPath = "scripts/.seed-favorite-locations.preview.json";

  if (apply) {
    if (!existsSync(previewPath)) {
      console.error(`Missing ${previewPath} — run without --apply first.`);
      process.exit(1);
    }
    const preview = JSON.parse(
      readFileSync(previewPath, "utf-8")
    ) as PreviewRow[];
    const applicable = preview.filter(
      (p) => p.plannedInsert && VALID_SLUGS.includes(p.target.neighborhood)
    );
    console.log(`Applying ${applicable.length} inserts...`);
    const pool = new Pool({
      connectionString: process.env.SHARED_DATABASE_URL,
    });
    let ok = 0,
      skipped = 0,
      failed = 0;
    for (const row of applicable) {
      const ins = row.plannedInsert!;
      try {
        const existsRes = await pool.query(
          `SELECT 1 FROM sp_pois WHERE id = $1`,
          [ins.id]
        );
        if (existsRes.rowCount && existsRes.rowCount > 0) {
          console.log(`  skip (exists): ${ins.id}`);
          skipped++;
          continue;
        }
        await pool.query(
          `INSERT INTO sp_pois
             (id, name, category, neighborhood, description, address, lat, lng,
              tags, time_slots, party_types, price_level, photo_url, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')`,
          [
            ins.id,
            ins.name,
            ins.category,
            ins.neighborhood,
            ins.description,
            ins.address,
            ins.lat,
            ins.lng,
            ins.tags,
            ins.time_slots,
            ins.party_types,
            ins.price_level,
            ins.photo_url,
          ]
        );
        console.log(`  ok: ${ins.id} (${ins.neighborhood})`);
        ok++;
      } catch (e) {
        console.error(`  FAIL: ${ins.id} — ${(e as Error).message}`);
        failed++;
      }
    }
    await pool.end();
    console.log(`\nDone. ok=${ok} skipped=${skipped} failed=${failed}`);
    return;
  }

  // Preview path
  const pool = new Pool({ connectionString: process.env.SHARED_DATABASE_URL });
  const preview: PreviewRow[] = [];

  // Idempotency: skip targets whose planned id already exists in sp_pois
  // (saves Google Places API calls on re-runs after partial applies).
  const plannedIds = TARGETS.map((t) => {
    const name = t.displayName ?? t.favoriteName;
    return slugId(name, t.neighborhood);
  });
  const existsRes = await pool.query(
    `SELECT id FROM sp_pois WHERE id = ANY($1)`,
    [plannedIds]
  );
  const alreadyThere = new Set<string>(existsRes.rows.map((r: any) => r.id));

  for (const t of TARGETS) {
    const plannedId = slugId(t.displayName ?? t.favoriteName, t.neighborhood);
    if (alreadyThere.has(plannedId)) {
      console.log(`${t.favoriteName} → ${t.displayName} (exists, skip)`);
      continue;
    }
    process.stdout.write(`${t.favoriteName} → ${t.displayName ?? t.query}... `);
    const row: PreviewRow = {
      target: t,
      placeId: null,
      resolvedName: null,
      resolvedAddress: null,
      lat: null,
      lng: null,
      photoName: null,
      template: {
        category: null,
        tags: null,
        time_slots: null,
        party_types: null,
        price_level: null,
        description: null,
      },
      plannedInsert: null,
      error: null,
    };

    try {
      const place = await searchPlace(t.query);
      if (!place) {
        row.error = "Places API returned no result";
        console.log("NO RESULT");
        preview.push(row);
        continue;
      }
      if (place.businessStatus === "CLOSED_PERMANENTLY") {
        row.error = `CLOSED_PERMANENTLY (${place.formattedAddress})`;
        console.log(`CLOSED_PERMANENTLY — skipping`);
        preview.push(row);
        continue;
      }
      if (place.businessStatus === "CLOSED_TEMPORARILY") {
        console.log(
          `  ⚠ CLOSED_TEMPORARILY — will still seed; verify before --apply`
        );
      }
      row.placeId = place.id;
      row.resolvedName = place.displayName?.text ?? null;
      row.resolvedAddress = place.formattedAddress;
      row.lat = place.location.latitude;
      row.lng = place.location.longitude;
      row.photoName = place.photos?.[0]?.name ?? null;

      const template = await getTemplateRow(pool, t.favoriteName);
      if (template) {
        row.template = {
          category: template.category,
          tags: template.tags,
          time_slots: template.time_slots,
          party_types: template.party_types,
          price_level: template.price_level,
          description: template.description,
        };
      }

      if (!VALID_SLUGS.includes(t.neighborhood)) {
        row.error = `invalid neighborhood slug: ${t.neighborhood}`;
        console.log(`BAD SLUG ${t.neighborhood}`);
        preview.push(row);
        continue;
      }

      const name = t.displayName ?? place.displayName?.text ?? t.favoriteName;
      const resolvedCategory = t.category || template?.category || "restaurant";
      const defaults =
        CATEGORY_DEFAULTS[resolvedCategory] ?? CATEGORY_DEFAULTS.restaurant;
      const favEntry = findFavoriteByName(t.favoriteName);
      const description =
        template?.description ??
        buildFallbackDescription(
          t.favoriteName,
          resolvedCategory,
          favEntry?.note
        );
      row.plannedInsert = {
        id: slugId(name, t.neighborhood),
        name,
        category: resolvedCategory,
        neighborhood: t.neighborhood,
        description,
        address: place.formattedAddress,
        lat: place.location.latitude,
        lng: place.location.longitude,
        tags: template?.tags?.length ? template.tags : defaults.tags,
        time_slots: template?.time_slots?.length
          ? template.time_slots
          : defaults.time_slots,
        party_types: template?.party_types?.length
          ? template.party_types
          : defaults.party_types,
        price_level: template?.price_level ?? defaults.price_level,
        photo_url: row.photoName ? photoUrl(row.photoName, 800) : null,
      };
      console.log(`ok (${place.formattedAddress})`);
    } catch (e) {
      row.error = (e as Error).message;
      console.log(`ERROR: ${row.error}`);
    }
    preview.push(row);
  }
  await pool.end();

  writeFileSync(previewPath, JSON.stringify(preview, null, 2));
  const ok = preview.filter((p) => p.plannedInsert).length;
  const bad = preview.length - ok;
  console.log(
    `\nWrote ${preview.length} rows to ${previewPath} (${ok} ready, ${bad} flagged).`
  );
  console.log("Review the preview, then re-run with --apply to insert.");
})();
