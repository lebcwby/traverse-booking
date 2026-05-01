// Seed non-favorite sp_pois rows for day-trip regions so the agent has
// inventory to recommend when a guest asks for a day trip to the coast,
// the Gorge, Mt. Hood, or wine country.
//
// Unlike scripts/seed-favorite-locations.ts (which requires a matching
// FAVORITES entry and copies metadata from an existing template row),
// this script carries full metadata inline on each Target — every row
// has hand-picked category, tags, time_slots, party_types, price_level,
// and description. Coast/Gorge/Mt. Hood destinations don't fit Portland
// defaults like `walkable_from_transit`, so we don't inherit them.
//
// Run: npx tsx --env-file=.env.local scripts/seed-region-pois.ts
//      → writes scripts/.seed-region-pois.preview.json
// Apply: npx tsx --env-file=.env.local scripts/seed-region-pois.ts --apply
//
// Idempotent: skips Targets whose planned id already exists in sp_pois.

import { Pool } from "pg";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { searchPlace, photoUrl } from "@/lib/pois/seed/google-places";

type Category =
  | "restaurant"
  | "coffee"
  | "bar"
  | "park"
  | "shop"
  | "museum"
  | "viewpoint"
  | "activity"
  | "food_cart_pod"
  | "transit";

type Tag =
  | "kid_friendly"
  | "dog_friendly"
  | "romantic"
  | "group_friendly"
  | "solo_friendly"
  | "cheap_eats"
  | "mid_range"
  | "splurge"
  | "outdoor"
  | "indoor"
  | "rooftop"
  | "waterfront"
  | "walkable_from_transit"
  | "vegan_options"
  | "gluten_free_options"
  | "live_music"
  | "hidden_gem"
  | "local_legend"
  | "instagrammable"
  | "view";

type TimeSlot = "morning" | "midday" | "afternoon" | "evening" | "late";
type PartyType = "couple" | "family" | "solo" | "friends";

