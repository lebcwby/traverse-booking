// Seed Crested Butte POIs + 2026 events for /plan.
//
// Run: npx tsx --env-file=.env.local scripts/seed-crested-butte-plan.ts          # preview
//      npx tsx --env-file=.env.local scripts/seed-crested-butte-plan.ts --apply  # write
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
  /**
   * Defaults to "active". Set to "closed" to keep the entry in source for
   * documentation but exclude it from every agent query (see queries.ts +
   * poi-preload.ts which both filter status="active").
   */
  status?: "active" | "closed" | "draft";
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
  // Eat — breakfast / brunch
  {
    id: "cb-paradise-cafe",
    name: "Paradise Cafe",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Your favorite hometown diner but in Crested Butte! An amazing fast-casual breakfast — locals' go-to. Get there early before the crowds.",
    address: "303 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8694,
    lng: -106.9874,
    tags: ["kid_friendly",  "cheap_eats", "indoor", "local_legend"],
    time_slots: ["morning", "midday"],
    party_types: [ "couple", "solo", "friends"],
    price_level: 2,
  },
  {
    id: "cb-mcgills",
    name: "McGill's at Crested Butte",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Brunch isn't just a meal here, it's a delightful experience. Must-try: the Classic Benedict — a brunch lover's favorite.",
    address: "228 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9873,
    tags: [ "mid_range", "indoor", "kid_friendly"],
    time_slots: ["morning", "midday"],
    party_types: [ "couple", "friends"],
    price_level: 2,
  },
  {
    id: "cb-butte-bagels",
    name: "Butte Bagels",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Crested Butte's premier breakfast sandwiches and coffee. Quick grab-and-go — must-try the Lox.",
    address: "212 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9871,
    tags: ["kid_friendly", "cheap_eats", "indoor"],
    time_slots: ["morning", "midday"],
    party_types: [ "solo", "couple", "friends"],
    price_level: 1,
  },
  {
    id: "cb-gas-cafe-one-stop",
    name: "Gas Cafe One Stop",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Gas station with killer sandwiches and a convenience store all wrapped into one — an award-winning sandwich stop. Must-try the Hurley Breakfast Sandwich.",
    address: "206 6th St, Crested Butte, CO 81224",
    lat: 38.8688,
    lng: -106.9866,
    tags: ["cheap_eats", "indoor", "local_legend", "hidden_gem"],
    time_slots: ["morning", "midday"],
    party_types: [ "solo", "couple", "friends"],
    price_level: 1,
  },
  {
    id: "cb-a-daily-dose",
    name: "A Daily Dose",
    category: "coffee",
    neighborhood: "crested_butte",
    description:
      "Juice bar and café — smoothies, salads, espresso. Healthy, homemade fare. Must-try: Purple Haze smoothie or avocado toast. Breakfast and lunch only.",
    address: "419 6th St, Crested Butte, CO 81224",
    lat: 38.8696,
    lng: -106.9872,
    tags: ["mid_range", "indoor", "vegan_options", "gluten_free_options", "kid_friendly"],
    time_slots: ["morning", "midday"],
    party_types: ["solo", "couple",  "friends"],
    price_level: 2,
  },
  {
    id: "cb-t-bar-tea-house",
    name: "T-Bar Tea House",
    category: "coffee",
    neighborhood: "crested_butte",
    description:
      "International tea house — Crested Butte's hidden gem. Must-try: Honey Cold Brew Matcha or Salted Caramel Hojicha Latte.",
    address: "Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9870,
    tags: ["mid_range", "indoor", "hidden_gem", "vegan_options"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["solo", "couple", "friends"],
    price_level: 2,
  },

  // Eat — lunch / dinner
  {
    id: "cb-the-secret-stash",
    name: "The Secret Stash",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Buzzy outpost for innovative pizzas — fun, family-friendly favorite known for creative pies and a lively atmosphere. Must-try: the Crack Fries.",
    address: "21 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8688,
    lng: -106.9899,
    tags: ["kid_friendly",  "group_friendly", "mid_range", "indoor", "local_legend"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: [ "friends", "couple"],
    price_level: 2,
  },
  {
    // Closed (out of business as of 2026-05). Kept here so future seed runs
    // don't accidentally re-activate; status="closed" filters it out of
    // every agent query (see src/lib/pois/queries.ts + poi-preload.ts).
    id: "cb-bruhaus",
    name: "BruHaus",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Crested Butte's premier beer hall — great après-ski with craft beers and hearty pub-style meals. Must-try: the BruHaus Double Burger.",
    address: "228 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9873,
    tags: ["group_friendly", "mid_range", "indoor", "live_music"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends", "couple"],
    price_level: 2,
    status: "closed",
  },
  {
    // Dinner-only — kitchen doesn't open for breakfast or lunch (verified by
    // Nadim 2026-05). Keep time_slots = ["evening"] so the agent only ever
    // recommends it for dinner.
    id: "cb-the-breadery",
    name: "The Breadery",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Farm-to-table bakery-restaurant — homemade sourdough, creative seasonal plates, and unique flavor pairings. Open for dinner only.",
    address: "Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9874,
    tags: ["mid_range", "indoor", "vegan_options", "gluten_free_options", "hidden_gem"],
    time_slots: ["evening"],
    party_types: ["couple",  "solo", "friends"],
    price_level: 2,
  },
  {
    id: "cb-public-house",
    name: "Public House",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Artsy spot for local beer and diverse eats — sit-down dinner with a lively, social atmosphere. Must-try: the Elk Meatloaf.",
    address: "202 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9869,
    tags: ["group_friendly", "mid_range", "indoor", "live_music"],
    time_slots: ["evening", "late"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    id: "cb-teocalli-tamale",
    name: "Teocalli Tamale",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Vibrant outpost for Mexican street food — build your perfect burrito, bowl, or tamale. Fast, fresh, and flavorful.",
    address: "311 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8694,
    lng: -106.9876,
    tags: ["kid_friendly",  "cheap_eats", "indoor", "vegan_options", "gluten_free_options"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: [ "solo", "couple", "friends"],
    price_level: 2,
  },
  {
    id: "cb-pitas-in-paradise",
    name: "Pita's in Paradise",
    category: "restaurant",
    neighborhood: "crested_butte",
    description:
      "Chill stop for Mediterranean grub — relaxed Mediterranean-style sports bar with games on TV. Must-try: the OG Pita or the Third Bowl.",
    address: "212 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9871,
    tags: [ "group_friendly", "cheap_eats", "indoor", "vegan_options"],
    time_slots: ["midday", "afternoon", "evening"],
    party_types: [ "friends", "couple", "solo"],
    price_level: 2,
  },

  // Drink
  {
    id: "cb-montanya-distillers",
    name: "Montanya Distillers",
    category: "bar",
    neighborhood: "crested_butte",
    description:
      "Award-winning craft rum distillery and tasting room with mountain-inspired cocktails — multiple Good Food Awards.",
    address: "212 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9871,
    tags: ["romantic", "mid_range", "indoor", "instagrammable", "local_legend"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["couple", "friends"],
    price_level: 3,
  },
  {
    id: "cb-brick-oven-pub",
    name: "Brick Oven Pizzeria & Pub",
    category: "bar",
    neighborhood: "crested_butte",
    description:
      "30+ taps with the best beer selection in town, plus pizza by the slice — beloved après hangout.",
    address: "223 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8693,
    lng: -106.9872,
    tags: ["group_friendly", "mid_range", "indoor", "kid_friendly"],
    time_slots: ["afternoon", "evening", "late"],
    party_types: ["friends",  "couple"],
    price_level: 2,
    status: "closed",
  },

  // Ski / winter sports
  {
    id: "cb-mountain-resort",
    name: "Crested Butte Mountain Resort",
    category: "activity",
    neighborhood: "mt_crested_butte",
    description:
      "Legendary expert terrain (the Extremes) plus solid intermediate cruisers — one of Colorado's most respected ski mountains. Lift tickets, lessons, rentals on-site.",
    address: "12 Snowmass Rd, Mt. Crested Butte, CO 81225",
    lat: 38.8997,
    lng: -106.9658,
    tags: [ "outdoor", "view", "group_friendly", "splurge", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends", "couple"],
    price_level: 4,
    source_url: "https://www.skicb.com/",
  },
  {
    id: "cb-nordic-center",
    name: "Crested Butte Nordic Center",
    category: "activity",
    neighborhood: "crested_butte",
    description:
      "55+ km of groomed XC ski and snowshoe trails right from town — top-rated nordic center in Colorado.",
    address: "620 Second St, Crested Butte, CO 81224",
    lat: 38.8689,
    lng: -106.9889,
    tags: ["dog_friendly", "outdoor", "view", "kid_friendly", "mid_range"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 2,
    source_url: "https://cbnordic.org/",
  },
  {
    id: "cb-irwin-cat-skiing",
    name: "Irwin Guides — Backcountry Cat Skiing",
    category: "activity",
    neighborhood: "kebler_pass",
    description:
      "Snowcat skiing on legendary Kebler Pass powder — one of Colorado's deepest snow zones. Featured in Powder and SKI Magazine.",
    address: "Kebler Pass Rd, Crested Butte, CO 81224",
    lat: 38.8950,
    lng: -107.1000,
    tags: ["splurge", "outdoor", "view", "group_friendly", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["friends", "couple"],
    price_level: 4,
  },
  {
    id: "cb-mushing-mutts",
    name: "Mushing Mutts (Dog Sledding)",
    category: "activity",
    neighborhood: "ohio_city",
    description:
      "Dog-sled tours with Mushing Mutts — winter excursions in the Gunnison National Forest about an hour from CB. Family-friendly bucket-list winter activity.",
    address: "8647 Co Rd 76, Ohio City, CO 81237",
    lat: 38.5644,
    lng: -106.6011,
    tags: ["kid_friendly",  "outdoor", "view", "instagrammable", "mid_range"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple", "friends"],
    price_level: 3,
  },

  // Summer adventure
  {
    id: "cb-lower-loop",
    name: "Lower Loop Trail",
    category: "activity",
    neighborhood: "crested_butte",
    description:
      "Easy/intermediate ride or hike with Slate River views — CB's most accessible classic. Singletracks top-100 trail.",
    address: "Peanut Lake Rd, Crested Butte, CO 81224",
    lat: 38.8770,
    lng: -106.9920,
    tags: ["dog_friendly", "outdoor", "view", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 0,
  },
  {
    id: "cb-401-trail",
    name: "401 Trail",
    category: "activity",
    neighborhood: "gothic",
    description:
      "Bucket-list singletrack through wildflower fields with Maroon Bells views — frequently named one of America's best MTB rides.",
    address: "Schofield Pass Rd, Crested Butte, CO 81224",
    lat: 38.9750,
    lng: -107.0220,
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["friends", "couple", "solo"],
    price_level: 0,
  },
  {
    id: "cb-snodgrass-trail",
    name: "Snodgrass Trail",
    category: "activity",
    neighborhood: "mt_crested_butte",
    description:
      "Flowy intermediate ride with wildflowers and Paradise Divide vistas — MTB Project five-star classic.",
    address: "Off Gothic Rd, Mt. Crested Butte, CO 81225",
    lat: 38.9100,
    lng: -106.9700,
    tags: ["outdoor", "view", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["friends", "couple", "solo"],
    price_level: 0,
  },
  {
    id: "cb-oh-be-joyful",
    name: "Oh Be Joyful Trail",
    category: "activity",
    neighborhood: "crested_butte",
    description:
      "Hike to waterfalls and an alpine basin near Slate River — cited in 5280 as one of CB's best hikes.",
    address: "Slate River Rd, Crested Butte, CO 81224",
    lat: 38.9050,
    lng: -107.0250,
    tags: ["dog_friendly", "outdoor", "view", "instagrammable", "kid_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends"],
    price_level: 0,
  },
  {
    id: "cb-taylor-river-fishing",
    name: "Taylor River Fly Fishing",
    category: "activity",
    neighborhood: "almont",
    description:
      "Gold Medal trout water in a dramatic canyon — listed in Field & Stream's top trout streams. Outfitters in nearby Almont.",
    address: "HWY 742, Almont, CO 81210",
    lat: 38.6650,
    lng: -106.8470,
    tags: ["outdoor", "view", "splurge", "waterfront"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 3,
  },
  {
    id: "cb-whitewater-rafting",
    name: "Taylor & Gunnison River Whitewater Rafting",
    category: "activity",
    neighborhood: "almont",
    description:
      "Class II-III rafting on the Taylor and Gunnison rivers — multiple outfitters near Almont. Family-friendly half-day trips and full-day adventures.",
    address: "HWY 742, Almont, CO 81210",
    lat: 38.6650,
    lng: -106.8470,
    tags: ["outdoor", "view", "group_friendly",  "mid_range", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends", "couple"],
    price_level: 3,
  },

  // Family / kid-friendly
  {
    id: "cb-adventure-park",
    name: "Adventure Park at Crested Butte Mountain Resort",
    category: "activity",
    neighborhood: "mt_crested_butte",
    description:
      "Mini-golf, bungee, climbing wall, and the Red Lady Express scenic chair — top family draw at the base in summer.",
    address: "12 Snowmass Rd, Mt. Crested Butte, CO 81225",
    lat: 38.8997,
    lng: -106.9658,
    tags: ["kid_friendly",  "outdoor", "view", "instagrammable", "mid_range"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "friends"],
    price_level: 3,
  },
  {
    id: "cb-big-mine-park",
    name: "Big Mine Park (Skate Park, Pump Track, Playground)",
    category: "park",
    neighborhood: "crested_butte",
    description:
      "Free in-town playground, pump track, and skate features — local family go-to.",
    address: "2nd & Whiterock, Crested Butte, CO 81224",
    lat: 38.8688,
    lng: -106.9882,
    tags: ["kid_friendly",  "outdoor", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [],
    price_level: 0,
  },
  {
    id: "cb-lake-grant",
    name: "Lake Grant / Long Lake",
    category: "park",
    neighborhood: "washington_gulch",
    description:
      "Mellow alpine lake suitable for SUP and shore picnics — family-friendly, accessible alpine spot.",
    address: "Washington Gulch Rd, Crested Butte, CO 81224",
    lat: 38.9180,
    lng: -107.0150,
    tags: ["kid_friendly",  "outdoor", "view", "waterfront", "dog_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [ "couple"],
    price_level: 0,
  },
  {
    id: "cb-storybook-trail",
    name: "Storybook Trail (Lower Loop)",
    category: "activity",
    neighborhood: "crested_butte",
    description:
      "First section of the Lower Loop Trail with illustrated story panels at intervals — perfect for young kids on a stroller-friendly nature walk.",
    address: "Peanut Lake Rd, Crested Butte, CO 81224",
    lat: 38.8770,
    lng: -106.9920,
    tags: ["kid_friendly",  "outdoor", "dog_friendly", "view", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [],
    price_level: 0,
  },
  {
    id: "cb-trailhead-childrens-museum",
    name: "Trailhead Children's Museum",
    category: "museum",
    neighborhood: "crested_butte",
    description:
      "Hands-on children's museum on Elk Ave with interactive exhibits — ideal rainy-day family stop.",
    address: "501 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8696,
    lng: -106.9866,
    tags: ["kid_friendly",  "indoor"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: [],
    price_level: 1,
  },

  // Scenic + photo / day drives
  {
    id: "cb-kebler-pass",
    name: "Kebler Pass",
    category: "viewpoint",
    neighborhood: "kebler_pass",
    description:
      "One of North America's largest aspen groves — legendary fall-color drive. Featured in Sunset and 5280 fall foliage stories.",
    address: "CR 12, Crested Butte, CO 81224",
    lat: 38.8500,
    lng: -107.1500,
    tags: ["outdoor", "view", "instagrammable", "romantic"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 0,
  },
  {
    id: "cb-gothic-schofield",
    name: "Gothic Road to Schofield Pass",
    category: "viewpoint",
    neighborhood: "gothic",
    description:
      "Past historic Gothic townsite to wildflower meadows and Emerald Lake — Conde Nast Traveler scenic-drive pick.",
    address: "Gothic Rd, Mt. Crested Butte, CO 81225",
    lat: 38.9580,
    lng: -106.9900,
    tags: ["outdoor", "view", "instagrammable"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple",  "friends", "solo"],
    price_level: 0,
  },
  {
    id: "cb-paradise-divide-loop",
    name: "Paradise Divide Loop",
    category: "viewpoint",
    neighborhood: "kebler_pass",
    description:
      "Full-day 4WD/ebike loop linking Kebler, Gothic, and Schofield passes — Outside Magazine bucket-list drive.",
    address: "Loop from town, Crested Butte, CO 81224",
    lat: 38.9200,
    lng: -107.0500,
    tags: ["outdoor", "view", "instagrammable", "hidden_gem"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["couple", "friends", "solo"],
    price_level: 0,
  },

  // Indoor / cultural
  {
    id: "cb-mountain-heritage-museum",
    name: "Crested Butte Mountain Heritage Museum",
    category: "museum",
    neighborhood: "crested_butte",
    description:
      "Local mining and ski history including the birth-of-MTB exhibit — Smithsonian-affiliated small museum.",
    address: "331 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8694,
    lng: -106.9876,
    tags: ["kid_friendly", "indoor", "local_legend", "hidden_gem"],
    time_slots: ["midday", "afternoon"],
    party_types: [ "couple", "solo"],
    price_level: 1,
  },
  {
    id: "cb-center-for-the-arts",
    name: "Center for the Arts",
    category: "museum",
    neighborhood: "crested_butte",
    description:
      "Year-round live music, theater, films, and gallery shows — recently renovated regional cultural hub.",
    address: "606 Sixth St, Crested Butte, CO 81224",
    lat: 38.8702,
    lng: -106.9866,
    tags: ["indoor", "live_music", "kid_friendly"],
    time_slots: ["afternoon", "evening"],
    party_types: ["couple",  "friends"],
    price_level: 2,
  },
  {
    id: "cb-townie-books",
    name: "Townie Books & Rumors Coffee",
    category: "shop",
    neighborhood: "crested_butte",
    description:
      "Bookstore-cafe combo — classic rainy-afternoon hideaway. Beloved indie bookshop on Elk Ave.",
    address: "414 Elk Ave, Crested Butte, CO 81224",
    lat: 38.8695,
    lng: -106.9881,
    tags: ["indoor", "kid_friendly", "hidden_gem", "solo_friendly"],
    time_slots: ["morning", "midday", "afternoon"],
    party_types: ["solo", "couple"],
    price_level: 1,
  },

  // Wildflowers / fall colors / seasonal
  {
    id: "cb-rustler-gulch",
    name: "Rustler Gulch Wildflower Hike",
    category: "activity",
    neighborhood: "gothic",
    description:
      "Peak-July hike through fields of lupine, columbine, and paintbrush — featured in Sunset wildflower guides.",
    address: "Off Gothic Rd, past Gothic, Crested Butte, CO 81224",
    lat: 38.9900,
    lng: -107.0100,
    tags: ["outdoor", "view", "instagrammable", "hidden_gem"],
    time_slots: ["morning", "midday"],
    party_types: ["couple", "friends"],
    price_level: 0,
  },

  // Local quirks / hidden gems
  {
    id: "cb-west-maroon-pass",
    name: "West Maroon Pass to Aspen Hike",
    category: "activity",
    neighborhood: "elk_range",
    description:
      "One-way 10-mile trek over the Elk Range to Aspen with shuttle return — iconic CB-to-Aspen pass, in Backpacker.",
    address: "End of Brush Creek Rd, Crested Butte, CO 81224",
    lat: 38.9450,
    lng: -106.8800,
    tags: ["outdoor", "view", "instagrammable", "local_legend"],
    time_slots: ["morning"],
    party_types: ["friends", "couple", "solo"],
    price_level: 0,
  },
];

// ─── Events (2026) ────────────────────────────────────────────────────────

const EVENTS: EventSeed[] = [
  {
    id: "cb-wildflower-festival-2026",
    name: "Crested Butte Wildflower Festival",
    town: "Crested Butte",
    blurb:
      "40th anniversary in 2026 — 10 days of guided hikes, photography, art, and workshops in Colorado's official Wildflower Capital.",
    category: "festival",
    date_kind: "fixed",
    start_date: "2026-07-10",
    end_date: "2026-07-19",
    official_url: "https://www.crestedbuttewildflowerfestival.org/",
  },
  {
    id: "cb-beer-chili-festival-2026",
    name: "Crested Butte Beer & Chili Festival",
    town: "Crested Butte",
    blurb:
      "Chili cook-off, craft beer tastings, and live music on Elk Ave. One of CB's biggest September weekends.",
    category: "festival",
    date_kind: "fixed",
    start_date: "2026-09-12",
    end_date: "2026-09-12",
  },
  {
    id: "cb-film-festival-2026",
    name: "Crested Butte Film Festival",
    town: "Crested Butte",
    blurb:
      "16th annual independent film festival — four days of screenings, filmmaker Q&As, and parties on Elk Ave.",
    category: "culture",
    date_kind: "fixed",
    start_date: "2026-09-24",
    end_date: "2026-09-27",
    official_url: "https://cbfilmfest.org/",
  },
  {
    id: "cb-music-festival-2026",
    name: "Crested Butte Music Festival",
    town: "Crested Butte",
    blurb:
      "27th season of classical, jazz, and chamber music performances around CB. 2026 dates TBD — typically late June through July.",
    category: "music",
    date_kind: "recurring",
    recurring_rule_text: "Late June through July (typical)",
    official_url: "http://crestedbuttemusicfestival.org/",
  },
  {
    id: "cb-vinotok-2026",
    name: "Vinotok Festival",
    town: "Crested Butte",
    blurb:
      "Pagan-style harvest festival with parades, fortune-telling, the Trial of the Grump, and a Saturday-night bonfire on Elk Ave. Quirky CB tradition covered by Atlas Obscura.",
    category: "festival",
    date_kind: "recurring",
    recurring_rule_text: "Late September (week of autumnal equinox)",
  },
  {
    id: "cb-big-air-on-elk-2026",
    name: "Big Air on Elk",
    town: "Crested Butte",
    blurb:
      "Rail jam and big-air competition on a custom course built down Elk Ave. CBMR pros and amateurs compete in the heart of town.",
    category: "sport",
    date_kind: "recurring",
    recurring_rule_text: "March (typical, around CB Mountain Resort spring events)",
  },
];

// ─── Apply ────────────────────────────────────────────────────────────────

const APPLY = process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  console.log(`🔄 Seed Crested Butte plan${APPLY ? " (APPLY)" : " (PREVIEW)"}\n`);
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
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
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
           status = excluded.status,
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
          p.status ?? "active",
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
