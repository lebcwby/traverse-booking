// Seed Leadville POIs + 2026 events for /plan.
//
// Run: npx tsx --env-file=.env.local scripts/seed-leadville-plan.ts          # preview
//      npx tsx --env-file=.env.local scripts/seed-leadville-plan.ts --apply  # write
//
// Idempotent — uses ON CONFLICT (id) DO UPDATE so re-runs refresh content.
//
// Lat/lng are hand-verified. Photos default to null; can be backfilled later
// with a Google Places API key via scripts/backfill-poi-photos.ts.

import { Pool } from "pg";

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

interface PoiSeed {
  id: string;
  name: string;
  category: Category;
  neighborhood: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  tags: Tag[];
  time_slots: TimeSlot[];
  party_types: PartyType[];
  price_level: number | null;
  source_url?: string | null;
}

interface EventSeed {
  id: string;
  name: string;
  town: "Crested Butte" | "Leadville";
  blurb: string;
  category: "festival" | "race" | "music" | "nature" | "culture" | "seasonal" | "sport";
  date_kind: "fixed" | "recurring";
  start_date?: string | null;
  end_date?: string | null;
  recurring_rule_text?: string | null;
  official_url?: string | null;
  poi_id?: string | null;
}

// ─── POIs ──────────────────────────────────────────────────────────────────