type Target = {
  query: string; // Google Places query; include full street address
  displayName: string; // sp_pois.name
  category: Category;
  neighborhood: string; // slug from VALID_SLUGS
  description: string; // sp_pois.description (NOT NULL)
  tags: Tag[];
  time_slots: TimeSlot[];
  party_types: PartyType[];
  price_level: number | null;
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

// ============================================================
// COAST — 39 rows across cannon_beach, seaside, tillamook, astoria
// (dedup'd against existing rows: Haystack Rock, Ecola State Park,
//  Cannon Beach Village, Seaside Promenade, Gearhart Golf Links,
//  Cape Kiwanda, Pelican Brewing Pacific City, Tillamook Creamery,
//  Astoria Column, Downtown Astoria — all already seeded)
// ============================================================
const TARGETS: Target[] = [
  // --- Cannon Beach (10) ---
  {
    query: "Hug Point State Recreation Site Arch Cape OR",
    displayName: "Hug Point State Recreation Site",
    category: "park",
    neighborhood: "cannon_beach",
    description:
      "Small state park a few miles south of Cannon Beach with a beach, tide cave, and a waterfall that drops directly onto the sand at low tide; the wagon-track cut in the cliff is where early travelers 'hugged' the point to get around it. Time visits to low tide.",
    tags: ["outdoor", "view", "hidden_gem", "instagrammable", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Cannon Beach Bakery 240 N Hemlock St Cannon Beach OR",
    displayName: "Cannon Beach Bakery",
    category: "restaurant",
    neighborhood: "cannon_beach",
    description:
      "Old-school bakery on Hemlock known for Haystack bread (a loaf shaped like the rock offshore), doughnuts, and pastries; casual breakfast stop.",
    tags: ["indoor", "mid_range", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 1,
  },
  {
    query: "Sleepy Monk Coffee Roasters 1235 S Hemlock St Cannon Beach OR",
    displayName: "Sleepy Monk Coffee Roasters",
    category: "coffee",
    neighborhood: "cannon_beach",
    description:
      "Small Cannon Beach roaster on Hemlock with organic single-origin roasts and a cozy café; often a line on busy mornings.",
    tags: ["indoor", "mid_range", "local_legend", "dog_friendly"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "solo"],
    price_level: 1,
  },
  {
    query: "Public Coast Brewing Company 264 N Hemlock St Cannon Beach OR",
    displayName: "Public Coast Brewing Company",
    category: "bar",
    neighborhood: "cannon_beach",
    description:
      "Cannon Beach brewery + restaurant on Hemlock with a patio; burgers, fish-and-chips, and house-brewed pale ales and IPAs; the brand donates a portion of sales toward keeping Oregon's beaches public.",
    tags: [
      "indoor",
      "mid_range",
      "local_legend",
      "group_friendly",
      "kid_friendly",
    ],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Newmans at 988 Cannon Beach OR",
    displayName: "Newmans at 988",
    category: "restaurant",
    neighborhood: "cannon_beach",
    description:
      "Intimate French-Italian fine-dining room run by chef John Newman in a small house at 988 S Hemlock; prix-fixe leaning menu with wine pairings; reservations essentially required.",
    tags: ["indoor", "romantic", "splurge"],
    time_slots: ["evening"],
    party_types: ["couple"],
    price_level: 4,
  },
  {
    query: "The Wayfarer Restaurant 1190 Pacific Dr Cannon Beach OR",
    displayName: "The Wayfarer Restaurant",
    category: "restaurant",
    neighborhood: "cannon_beach",
    description:
      "Oceanfront restaurant at the Surfsand Resort with a big Pacific view straight to Haystack Rock; Pacific Northwest seafood, steaks, and a solid happy hour.",
    tags: ["waterfront", "view", "mid_range", "romantic", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Bill's Tavern and Brewhouse 188 N Hemlock St Cannon Beach OR",
    displayName: "Bill's Tavern & Brewhouse",
    category: "bar",
    neighborhood: "cannon_beach",
    description:
      "Classic Cannon Beach tavern on Hemlock with house-brewed beer, burgers, and a pool table; been around since 1979 (current incarnation) in a building that's been a local tavern since the 1930s.",
    tags: ["indoor", "mid_range", "local_legend", "group_friendly"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple"],
    price_level: 2,
  },
  {
    query: "Bruce's Candy Kitchen 256 N Hemlock St Cannon Beach OR",
    displayName: "Bruce's Candy Kitchen",
    category: "shop",
    neighborhood: "cannon_beach",
    description:
      "Cannon Beach candy shop since 1963 famous for saltwater taffy hand-pulled in the window; also fudge, caramel corn, and chocolate-dipped everything; kid magnet.",
    tags: ["indoor", "kid_friendly", "local_legend", "cheap_eats"],
    time_slots: ["midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Insomnia Coffee 239 N Hemlock St Cannon Beach OR",
    displayName: "Insomnia Coffee Co (Cannon Beach)",
    category: "coffee",
    neighborhood: "cannon_beach",
    description:
      "Local Oregon coffee roaster with a Cannon Beach café; pour-overs, espresso drinks, and a short pastry menu; low-key counter spot for a morning refuel.",
    tags: ["indoor", "mid_range"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "solo"],
    price_level: 1,
  },
  {
    query:
      "Cannon Beach Hardware and Public House 1235 S Hemlock St Cannon Beach OR",
    displayName: "Cannon Beach Hardware & Public House (Screw & Brew)",
    category: "bar",
    neighborhood: "cannon_beach",
    description:
      "Known locally as the 'Screw & Brew' — an actual hardware store by day that turns into a casual pub with beer, burgers, and live music on weekends; quirky Cannon Beach original.",
    tags: ["indoor", "mid_range", "local_legend", "hidden_gem", "live_music"],
    time_slots: ["afternoon", "evening"],
    party_types: ["friends", "couple", "family"],
    price_level: 2,
  },

  // --- Seaside + Gearhart (9) ---
  {
    query: "Seaside Aquarium 200 N Promenade Seaside OR",
    displayName: "Seaside Aquarium",
    category: "museum",
    neighborhood: "seaside",
    description:
      "Small oceanfront aquarium on the Seaside Promenade since 1937 — one of the oldest on the West Coast; seal feeding, touch tanks, kid-friendly.",
    tags: ["indoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple"],
    price_level: 2,
  },
  {
    query: "Tillamook Head Trail Seaside OR Indian Beach trailhead",
    displayName: "Tillamook Head Trail",
    category: "park",
    neighborhood: "seaside",
    description:
      "6-mile one-way coastal trail between Seaside and Ecola State Park's Indian Beach, following Lewis & Clark's 1806 route over the headland; Tillamook Rock Lighthouse view at the 'Clark's Point of View' overlook; dense Sitka spruce forest and a WWII bunker near the top.",
    tags: ["outdoor", "view", "hidden_gem", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Finn's Fishhouse 220 Broadway St Seaside OR",
    displayName: "Finn's Fishhouse",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "Seaside seafood restaurant on Broadway serving clam chowder, fish-and-chips, and Pacific Northwest fare; walkable from the Promenade.",
    tags: ["indoor", "mid_range", "kid_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Maggie's on the Prom 581 S Promenade Seaside OR",
    displayName: "Maggie's on the Prom",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "Oceanfront dining on the Seaside Promenade at the Seaside Oceanfront Inn; white-tablecloth breakfast and dinner with big Pacific views; classic stop.",
    tags: ["waterfront", "view", "mid_range", "romantic", "kid_friendly"],
    time_slots: ["morning", "midday", "evening"],
    party_types: ["couple", "family", "friends"],
    price_level: 3,
  },
  {
    query: "Sweet Shop candy 8 N Columbia St Seaside OR",
    displayName: "Seaside Sweet Shop",
    category: "shop",
    neighborhood: "seaside",
    description:
      "Classic Seaside candy shop on Broadway with saltwater taffy pulled in the window, fudge, and homemade ice cream; a block from the beach.",
    tags: ["indoor", "kid_friendly", "local_legend", "cheap_eats"],
    time_slots: ["midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Pacific Way Bakery and Cafe 601 Pacific Way Gearhart OR",
    displayName: "Pacific Way Bakery & Cafe",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "Gearhart institution in a 1920s wood-frame building — bakery on the morning side (cinnamon rolls, scones, quiches) and a seasonal café on the dinner side with wood-fired pizzas and pasta; tiny, reservations help.",
    tags: ["indoor", "mid_range", "local_legend", "romantic"],
    time_slots: ["morning", "midday", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "McKeown's Restaurant and Bar 1165 N Marion Ave Gearhart OR",
    displayName: "McKeown's Restaurant & Bar",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "Gearhart restaurant next to Gearhart Golf Links — steak and seafood in a warm Craftsman-style room; the go-to post-round dinner spot.",
    tags: ["indoor", "mid_range", "group_friendly", "romantic"],
    time_slots: ["evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Pig N Pancake 323 Broadway St Seaside OR",
    displayName: "Pig 'N Pancake (Seaside)",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "The original Pig 'N Pancake, opened in Seaside in 1961 — classic Oregon Coast diner breakfast, 35+ varieties of pancakes; the chain grew from this location.",
    tags: ["indoor", "kid_friendly", "mid_range", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },
  {
    query: "Wayfarer Cinema 7 N Columbia St Seaside OR",
    displayName: "Buoy 9 Restaurant (Seaside)",
    category: "restaurant",
    neighborhood: "seaside",
    description:
      "Casual Seaside diner a couple blocks from the beach — fish-and-chips, burgers, breakfast all day; laid-back kid-friendly option.",
    tags: ["indoor", "kid_friendly", "mid_range", "group_friendly"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },

  // --- Pacific City / Tillamook County (9) ---
  {
    query: "Cape Lookout State Park Tillamook OR",
    displayName: "Cape Lookout State Park",
    category: "park",
    neighborhood: "tillamook",
    description:
      "Headland south of Tillamook jutting 2 miles into the Pacific — one of the West Coast's iconic whale-watching perches during migration; 2.4-mile trail to the tip, plus a long sandy beach at the base and a campground.",
    tags: ["outdoor", "view", "local_legend", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Cape Meares Lighthouse and Viewpoint Oceanside OR",
    displayName: "Cape Meares Lighthouse & Viewpoint",
    category: "viewpoint",
    neighborhood: "tillamook",
    description:
      "1890 lighthouse and viewpoint on a 200-ft headland at the tip of the Three Capes Scenic Route — short paved path down to the light; the 'Octopus Tree' (a wind-sculpted Sitka spruce) is a stop on the loop; Three Arch Rocks seabird refuge offshore.",
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Tillamook Air Museum 6030 Hangar Rd Tillamook OR",
    displayName: "Tillamook Air Museum",
    category: "museum",
    neighborhood: "tillamook",
    description:
      "Aviation museum housed inside Hangar B — a massive WWII wooden blimp hangar, one of the largest wooden structures in the world; vintage warbirds and helicopters on display.",
    tags: ["indoor", "kid_friendly", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },
  {
    query: "Blue Heron French Cheese Company 2001 Blue Heron Dr Tillamook OR",
    displayName: "Blue Heron French Cheese Company",
    category: "shop",
    neighborhood: "tillamook",
    description:
      "Tillamook farm-stand-turned-marketplace with French-style cheeses, Oregon wines, jams, and a petting farm in back with goats, cows, and peacocks; kid-friendly stop between Tillamook and the coast.",
    tags: ["indoor", "kid_friendly", "mid_range", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Munson Creek Falls State Natural Site Tillamook OR",
    displayName: "Munson Creek Falls",
    category: "park",
    neighborhood: "tillamook",
    description:
      "319-foot waterfall — the tallest in the Oregon Coast Range — tucked into an old-growth Sitka spruce forest south of Tillamook; short 0.25-mile trail from the parking area to the viewing platform.",
    tags: ["outdoor", "view", "hidden_gem", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query:
      "Grateful Bread Bakery and Restaurant 34805 Brooten Rd Pacific City OR",
    displayName: "Grateful Bread Bakery & Restaurant",
    category: "restaurant",
    neighborhood: "tillamook",
    description:
      "Pacific City bakery and breakfast-lunch spot on Brooten Rd — fresh bread, cinnamon rolls the size of a plate, and full breakfast/brunch menu; the morning stop before Cape Kiwanda.",
    tags: ["indoor", "mid_range", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 2,
  },
  {
    query: "Stimulus Coffee and Bakery 33105 Cape Kiwanda Dr Pacific City OR",
    displayName: "Stimulus Coffee + Bakery",
    category: "coffee",
    neighborhood: "tillamook",
    description:
      "Pacific City café a block from the beach — espresso, pastries, breakfast sandwiches; a short walk from Pelican Brewing and Cape Kiwanda.",
    tags: ["indoor", "mid_range", "kid_friendly"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 1,
  },
  {
    query: "Pacific City Cafe and Pub 35815 Brooten Rd Pacific City OR",
    displayName: "Pacific City Cafe & Pub",
    category: "restaurant",
    neighborhood: "tillamook",
    description:
      "Family-run Pacific City café serving breakfast, burgers, and seafood baskets; unfussy alternative to Pelican when the wait there is long.",
    tags: ["indoor", "mid_range", "kid_friendly", "cheap_eats"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },
  {
    query: "Oswald West State Park Short Sand Beach Arch Cape OR",
    displayName: "Oswald West State Park",
    category: "park",
    neighborhood: "tillamook",
    description:
      "Old-growth coastal state park stretching from Arch Cape to Neahkahnie Mountain; 0.5-mile forested trail from US-101 drops to Short Sand Beach, a sheltered surf cove popular with surfers and families; Cape Falcon viewpoint is a longer 2.5-mile hike on the same trail network.",
    tags: ["outdoor", "view", "hidden_gem", "dog_friendly", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },

  // --- Astoria (11) ---
  {
    query: "Fort Stevens State Park Hammond OR Peter Iredale shipwreck",
    displayName: "Fort Stevens State Park",
    category: "park",
    neighborhood: "astoria",
    description:
      "Massive state park at the mouth of the Columbia — Civil War-era coastal defense fort, the 1906 Peter Iredale shipwreck emerging from the sand, 8 miles of bike paths, and a historic military museum; spend an afternoon.",
    tags: ["outdoor", "view", "kid_friendly", "local_legend", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Fort Clatsop Lewis and Clark National Historical Park Astoria OR",
    displayName: "Fort Clatsop (Lewis & Clark National Historical Park)",
    category: "museum",
    neighborhood: "astoria",
    description:
      "Replica of the 1805 winter fort where the Lewis & Clark Expedition hunkered down after reaching the Pacific; visitor center, living-history demos, and hiking trails through the surrounding rainforest.",
    tags: ["outdoor", "indoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Columbia River Maritime Museum 1792 Marine Dr Astoria OR",
    displayName: "Columbia River Maritime Museum",
    category: "museum",
    neighborhood: "astoria",
    description:
      "One of the top maritime museums on the West Coast — the Columbia Bar's 'Graveyard of the Pacific' wreckage stories, the Coast Guard lifeboat simulator, and the Lightship Columbia tour at the dock out front; 3D theater.",
    tags: ["indoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },
  {
    query: "Oregon Film Museum 732 Duane St Astoria OR Goonies jail",
    displayName: "Oregon Film Museum (Goonies Jail)",
    category: "museum",
    neighborhood: "astoria",
    description:
      "Small museum inside the old Clatsop County Jail — the exact cell Chunk faces in the opening scene of The Goonies — celebrating movies filmed in Oregon (Goonies, Kindergarten Cop, Free Willy, etc.).",
    tags: ["indoor", "kid_friendly", "hidden_gem", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Buoy Beer Co Taproom 1343 Duane St Astoria OR",
    displayName: "Buoy Beer Co Taproom",
    category: "bar",
    neighborhood: "astoria",
    description:
      "Astoria brewery taproom at 1343 Duane St — operating here since their iconic Pier 8 cannery building (famous for its glass-floor sea-lion viewer over the Columbia) partially collapsed in 2022 and is being rebuilt; Fisherman's Stout, Cream Ale, house IPAs, and a food menu.",
    tags: ["indoor", "mid_range", "local_legend", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Fort George Brewery 1483 Duane St Astoria OR",
    displayName: "Fort George Brewery + Public House",
    category: "bar",
    neighborhood: "astoria",
    description:
      "Iconic Astoria brewery in the historic Fort George building (1924) on Duane St — three floors of dining (public house downstairs, upstairs Lovell Taproom, pizza in the basement) and a beer program that ships statewide; Vortex IPA is the flagship.",
    tags: ["indoor", "mid_range", "local_legend", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening", "late"],
    party_types: ["friends", "couple", "family"],
    price_level: 2,
  },
  {
    query: "Reach Break Brewing 1343 Duane St Astoria OR",
    displayName: "Reach Break Brewing",
    category: "bar",
    neighborhood: "astoria",
    description:
      "Small-batch Astoria craft brewery a block from Fort George — hazy IPAs and experimental sours in a low-key taproom; often under-the-radar among Astoria beer stops.",
    tags: ["indoor", "mid_range", "hidden_gem"],
    time_slots: ["afternoon", "evening"],
    party_types: ["friends", "couple"],
    price_level: 2,
  },
  {
    query: "Bowpicker Fish and Chips 1634 Duane St Astoria OR",
    displayName: "Bowpicker Fish & Chips",
    category: "restaurant",
    neighborhood: "astoria",
    description:
      "Astoria's iconic fish-and-chips stand — a retired 1934 fishing boat permanently parked at 17th & Duane serving beer-battered albacore tuna with steak fries; cash only, usually a long line, closed in winter.",
    tags: ["outdoor", "cheap_eats", "local_legend", "hidden_gem"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 1,
  },
  {
    query: "Baked Alaska Restaurant 1 12th St Astoria OR",
    displayName: "Baked Alaska",
    category: "restaurant",
    neighborhood: "astoria",
    description:
      "Waterfront Astoria restaurant at 1 12th St on the pier — seafood-forward American menu with wide Columbia River views from the dining room; long-running Astoria fine-dining staple.",
    tags: ["waterfront", "view", "mid_range", "romantic"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "T. Paul's Supper Club 360 12th St Astoria OR",
    displayName: "T. Paul's Supper Club",
    category: "restaurant",
    neighborhood: "astoria",
    description:
      "Downtown Astoria supper-club-style restaurant known for Cajun flair, crab-and-artichoke dip, and pasta; full bar, vinyl-record soundtrack, casual vibe.",
    tags: ["indoor", "mid_range", "group_friendly", "local_legend"],
    time_slots: ["evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Astoria Riverwalk Astoria OR",
    displayName: "Astoria Riverwalk",
    category: "park",
    neighborhood: "astoria",
    description:
      "5-mile paved path along the Columbia River through downtown Astoria — walkable from the Maritime Museum to Buoy Beer and beyond; the Old 300 trolley runs alongside on weekends ($2); sea lion watching at the cannery piers.",
    tags: [
      "outdoor",
      "view",
      "walkable_from_transit",
      "kid_friendly",
      "dog_friendly",
    ],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },

  // ============================================================
  // COLUMBIA GORGE — 10 rows (dedup'd vs Vista House, Multnomah Falls,
  // Wahclella Falls which already exist)
  // ============================================================
  {
    query: "Latourell Falls Guy W Talbot State Park Corbett OR",
    displayName: "Latourell Falls",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "249-ft plunge waterfall dropping straight off a columnar basalt wall just off the Historic Columbia River Highway — one of the most photogenic Gorge falls; 10-minute walk from the parking lot to the lower viewpoint, or a 2.4-mile loop that climbs to the upper falls.",
    tags: ["outdoor", "view", "instagrammable", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Bridal Veil Falls State Park Corbett OR",
    displayName: "Bridal Veil Falls",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "Short 0.7-mile round-trip path through ferns and big leaf maples to a viewing platform at the base of a two-tiered 120-ft cascade; on the Historic Columbia River Highway between Latourell and Multnomah Falls.",
    tags: ["outdoor", "view", "kid_friendly", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Wahkeena Falls Oregon Corbett",
    displayName: "Wahkeena Falls",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "Multi-tiered 242-ft waterfall right on the Historic Columbia River Highway — 0.2-mile paved path to the viewing bridge, or extend 5 miles up to Fairy Falls and loop back via Multnomah Falls on a popular Gorge hike.",
    tags: ["outdoor", "view", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Horsetail Falls Oregon Columbia Gorge",
    displayName: "Horsetail Falls",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "176-ft waterfall that drops directly alongside the Historic Columbia River Highway — you can see it from the car window; short 2.6-mile Horsetail + Ponytail loop climbs to the upper 'Ponytail' (Upper Horsetail) falls where the trail passes behind the cascade.",
    tags: ["outdoor", "view", "instagrammable", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Bonneville Lock and Dam Visitor Center Cascade Locks OR",
    displayName: "Bonneville Lock and Dam",
    category: "activity",
    neighborhood: "columbia_gorge",
    description:
      "Historic 1938 dam on the Columbia — Bradford Island visitor center has underwater fish-ladder windows where you can watch salmon and steelhead climb the ladder in spring and fall; powerhouse tours and the navigation lock are also open to the public; free.",
    tags: ["indoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 0,
  },
  {
    query: "Bonneville Fish Hatchery 70543 NE Herman Loop Cascade Locks OR",
    displayName: "Bonneville Fish Hatchery",
    category: "activity",
    neighborhood: "columbia_gorge",
    description:
      "State hatchery next to Bonneville Dam — Herman the 10-ft, 80+ year old sturgeon lives in the sturgeon viewing pond here; also rainbow trout, Pacific salmon rearing ponds, and a Japanese-style garden; free.",
    tags: ["outdoor", "kid_friendly", "local_legend", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 0,
  },
  {
    query: "Cascade Locks Marine Park Bridge of the Gods Cascade Locks OR",
    displayName: "Cascade Locks Marine Park / Bridge of the Gods",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "Columbia riverside park at Cascade Locks with views of the 1926 Bridge of the Gods (a steel cantilever bridge pedestrians can walk across for $3 toll — the Pacific Crest Trail crosses the river here); food carts cluster in the park in season; the sternwheeler Columbia Gorge cruises depart from the adjacent marina.",
    tags: ["outdoor", "view", "walkable_from_transit", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Rowena Crest Viewpoint Mosier OR",
    displayName: "Rowena Crest Viewpoint",
    category: "viewpoint",
    neighborhood: "columbia_gorge",
    description:
      "Iconic viewpoint on the Historic Columbia River Highway between Mosier and The Dalles — famous for the horseshoe bend of the old highway loop below; Tom McCall Preserve next door is a wildflower-heavy hike in April/May; best in morning or golden hour.",
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "afternoon", "evening"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query:
      "Portland Women's Forum State Scenic Viewpoint Corbett OR Chanticleer Point",
    displayName: "Portland Women's Forum State Scenic Viewpoint",
    category: "viewpoint",
    neighborhood: "columbia_gorge",
    description:
      "Chanticleer Point viewpoint on the Historic Columbia River Highway — the most-photographed Gorge vantage, with Crown Point + Vista House perched on the cliff downriver; free, a 2-minute stop, best at sunrise or with morning light.",
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Elowah Falls Oregon John B Yeon State Park",
    displayName: "Elowah Falls",
    category: "park",
    neighborhood: "columbia_gorge",
    description:
      "Less-trafficked 213-ft waterfall in John B Yeon State Park — 1.4-mile round-trip trail through old-growth forest to a mossy amphitheater at the base of the falls; skip the crowds at Multnomah Falls for this one.",
    tags: ["outdoor", "view", "hidden_gem", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },

  // ============================================================
  // HOOD RIVER — 15 rows (dedup'd vs generic "Downtown Hood River")
  // ============================================================
  {
    query: "Pfriem Family Brewers 707 Portway Ave Hood River OR",
    displayName: "Pfriem Family Brewers",
    category: "bar",
    neighborhood: "hood_river",
    description:
      "Hood River's standout brewery — Belgian-leaning and European-style beers at a waterfront location with big windows over the Columbia; restaurant has a full menu (mussels, burgers, frites); the house beers have racked up 100+ GABF and World Beer Cup medals.",
    tags: ["waterfront", "view", "mid_range", "local_legend", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Full Sail Brewing 506 Columbia St Hood River OR",
    displayName: "Full Sail Brewing",
    category: "bar",
    neighborhood: "hood_river",
    description:
      "Downtown Hood River brewery opened 1987 — one of the oldest Oregon craft breweries still standing; Columbia Street pub has a patio with views over the river, a full food menu, and flights of their Amber Ale, Pale Ale, and seasonals.",
    tags: ["indoor", "view", "mid_range", "local_legend", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Double Mountain Brewery 8 4th St Hood River OR",
    displayName: "Double Mountain Brewery",
    category: "bar",
    neighborhood: "hood_river",
    description:
      "Downtown Hood River brewery known as much for its wood-fired NY-style pizza as its beer — IRA (India Red Ale), Vaporizer pale, and an ever-rotating fruit-beer program; small room, live music most weekends.",
    tags: [
      "indoor",
      "mid_range",
      "local_legend",
      "group_friendly",
      "live_music",
    ],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple", "family"],
    price_level: 2,
  },
  {
    query: "Packer Orchards and Bakery 3900 OR-35 Hood River OR",
    displayName: "Packer Orchards & Bakery",
    category: "shop",
    neighborhood: "hood_river",
    description:
      "Iconic Hood River Fruit Loop stop — massive cookies (marionberry, lemon poppy, chocolate-chip), fruit fritters, jams, and fresh pressed cider in an open-sided farm shed surrounded by orchards and Mt. Hood on the horizon.",
    tags: ["outdoor", "kid_friendly", "local_legend", "view"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Draper Girls Country Farm 6200 OR-35 Parkdale OR",
    displayName: "Draper Girls Country Farm",
    category: "shop",
    neighborhood: "hood_river",
    description:
      "Hood River Fruit Loop farm stand with u-pick cherries (June) and apples/pears (August–October), fresh-pressed apple cider, cider donuts, and a seasonal pumpkin patch; Mt. Hood view over the orchard rows.",
    tags: ["outdoor", "kid_friendly", "local_legend", "view"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Kiyokawa Family Orchards 8129 Clear Creek Rd Parkdale OR",
    displayName: "Kiyokawa Family Orchards",
    category: "shop",
    neighborhood: "hood_river",
    description:
      "Fourth-generation Japanese-American family orchard on the Fruit Loop — u-pick and pre-picked apples (150+ varieties), pears, peaches, and nectarines; shaded picnic tables and Mt. Hood directly overhead.",
    tags: ["outdoor", "kid_friendly", "view", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Smiley's Red Barn 4500 OR-35 Hood River OR",
    displayName: "Smiley's Red Barn",
    category: "shop",
    neighborhood: "hood_river",
    description:
      "Fruit Loop farm stand in a bright red barn — apples, pears, cherries, huckleberries in season, plus jams, pies, and pepper jellies made on-site; classic quick stop between Packer and Draper.",
    tags: ["outdoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 1,
  },
  {
    query: "Panorama Point County Park Hood River OR",
    displayName: "Panorama Point",
    category: "viewpoint",
    neighborhood: "hood_river",
    description:
      "Small county park just south of Hood River town with a direct Mt. Hood-over-orchards view — the classic Hood River Valley shot; free, 5-minute stop, benches.",
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 0,
  },
  {
    query: "Hood River Waterfront Park Portway Ave Hood River OR",
    displayName: "Hood River Waterfront Park",
    category: "park",
    neighborhood: "hood_river",
    description:
      "Columbia riverside park at the foot of downtown Hood River with a kids' play area, grassy lawn, and launch sites for kiteboarders and windsurfers — the town's summer gathering spot; Pfriem Brewing is on the west edge.",
    tags: ["outdoor", "waterfront", "view", "kid_friendly", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Mt Hood Railroad 110 Railroad Ave Hood River OR",
    displayName: "Mt. Hood Railroad",
    category: "activity",
    neighborhood: "hood_river",
    description:
      "Historic 1906 shortline railroad that runs scenic excursions out of downtown Hood River through the Hood River Valley orchards toward Parkdale; themed trains (Fruit Blossom, Polar Express in December) are the draw; 4-hour round trip.",
    tags: ["kid_friendly", "local_legend", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 3,
  },
  {
    query: "Stave and Stone Winery 3827 Fletcher Ln Hood River OR",
    displayName: "Stave & Stone Winery",
    category: "activity",
    neighborhood: "hood_river",
    description:
      "Family-run estate winery on the Fruit Loop south of Hood River — Pinot Noir, Syrah, Rhône-style whites, and a Mt. Hood view patio; casual tasting room with flights and glasses.",
    tags: ["outdoor", "view", "romantic", "mid_range"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    query: "Broder Ost 102 Oak St Hood River OR",
    displayName: "Broder Øst",
    category: "restaurant",
    neighborhood: "hood_river",
    description:
      "Scandinavian-inflected breakfast and lunch spot — sibling of Portland's Broder — inside the Hood River Hotel; aebleskivers, lefse wraps, baked scrambles, and Danish potatoes; small room, often a wait on weekends.",
    tags: ["indoor", "mid_range", "romantic", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family"],
    price_level: 2,
  },
  {
    query: "Celilo Restaurant and Bar 16 Oak St Hood River OR",
    displayName: "Celilo Restaurant & Bar",
    category: "restaurant",
    neighborhood: "hood_river",
    description:
      "Downtown Hood River farm-to-table restaurant — seasonal Pacific Northwest menu, Oregon wine list, and a patio; the upscale dinner pick in town.",
    tags: ["indoor", "mid_range", "romantic", "local_legend"],
    time_slots: ["evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Solstice Wood Fire Pizza 501 Portway Ave Hood River OR",
    displayName: "Solstice Wood Fire Pizza",
    category: "restaurant",
    neighborhood: "hood_river",
    description:
      "Wood-fired pizza restaurant on the Hood River waterfront — thin-crust pies with local produce, salads, and house desserts; patio with Columbia views; family-friendly.",
    tags: ["waterfront", "view", "mid_range", "kid_friendly", "group_friendly"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["family", "couple", "friends"],
    price_level: 2,
  },
  {
    query: "Stoked Roasters 1310 Tucker Rd Hood River OR",
    displayName: "Stoked Roasters + Coffeehouse",
    category: "coffee",
    neighborhood: "hood_river",
    description:
      "Hood River coffee roaster + café — espresso, pour-overs, and house breakfast sandwiches; the outdoor-leaning Hood River crowd's pre-hike stop.",
    tags: ["indoor", "mid_range", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 1,
  },

  // ============================================================
  // MT. HOOD — 5 rows (dedup'd vs Timberline Lodge, Trillium Lake,
  // Mirror Lake Trail, Government Camp Village, Highland Farms)
  // ============================================================
  {
    query: "Skibowl Adventure Park Government Camp Oregon",
    displayName: "Mt. Hood Skibowl",
    category: "activity",
    neighborhood: "mt_hood",
    description:
      "America's largest night ski area in winter — and an alpine adventure park in summer, with an alpine slide, scenic chairlift, mountain biking, zipline, and disc golf; Government Camp at US-26.",
    tags: ["outdoor", "kid_friendly", "group_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon", "evening"],
    party_types: ["family", "couple", "friends"],
    price_level: 3,
  },
  {
    query: "Ramona Falls Trail Mt Hood Wilderness Oregon",
    displayName: "Ramona Falls Trail",
    category: "park",
    neighborhood: "mt_hood",
    description:
      "7.1-mile loop to one of Oregon's most photographed waterfalls — a 120-ft curtain of water fanning down a mossy basalt wall on the western flank of Mt. Hood; moderate hike with a river crossing that can be tricky in high water.",
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Wildwood Recreation Site 65670 US-26 Welches OR",
    displayName: "Wildwood Recreation Site",
    category: "park",
    neighborhood: "mt_hood",
    description:
      "Day-use BLM park on the Salmon River between Portland and Government Camp — easy 1-mile Cascade Streamwatch Trail with an underwater salmon viewing window, picnic areas, and old-growth forest; kid-friendly lowland stop when Mt. Hood itself is socked in.",
    tags: ["outdoor", "view", "kid_friendly", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 1,
  },
  {
    query: "Little Crater Lake Mt Hood National Forest Oregon",
    displayName: "Little Crater Lake",
    category: "park",
    neighborhood: "mt_hood",
    description:
      "Surreal 45-ft-deep artesian pool of impossibly clear turquoise water — 0.5-mile easy boardwalk from the parking area, usually skipped by the Timberline crowd; wheelchair accessible; best June–October.",
    tags: ["outdoor", "view", "hidden_gem", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 0,
  },
  {
    query: "Lost Lake Resort Mt Hood Oregon",
    displayName: "Lost Lake",
    category: "park",
    neighborhood: "mt_hood",
    description:
      "Deep alpine lake with the iconic Mt. Hood reflection — rustic lakeside resort, cabins, a general store, rental canoes and kayaks; 3.2-mile shoreline loop; quieter alternative to Trillium Lake; open May-October.",
    tags: ["outdoor", "view", "instagrammable", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "family"],
    price_level: 1,
  },

  // ============================================================
  // WINE COUNTRY — 15 rows across dundee, carlton, mcminnville, turner
  // (dedup'd vs existing blobs and Sokol Blosser)
  // ============================================================
  {
    query: "Domaine Drouhin Oregon 6750 NE Breyman Orchards Rd Dayton OR",
    displayName: "Domaine Drouhin Oregon",
    category: "activity",
    neighborhood: "dundee",
    description:
      "Burgundian estate in the Dundee Hills from the Drouhin family of Beaune — Pinot Noir and Chardonnay grown on a hilltop with panoramic views; elegant hilltop tasting room; reservations required; the pedigree estate of Oregon wine.",
    tags: ["outdoor", "view", "romantic", "splurge", "local_legend"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends"],
    price_level: 4,
  },
  {
    query: "Archery Summit Winery 18599 NE Archery Summit Rd Dayton OR",
    displayName: "Archery Summit Estate Winery",
    category: "activity",
    neighborhood: "dundee",
    description:
      "Dundee Hills estate with five vineyard blocks, a gravity-flow winery, and hillside caves; Pinot Noir focused with tastings that include estate single-vineyard bottlings; hilltop tasting room with wide Willamette Valley views.",
    tags: ["outdoor", "view", "romantic", "splurge"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends"],
    price_level: 4,
  },
  {
    query: "Argyle Winery 691 OR-99W Dundee OR",
    displayName: "Argyle Winery",
    category: "activity",
    neighborhood: "dundee",
    description:
      "Oregon's sparkling-wine specialist on the main drag through Dundee — traditional-method bubbles, Chardonnay, and Pinot Noir in a restored Victorian tasting house; one of the few walk-in-friendly spots on the wine trail.",
    tags: ["indoor", "mid_range", "romantic", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Stoller Family Estate 16161 NE McDougall Rd Dayton OR",
    displayName: "Stoller Family Estate",
    category: "activity",
    neighborhood: "dundee",
    description:
      "400-acre Dundee Hills estate — the first LEED Gold certified winery in the world; Pinot Noir, Chardonnay, Pinot Gris, and Rosé; modern airy tasting room with a big patio, vineyard walk, and a picnic lawn.",
    tags: ["outdoor", "view", "romantic", "mid_range"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Tinas Restaurant 760 OR-99W Dundee OR",
    displayName: "Tina's Restaurant",
    category: "restaurant",
    neighborhood: "dundee",
    description:
      "Dundee roadhouse-turned-destination on 99W — Northwest farm-to-table menu by chef Tina Landfried since 1991, a go-to lunch between tasting rooms; Oregon wine list is deep and regionally-focused.",
    tags: ["indoor", "mid_range", "romantic", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Ken Wright Cellars 120 N Pine St Carlton OR",
    displayName: "Ken Wright Cellars",
    category: "activity",
    neighborhood: "carlton",
    description:
      "Pinot Noir specialist in downtown Carlton — single-vineyard bottlings from Yamhill-Carlton, Savoya, Canary Hill, Carter, and other named sites; intimate tasting room in an old train depot.",
    tags: ["indoor", "romantic", "local_legend", "splurge"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends"],
    price_level: 4,
  },
  {
    query: "Canas Feast Winery 750 W Lincoln St Carlton OR",
    displayName: "Cana's Feast Winery",
    category: "activity",
    neighborhood: "carlton",
    description:
      "Italian-varietal-focused winery in Carlton — Nebbiolo, Barbera, Sangiovese, and Syrah alongside Pinot Noir; hosts summer pig roasts and wood-fired pizza nights in the courtyard; wine-country dinner destination.",
    tags: ["outdoor", "romantic", "mid_range", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    query: "Carlton Bakery 305 W Main St Carlton OR",
    displayName: "Carlton Bakery",
    category: "restaurant",
    neighborhood: "carlton",
    description:
      "French-Italian bakery and café on Main St — croissants, quiches, sandwiches on house bread, espresso, and a small wine list; the walk-up breakfast/lunch anchor of Carlton.",
    tags: ["indoor", "mid_range", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends", "family", "solo"],
    price_level: 2,
  },
  {
    query: "Ghost Hill Cellars 9150 NE Kimsey Ln Carlton OR",
    displayName: "Ghost Hill Cellars",
    category: "activity",
    neighborhood: "carlton",
    description:
      "Fourth-generation Yamhill-Carlton family farm turned winery — Pinot Noir from their own estate with a relaxed tasting room and long-range Coast Range views; small operation, intimate feel.",
    tags: ["outdoor", "view", "romantic", "hidden_gem"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    query:
      "Evergreen Aviation Space Museum 500 NE Michael King Smith Way McMinnville OR",
    displayName: "Evergreen Aviation & Space Museum",
    category: "museum",
    neighborhood: "mcminnville",
    description:
      "McMinnville museum housing Howard Hughes's Spruce Goose (H-4 Hercules, world's largest wooden plane), plus a SR-71 Blackbird, Titan II missile, a waterpark with a 747 on the roof, and a giant-screen 3D theater; multi-hour kid destination.",
    tags: ["indoor", "kid_friendly", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends"],
    price_level: 3,
  },
  {
    query: "The Painted Lady Restaurant 201 S College St Newberg OR",
    displayName: "The Painted Lady",
    category: "restaurant",
    neighborhood: "dundee",
    description:
      "Fine-dining tasting-menu restaurant in a restored Victorian in Newberg (just east of Dundee on 99W) — multi-course chef's tasting with optional wine pairings; one of Oregon's most decorated kitchens; reservations essentially required.",
    tags: ["indoor", "romantic", "splurge"],
    time_slots: ["evening"],
    party_types: ["couple"],
    price_level: 4,
  },
  {
    query: "Nicks Italian Cafe 521 NE 3rd St McMinnville OR",
    displayName: "Nick's Italian Cafe",
    category: "restaurant",
    neighborhood: "mcminnville",
    description:
      "McMinnville institution opened 1977 — a five-course prix fixe plus à la carte pasta and pizza; deep Oregon wine list; considered the birthplace of wine-country dining in the valley.",
    tags: ["indoor", "romantic", "local_legend", "mid_range"],
    time_slots: ["evening"],
    party_types: ["couple", "friends", "family"],
    price_level: 3,
  },
  {
    query: "Community Plate 315 NE 3rd St McMinnville OR",
    displayName: "Community Plate",
    category: "restaurant",
    neighborhood: "mcminnville",
    description:
      "Farm-to-table breakfast and lunch on 3rd Street McMinnville — biscuits-and-gravy, grain bowls, and house-baked pastries using local farms; the daytime stop between wine tastings.",
    tags: ["indoor", "mid_range", "kid_friendly"],
    time_slots: ["morning", "midday"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 2,
  },
  {
    query: "Hotel Oregon 310 NE Evans St McMinnville OR",
    displayName: "Hotel Oregon",
    category: "bar",
    neighborhood: "mcminnville",
    description:
      "McMenamins-restored 1905 hotel on 3rd Street — rooftop bar with Coast Range views, ground-floor pub, live music most nights, and the site of the annual UFO Festival in May; central McMinnville hangout.",
    tags: ["rooftop", "view", "indoor", "local_legend", "group_friendly"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple", "family"],
    price_level: 2,
  },
  {
    query: "Silver Falls State Park 20024 Silver Falls Hwy SE Sublimity OR",
    displayName: "Silver Falls State Park",
    category: "park",
    neighborhood: "turner",
    description:
      "Oregon's largest state park at 9,000 acres — the Trail of Ten Falls is a 7.2-mile loop passing (and behind) 10 waterfalls, including the 177-ft South Falls; arguably the best state park day hike in the PNW; about 1 hour south of Portland.",
    tags: ["outdoor", "view", "kid_friendly", "local_legend", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["family", "couple", "friends", "solo"],
    price_level: 1,
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

type PreviewRow = {
  target: Target;
  placeId: string | null;
  resolvedName: string | null;
  resolvedAddress: string | null;
  lat: number | null;
  lng: number | null;
  photoName: string | null;
  plannedInsert: Record<string, unknown> | null;
  error: string | null;
};

(async () => {
  const apply = process.argv.includes("--apply");
  const previewPath = "scripts/.seed-region-pois.preview.json";

  if (apply) {
    if (!existsSync(previewPath)) {
      console.error(`Missing ${previewPath} — run without --apply first.`);
      process.exit(1);
    }
    const preview: PreviewRow[] = JSON.parse(
      readFileSync(previewPath, "utf-8")
    );
    const ready = preview.filter((p) => p.plannedInsert);
    console.log(`Applying ${ready.length} inserts...`);

    const pool = new Pool({
      connectionString: process.env.SHARED_DATABASE_URL,
    });
    let ok = 0,
      skipped = 0,
      failed = 0;
    for (const p of ready) {
      const ins = p.plannedInsert!;
      try {
        const r = await pool.query(
          `INSERT INTO sp_pois (id, name, category, neighborhood, description, address, lat, lng, tags, time_slots, party_types, price_level, photo_url, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
           ON CONFLICT (id) DO NOTHING`,
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
        if (r.rowCount === 0) {
          console.log(`  skip (exists): ${ins.id}`);
          skipped++;
        } else {
          console.log(`  ok: ${ins.id} (${ins.neighborhood})`);
          ok++;
        }
      } catch (e) {
        console.log(`  FAIL: ${ins.id} — ${(e as Error).message}`);
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

  // Idempotency: skip targets whose planned id already exists
  const plannedIds = TARGETS.map((t) => slugId(t.displayName, t.neighborhood));
  const existsRes = await pool.query(
    `SELECT id FROM sp_pois WHERE id = ANY($1)`,
    [plannedIds]
  );
  const alreadyThere = new Set<string>(existsRes.rows.map((r: any) => r.id));

  for (const t of TARGETS) {
    const plannedId = slugId(t.displayName, t.neighborhood);
    if (alreadyThere.has(plannedId)) {
      console.log(`${t.displayName} (exists, skip)`);
      continue;
    }
    if (!VALID_SLUGS.includes(t.neighborhood)) {
      console.log(`${t.displayName} BAD SLUG: ${t.neighborhood}`);
      preview.push({
        target: t,
        placeId: null,
        resolvedName: null,
        resolvedAddress: null,
        lat: null,
        lng: null,
        photoName: null,
        plannedInsert: null,
        error: `invalid slug: ${t.neighborhood}`,
      });
      continue;
    }
    process.stdout.write(`${t.displayName}... `);
    const row: PreviewRow = {
      target: t,
      placeId: null,
      resolvedName: null,
      resolvedAddress: null,
      lat: null,
      lng: null,
      photoName: null,
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

      row.plannedInsert = {
        id: plannedId,
        name: t.displayName,
        category: t.category,
        neighborhood: t.neighborhood,
        description: t.description,
        address: place.formattedAddress,
        lat: place.location.latitude,
        lng: place.location.longitude,
        tags: t.tags,
        time_slots: t.time_slots,
        party_types: t.party_types,
        price_level: t.price_level,
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