const POIS: PoiSeed[] = [
  // Eat — casual / lunch
  {
    id: "leadville-high-mountain-pies",
    name: "High Mountain Pies",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Brick-oven pizzas, calzones, and stromboli — the post-trail Leadville institution. Family-run, packed nightly, and the locals' default after a 14er.",
    address: "115 W 4th St, Leadville, CO 80461",
    lat: 39.2509,
    lng: -106.2925,
    tags: ["kid_friendly", "group_friendly", "cheap_eats", "indoor", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 2,
  },
  {
    id: "leadville-tennessee-pass-cafe",
    name: "Tennessee Pass Cafe",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Sandwiches, soups, and salads with a focus on local ingredients on Harrison Ave — a reliable lunch stop between summit hikes.",
    address: "222 Harrison Ave, Leadville, CO 80461",
    lat: 39.2480,
    lng: -106.2916,
    tags: ["kid_friendly", "mid_range", "indoor", "vegan_options", "gluten_free_options"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "solo", "friends"],
    price_level: 2,
  },
  {
    id: "leadville-silver-llama",
    name: "Silver Llama",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Counter-service spot on Harrison with bright, locally inspired plates. Great quick lunch when you don't want to commit to a sit-down dinner.",
    address: "615 Harrison Ave Unit B, Leadville, CO 80461",
    lat: 39.2502,
    lng: -106.2916,
    tags: ["mid_range", "indoor", "hidden_gem", "vegan_options"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple",  "solo", "friends"],
    price_level: 2,
  },
  {
    id: "leadville-city-on-a-hill-coffee",
    name: "City on a Hill Coffee",
    category: "coffee",
    neighborhood: "leadville",
    description:
      "Bright Harrison Ave coffeehouse — pastries, espresso, and the kind of remote-work energy you need after sleeping at 10,152 ft.",
    address: "508 Harrison Ave, Leadville, CO 80461",
    lat: 39.2495,
    lng: -106.2917,
    tags: ["kid_friendly", "cheap_eats", "indoor", "solo_friendly"],
    time_slots: ["morning", "midday"],
    party_types: ["couple",  "solo"],
    price_level: 1,
  },

  // Eat — dinner / nicer
  {
    id: "leadville-treeline-kitchen",
    name: "Treeline Kitchen",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Modern American with seasonal small plates and a thoughtful wine list — Leadville's grown-up dinner option, on Harrison.",
    address: "613 Harrison Ave, Leadville, CO 80461",
    lat: 39.2503,
    lng: -106.2916,
    tags: ["romantic", "mid_range", "indoor", "vegan_options", "gluten_free_options"],
    time_slots: ["evening", "late"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    id: "leadville-quincys-steak-spirits",
    name: "Quincy's Steak & Spirits",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Classic Leadville steakhouse — limited menu (filet or prime rib only), packed every night, decades-long local institution.",
    address: "416 Harrison Ave, Leadville, CO 80461",
    lat: 39.2491,
    lng: -106.2917,
    tags: ["splurge", "indoor", "local_legend", "group_friendly"],
    time_slots: ["evening"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    id: "leadville-the-grill-bar-cafe",
    name: "The Grill Bar & Cafe",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Family-run Mexican on the south end of town since 1965 — strong margaritas, generous green chili, real Leadville color.",
    address: "715 Elm St, Leadville, CO 80461",
    lat: 39.2466,
    lng: -106.2937,
    tags: [ "mid_range", "indoor", "local_legend", "kid_friendly"],
    time_slots: ["midday", "evening"],
    party_types: [ "couple", "friends"],
    price_level: 2,
  },
  {
    id: "leadville-tennessee-pass-cookhouse",
    name: "Tennessee Pass Cookhouse",
    category: "restaurant",
    neighborhood: "tennessee_pass",
    description:
      "Yurt dinner reached on ski, snowshoe, or summer hike — multi-course mountain feast at Tennessee Pass Nordic Center. Reservations weeks out.",
    address: "Tennessee Pass Nordic Center, Leadville, CO 80461",
    lat: 39.3705,
    lng: -106.3303,
    tags: ["splurge", "romantic", "outdoor", "instagrammable", "view", "hidden_gem"],
    time_slots: ["evening"],
    party_types: ["couple", "friends"],
    price_level: 4,
    source_url: "https://tennesseepass.com/cookhouse/",
  },
  {
    id: "leadville-rocky-mountain-thai-kitchen",
    name: "Rocky Mountain Thai Kitchen",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Thai dinner on Harrison — curries, pad thai, and stir-fries that hit hard at 10,152 ft. Limited seating; lean takeaway-friendly.",
    address: "Harrison Ave, Leadville, CO 80461",
    lat: 39.2495,
    lng: -106.2917,
    tags: ["mid_range", "indoor", "vegan_options", "gluten_free_options"],
    time_slots: ["evening"],
    party_types: ["couple",  "solo", "friends"],
    price_level: 2,
  },
  {
    id: "leadville-the-famous",
    name: "The Famous",
    category: "restaurant",
    neighborhood: "leadville",
    description:
      "Dinner spot with rotating chef-driven menu and craft cocktails. Smaller, intimate room — book ahead on weekends.",
    address: "Harrison Ave, Leadville, CO 80461",
    lat: 39.2495,
    lng: -106.2917,
    tags: ["romantic", "splurge", "indoor"],
    time_slots: ["evening"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },

  // Drink
  {
    id: "leadville-two-mile-brewing",
    name: "Two Mile Brewing",
    category: "bar",
    neighborhood: "leadville",
    description:
      "Brewpub with patio, food trucks, and summer live music — the casual après spot for cyclists, runners, and 14er-day groups.",
    address: "1900 Poplar St, Leadville, CO 80461",
    lat: 39.2389,
    lng: -106.2855,
    tags: ["dog_friendly", "group_friendly", "outdoor", "live_music", "mid_range"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple"],
    price_level: 2,
  },
  {
    id: "leadville-silver-dollar-saloon",
    name: "Silver Dollar Saloon",
    category: "bar",
    neighborhood: "leadville",
    description:
      "Operating since 1879 with the original tin ceiling, mahogany back-bar, and all the Wild West atmosphere you came to Leadville for.",
    address: "315 Harrison Ave, Leadville, CO 80461",
    lat: 39.2487,
    lng: -106.2917,
    tags: ["local_legend", "indoor", "instagrammable", "hidden_gem"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple", "solo"],
    price_level: 2,
  },
  {
    id: "leadville-scarlet-tavern",
    name: "Scarlet Tavern",
    category: "bar",
    neighborhood: "leadville",
    description:
      "Local bar on Harrison — laid-back, friendly, the kind of place where you'll get talked into a second round.",
    address: "Harrison Ave, Leadville, CO 80461",
    lat: 39.2488,
    lng: -106.2917,
    tags: ["local_legend", "indoor", "group_friendly"],
    time_slots: ["evening", "late"],
    party_types: ["friends", "couple", "solo"],
    price_level: 2,
  },
  {
    id: "leadville-before-and-after",
    name: "Before and After",
    category: "bar",
    neighborhood: "leadville",
    description:
      "Cocktail bar with serious bartending — pre-dinner aperitifs and post-dinner nightcaps in a small, well-stocked room.",
    address: "Harrison Ave, Leadville, CO 80461",
    lat: 39.2493,
    lng: -106.2917,
    tags: ["romantic", "splurge", "indoor", "hidden_gem"],
    time_slots: ["evening", "late"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    id: "leadville-delaware-hotel",
    name: "Delaware Hotel Bar",
    category: "bar",
    neighborhood: "leadville",
    description:
      "Cocktails in the lobby of an 1886 Victorian hotel — historic, atmospheric, and a perfect early-evening drink before dinner on Harrison.",
    address: "700 Harrison Ave, Leadville, CO 80461",
    lat: 39.2500,
    lng: -106.2916,
    tags: ["romantic", "indoor", "instagrammable", "local_legend"],
    time_slots: ["afternoon", "evening"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },

  // Ski / winter sports
  {
    id: "leadville-ski-cooper",
    name: "Ski Cooper",
    category: "activity",
    neighborhood: "tennessee_pass",
    description:
      "Family-friendly mountain on Tennessee Pass — affordable lift tickets, great beginner terrain, and Chicago Ridge cat skiing for advanced riders.",
    address: "232 County Rd 29, Leadville, CO 80461",
    lat: 39.3700,
    lng: -106.3247,
    tags: ["kid_friendly",  "outdoor", "view", "mid_range", "group_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends", "couple"],
    price_level: 2,
    source_url: "https://www.skicooper.com/",
  },
  {
    id: "leadville-mineral-belt-trail-winter",
    name: "Mineral Belt Trail (Winter Nordic)",
    category: "activity",
    neighborhood: "leadville",
    description:
      "11.6-mile paved loop groomed for nordic skiing and fat biking in winter — circles Leadville with views of Massive and Elbert.",
    address: "Mineral Belt Trail, Leadville, CO 80461",
    lat: 39.2470,
    lng: -106.2920,
    tags: ["dog_friendly", "outdoor", "view", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "solo", "friends"],
    price_level: 0,
  },
  {
    id: "leadville-tennessee-pass-nordic",
    name: "Tennessee Pass Nordic Center",
    category: "activity",
    neighborhood: "tennessee_pass",
    description:
      "25 km of groomed XC ski and snowshoe trails, plus the famous Cookhouse yurt dinner — one of Colorado's best nordic destinations.",
    address: "Ski Cooper Area, Leadville, CO 80461",
    lat: 39.3705,
    lng: -106.3303,
    tags: ["dog_friendly", "outdoor", "view", "mid_range", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends"],
    price_level: 2,
    source_url: "https://tennesseepass.com/",
  },

  // Summer adventure
  {
    id: "leadville-mount-elbert",
    name: "Mount Elbert (Northeast Ridge)",
    category: "activity",
    neighborhood: "san_isabel_nf",
    description:
      "Colorado's highest peak (14,440 ft) and the most-summited 14er in the state. Class 1 trail; start at dawn to beat afternoon storms.",
    address: "Halfmoon Creek Rd, Leadville, CO 80461",
    lat: 39.1178,
    lng: -106.4453,
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },
  {
    id: "leadville-mount-massive",
    name: "Mount Massive",
    category: "activity",
    neighborhood: "san_isabel_nf",
    description:
      "Colorado's second-highest peak (14,428 ft) — quieter and less-summited than neighboring Elbert, with a longer, more scenic ridge.",
    address: "Halfmoon Creek Rd, Leadville, CO 80461",
    lat: 39.1875,
    lng: -106.4753,
    tags: ["outdoor", "view", "hidden_gem", "instagrammable"],
    time_slots: ["morning"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },
  {
    id: "leadville-la-plata-peak",
    name: "La Plata Peak (Northwest Ridge)",
    category: "activity",
    neighborhood: "san_isabel_nf",
    description:
      "Class 2 14er with a more rugged feel than the Sawatch — long approach, scrambly upper ridge, and rewarding 14,343 ft summit.",
    address: "HWY 82, Twin Lakes, CO 81251",
    lat: 39.0294,
    lng: -106.4731,
    tags: ["outdoor", "view", "hidden_gem"],
    time_slots: ["morning"],
    party_types: ["friends", "solo", "couple"],
    price_level: 0,
  },
  {
    id: "leadville-twin-lakes",
    name: "Twin Lakes Paddleboarding & Sailing",
    category: "activity",
    neighborhood: "twin_lakes",
    description:
      "Glacier-carved alpine lakes beneath Mount Elbert — paddleboarding, kayaking, and sailing on water that mirrors Colorado's highest peak.",
    address: "HWY 82, Twin Lakes, CO 81251",
    lat: 39.0817,
    lng: -106.3811,
    tags: ["dog_friendly", "outdoor", "view", "instagrammable", "waterfront", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "friends"],
    price_level: 1,
  },
  {
    id: "leadville-turquoise-lake",
    name: "Turquoise Lake",
    category: "park",
    neighborhood: "leadville",
    description:
      "6,400-acre reservoir with camping, fishing, paddleboarding, and a flat shoreline trail — the most accessible recreation area in Lake County.",
    address: "Turquoise Lake Rd, Leadville, CO 80461",
    lat: 39.2533,
    lng: -106.4036,
    tags: ["dog_friendly", "outdoor", "view", "waterfront", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "friends"],
    price_level: 0,
  },
  {
    id: "leadville-mount-massive-golf",
    name: "Mt. Massive Golf Course",
    category: "activity",
    neighborhood: "leadville",
    description:
      "America's highest 9-hole golf course — playing at 9,680 ft means your drives carry an extra 10%. Open seasonally.",
    address: "Mount Massive Golf Course, Leadville, CO 80461",
    lat: 39.2300,
    lng: -106.3300,
    tags: ["outdoor", "view", "mid_range", "group_friendly", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends"],
    price_level: 2,
  },
  {
    id: "leadville-elk-mountain-adventures",
    name: "Elk Mountain Adventures (UTV / Dirt Bike / Snowmobile)",
    category: "activity",
    neighborhood: "leadville",
    description:
      "Guided UTV and dirt bike tours in summer; snowmobile tours in winter. Great option when guests want adrenaline without renting gear themselves.",
    address: "Leadville, CO 80461",
    lat: 39.2509,
    lng: -106.2925,
    tags: ["outdoor", "view", "mid_range", "group_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends", "couple"],
    price_level: 3,
    source_url: "https://www.elkmountainadventures.com/tours",
  },
  {
    id: "leadville-arkansas-river-rafting",
    name: "Arkansas River Whitewater Rafting (Browns Canyon area)",
    category: "activity",
    neighborhood: "buena_vista",
    description:
      "Class III-IV rafting on the most-rafted river in the country — Browns Canyon National Monument. Multiple outfitters, ~20 min toward Buena Vista.",
    address: "Browns Canyon, Buena Vista, CO 81211",
    lat: 38.7800,
    lng: -106.0700,
    tags: ["outdoor", "view", "group_friendly",  "mid_range", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends", "couple"],
    price_level: 3,
  },

  // Family / kid-friendly
  {
    id: "leadville-southern-railroad",
    name: "Leadville, Colorado & Southern Railroad",
    category: "activity",
    neighborhood: "leadville",
    description:
      "2.5-hour scenic train ride through the Arkansas River valley — climbs to 11,120 ft past historic mining sites with high-country views.",
    address: "326 E 7th St, Leadville, CO 80461",
    lat: 39.2520,
    lng: -106.2900,
    tags: ["kid_friendly",  "outdoor", "view", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple"],
    price_level: 2,
  },
  {
    id: "leadville-mineral-belt-trail-summer",
    name: "Mineral Belt Trail (Summer Biking)",
    category: "park",
    neighborhood: "leadville",
    description:
      "11.6-mile paved loop suitable for all ages — the easiest way to see Leadville's mining history without leaving pavement.",
    address: "Mineral Belt Trail, Leadville, CO 80461",
    lat: 39.2470,
    lng: -106.2920,
    tags: ["kid_friendly",  "dog_friendly", "outdoor", "view"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "friends"],
    price_level: 0,
  },
  {
    id: "leadville-interlaken-resort",
    name: "Interlaken Historic Resort Hike",
    category: "activity",
    neighborhood: "twin_lakes",
    description:
      "Easy 4-mile out-and-back lakeshore walk to abandoned 1880s resort buildings — restored cabins, a beautiful beach, and Mount Elbert reflections.",
    address: "Twin Lakes south shore, Twin Lakes, CO 81251",
    lat: 39.0744,
    lng: -106.3678,
    tags: ["kid_friendly",  "dog_friendly", "outdoor", "view", "hidden_gem", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "friends"],
    price_level: 0,
  },
  {
    id: "leadville-fish-hatchery",
    name: "Leadville National Fish Hatchery",
    category: "activity",
    neighborhood: "leadville",
    description:
      "Working federal fish hatchery (founded 1889) with display ponds, easy nature trails, and a quiet picnic area — kid-magnet, free entry.",
    address: "2844 US-300, Leadville, CO 80461",
    lat: 39.2444,
    lng: -106.3617,
    tags: ["kid_friendly",  "dog_friendly", "outdoor", "indoor", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple"],
    price_level: 0,
  },

  // Scenic + photo / day drives
  {
    id: "leadville-independence-pass",
    name: "Independence Pass",
    category: "viewpoint",
    neighborhood: "lake_county",
    description:
      "12,095 ft summit on HWY 82 connecting Leadville and Aspen — alpine tundra, marmots, and one of Colorado's most photographed drives. Closed in winter.",
    address: "HWY 82, Twin Lakes, CO 81251",
    lat: 39.1083,
    lng: -106.5639,
    tags: ["outdoor", "view", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 0,
  },
  {
    id: "leadville-top-of-rockies",
    name: "Top of the Rockies Scenic Byway",
    category: "viewpoint",
    neighborhood: "lake_county",
    description:
      "Federally designated National Scenic Byway — HWY 24/91 over Tennessee and Fremont passes with unobstructed 14er views in every direction.",
    address: "HWY 24/91, Leadville, CO 80461",
    lat: 39.2900,
    lng: -106.3000,
    tags: ["outdoor", "view", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 0,
  },
  {
    id: "leadville-hagerman-pass",
    name: "Hagerman Pass Road",
    category: "viewpoint",
    neighborhood: "lake_county",
    description:
      "High-clearance dirt route past historic 1880s railroad tunnels and alpine lakes — best for 4WD and the adventurous half-day driver.",
    address: "Turquoise Lake Rd West, Leadville, CO 80461",
    lat: 39.2680,
    lng: -106.4900,
    tags: ["outdoor", "view", "hidden_gem", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },

  // Indoor / cultural
  {
    id: "leadville-mining-hall-of-fame",
    name: "National Mining Hall of Fame & Museum",
    category: "museum",
    neighborhood: "leadville",
    description:
      "Smithsonian-affiliated mining heritage museum — Congress-designated as the official US mining museum. Best rainy-day stop in town.",
    address: "120 W 9th St, Leadville, CO 80461",
    lat: 39.2533,
    lng: -106.2925,
    tags: ["kid_friendly", "indoor", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "solo"],
    price_level: 1,
    source_url: "https://mininghalloffame.org/",
  },
  {
    id: "leadville-healy-house",
    name: "Healy House Museum & Dexter Cabin",
    category: "museum",
    neighborhood: "leadville",
    description:
      "1878 Victorian home and 1879 cabin showcasing silver-boom Leadville. Tours run summer-only by History Colorado.",
    address: "912 Harrison Ave, Leadville, CO 80461",
    lat: 39.2538,
    lng: -106.2916,
    tags: ["kid_friendly", "indoor", "local_legend", "hidden_gem"],
    time_slots: ["midday", "afternoon"],
    party_types: [ "couple", "solo"],
    price_level: 1,
  },
  {
    id: "leadville-tabor-opera-house",
    name: "Tabor Opera House",
    category: "museum",
    neighborhood: "leadville",
    description:
      "Newly restored 1879 opera house — tours by day, performances by night. Anchor of Harrison Ave's historic district.",
    address: "308 Harrison Ave, Leadville, CO 80461",
    lat: 39.2487,
    lng: -106.2917,
    tags: ["indoor", "local_legend", "instagrammable"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: ["couple",  "friends"],
    price_level: 1,
  },

  // Wildflowers / fall colors / seasonal
  {
    id: "leadville-independence-pass-aspen",
    name: "Independence Pass Aspen Drive (Late September)",
    category: "viewpoint",
    neighborhood: "lake_county",
    description:
      "Peak fall color through Sawatch Range aspen stands — Sunset Magazine's top Colorado fall-foliage pick. Best window: last week of September.",
    address: "HWY 82, Twin Lakes, CO 81251",
    lat: 39.1083,
    lng: -106.5639,
    tags: ["outdoor", "view", "instagrammable", "romantic"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends"],
    price_level: 0,
  },

  // Local quirks / hidden gems
  {
    id: "leadville-matchless-mine",
    name: "Matchless Mine / Baby Doe Tabor Cabin",
    category: "museum",
    neighborhood: "leadville",
    description:
      "The cabin where Baby Doe Tabor froze to death in 1935, guarding her dead husband's mine. Self-guided tours by appointment in summer.",
    address: "E 7th St, Leadville, CO 80461",
    lat: 39.2511,
    lng: -106.2742,
    tags: ["hidden_gem", "outdoor", "local_legend"],
    time_slots: ["midday", "afternoon"],
    party_types: ["couple",  "solo"],
    price_level: 1,
  },
];

// ─── Events (2026) ────────────────────────────────────────────────────────

const EVENTS: EventSeed[] = [
  // Leadville Race Series 2026
  {
    id: "lv-trail-100-mtb-camp-2026",
    name: "Leadville Trail 100 MTB Camp",
    town: "Leadville",
    blurb:
      "Multi-day training camp for the LT100 MTB. Race-Series instruction, course preview, and group rides. Lodging fills out months in advance.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-06-11",
    end_date: "2026-06-14",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-trail-100-run-camp-2026",
    name: "Leadville Trail 100 Run Camp",
    town: "Leadville",
    blurb:
      "Multi-day run-camp for athletes prepping for the August LT100 Run. Course recon, altitude acclimatization, and Race-Series coaching.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-06-19",
    end_date: "2026-06-21",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-marathon-heavy-half-2026",
    name: "Leadville Trail Marathon & Heavy Half",
    town: "Leadville",
    blurb:
      "26.2-mile and 15.5-mile mountain trail races starting in downtown Leadville. The Heavy Half climbs Mosquito Pass at 13,185 ft.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-06-27",
    end_date: "2026-06-27",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-silver-rush-50-run-2026",
    name: "Silver Rush 50 Run",
    town: "Leadville",
    blurb:
      "50-mile high-altitude trail run through Leadville's silver-mining backcountry. Mid-July, four 12,000+ ft climbs.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-07-11",
    end_date: "2026-07-11",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-silver-rush-50-mtb-2026",
    name: "Silver Rush 50 MTB",
    town: "Leadville",
    blurb:
      "50-mile MTB version of Silver Rush. Same course as the run, but on bikes — a popular qualifier for the August LT100 MTB lottery.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-07-12",
    end_date: "2026-07-12",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-mtb-stage-race-2026",
    name: "Leadville MTB Stage Race",
    town: "Leadville",
    blurb:
      "Three-day MTB stage race covering ~120 miles of Leadville singletrack and dirt roads. Smaller field than LT100; serious racer experience.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-07-24",
    end_date: "2026-07-26",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-trail-100-mtb-2026",
    name: "Leadville Trail 100 MTB",
    town: "Leadville",
    blurb:
      "The flagship 100-mile MTB race — \"Race Across the Sky.\" Sub-9:00 finishers earn the legendary big buckle.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-08-15",
    end_date: "2026-08-15",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-trail-10k-run-2026",
    name: "Leadville Trail 10K Run",
    town: "Leadville",
    blurb:
      "Family-friendly 10K on the Mineral Belt Trail — the day after the LT100 MTB. Great option for spectators with their own running ambitions.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-08-16",
    end_date: "2026-08-16",
    official_url: "https://www.leadvilleraceseries.com/",
  },
  {
    id: "lv-trail-100-run-2026",
    name: "Leadville Trail 100 Run",
    town: "Leadville",
    blurb:
      "The original 100-mile high-altitude ultra. 30-hour cutoff, 18,000 ft of climbing, and the hardest finish line in trail running.",
    category: "race",
    date_kind: "fixed",
    start_date: "2026-08-22",
    end_date: "2026-08-22",
    official_url: "https://www.leadvilleraceseries.com/",
  },

  // Leadville annual non-Race-Series
  {
    id: "lv-ski-joring-2026",
    name: "Leadville Ski Joring",
    town: "Leadville",
    blurb:
      "First weekend of March every year — skiers towed by horses down a snow-covered Harrison Ave course. Free to watch; lodging books out fast.",
    category: "festival",
    date_kind: "recurring",
    recurring_rule_text: "First weekend of March",
  },
  {
    id: "lv-boom-days-2026",
    name: "Leadville Boom Days",
    town: "Leadville",
    blurb:
      "First weekend of August. Mining contests, the legendary 21-mile burro race over Mosquito Pass, and a Harrison Ave parade since 1949.",
    category: "festival",
    date_kind: "recurring",
    recurring_rule_text: "First weekend of August",
  },
];

// ─── Apply ────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  console.log(`🔄 Seed Leadville plan${APPLY ? " (APPLY)" : " (PREVIEW)"}\n`);
  console.log(`  ${POIS.length} POIs / ${EVENTS.length} events\n`);

  if (!APPLY) {
    console.log("Categories:");
    const byCat = POIS.reduce<Record<string, number>>((m, p) => {
      m[p.category] = (m[p.category] || 0) + 1;
      return m;
    }, {});
    Object.entries(byCat).forEach(([k, v]) => console.log(`  ${k.padEnd(15)} ${v}`));
    console.log("\nNeighborhoods:");
    const byNbh = POIS.reduce<Record<string, number>>((m, p) => {
      m[p.neighborhood] = (m[p.neighborhood] || 0) + 1;
      return m;
    }, {});
    Object.entries(byNbh).forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}`));
    console.log("\nRe-run with --apply to write.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let upserts = 0;
    for (const p of POIS) {
      await client.query(
        `insert into sp_pois (
           id, name, category, neighborhood, description, address,
           lat, lng, tags, time_slots, party_types, price_level,
           source_url, status, updated_at
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',now())
         on conflict (id) do update set
           name = excluded.name,
           category = excluded.category,
           neighborhood = excluded.neighborhood,
           description = excluded.description,
           address = excluded.address,
           lat = excluded.lat,
           lng = excluded.lng,
           tags = excluded.tags,
           time_slots = excluded.time_slots,
           party_types = excluded.party_types,
           price_level = excluded.price_level,
           source_url = excluded.source_url,
           updated_at = now()`,
        [
          p.id,
          p.name,
          p.category,
          p.neighborhood,
          p.description,
          p.address,
          p.lat,
          p.lng,
          p.tags,
          p.time_slots,
          p.party_types,
          p.price_level,
          p.source_url || null,
        ]
      );
      upserts++;
    }

    let evUpserts = 0;
    for (const e of EVENTS) {
      await client.query(
        `insert into sp_events (
           id, name, town, blurb, category, date_kind,
           start_date, end_date, recurring_rule_text, official_url, poi_id,
           status, updated_at
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',now())
         on conflict (id) do update set
           name = excluded.name,
           town = excluded.town,
           blurb = excluded.blurb,
           category = excluded.category,
           date_kind = excluded.date_kind,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           recurring_rule_text = excluded.recurring_rule_text,
           official_url = excluded.official_url,
           poi_id = excluded.poi_id,
           updated_at = now()`,
        [
          e.id,
          e.name,
          e.town,
          e.blurb,
          e.category,
          e.date_kind,
          e.start_date || null,
          e.end_date || null,
          e.recurring_rule_text || null,
          e.official_url || null,
          e.poi_id || null,
        ]
      );
      evUpserts++;
    }

    await client.query("COMMIT");
    console.log(`✅ Seeded ${upserts} POIs and ${evUpserts} events`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("\n❌ Seed failed:", e);
  process.exit(1);
});
