// src/lib/landing-pages.ts
//
// /s/[slug] landing pages — Colorado-only. Every entry below is
// production-rendered SEO content for one of our active marketing
// slugs. Footer + property-card "Related" links currently target:
// pet-friendly, large-groups, family-friendly, hot-tubs, fireplace.
//
// HISTORY (2026-05-27, Codex #14): this file previously held ~30
// Portland-era landing pages (alberta, pearl-district, near-ohsu,
// luxury, budget-friendly, etc.) that were already retired via 301
// redirects in next.config.ts and filtered out of sitemap +
// autocomplete by `isRetiredLandingSlug()` in
// src/lib/landing-page-paths.ts. They still shipped in the bundle
// (~5500 lines / ~200KB of dead Portland prose) and confused future
// readers of the file. Stripped them — keep this file Colorado-only.
//
// To add a new landing page: copy one of the entries below as a
// template, add the new slug to footer.tsx if it should be linked,
// and (if you ever resurrect a retired Portland-named slug like
// "luxury") remove the slug from RETIRED_LANDING_SLUGS in
// landing-page-paths.ts AND remove the matching 301 from
// next.config.ts.

export interface LandingPageConfig {
  slug: string;
  title: string;
  tagline: string;
  metaDescription: string;
  heroImage: string;
  filters: {
    tags?: string[];
    amenities?: string[]; // BEAPI amenity codes like "HOT_TUB"
    amenityStrings?: string[]; // Full amenity text for post-filter (matched as substrings against listing.amenities)
    petsAllowed?: boolean;
    minOccupancy?: number;
    minBedrooms?: number; // Post-filter: minimum bedroom count (inclusive)
    maxBedrooms?: number; // Post-filter: maximum bedroom count (inclusive)
    minLat?: number; // BEAPI geo bounding box
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  };
  introContent: string[]; // paragraphs
  bottomContent: { question: string; answer: string }[]; // FAQ items
  relatedSlugs: string[];
}

export const LANDING_PAGES: LandingPageConfig[] = [
  // ──────────────────────────────────────────────
  // TAG-BASED PAGES
  // ──────────────────────────────────────────────
  {
    slug: "pet-friendly",
    title: "Pet-Friendly Vacation Rentals in Crested Butte & Leadville",
    tagline: "Bring the whole pack to the Colorado mountains",
    metaDescription:
      "Browse pet-friendly vacation rentals across Crested Butte, Leadville, and the Colorado mountains. Dog-friendly cabins and condos near trailheads, ski lifts, and alpine lakes. Book directly with Book Traverse.",
    heroImage: "/leadville/pet-friendly-rental.jpg",
    filters: { petsAllowed: true },
    introContent: [
      "Colorado is built for dogs — and so are our pet-friendly rentals. From cabins outside Leadville to slopeside condos in Mt. Crested Butte, our homes welcome four-legged travelers without the breed restrictions or surprise fees you'll find on Airbnb or VRBO. Just bring the leash, the food, and the energy — we'll handle the rest.",
      "After a day on the trail or the lift, our pet-friendly rentals are set up for the post-adventure routine: mudrooms for muddy paws, fenced yards or quick walks to open space, and floors that handle a wet retriever just fine. Many properties sit a short drive from off-leash trails — Lower Loop in CB, Mineral Belt in Leadville, and the open BLM land that defines a Colorado mountain town.",
      "Traveling with pets shouldn't mean settling for the worst rental in the catalog. Our pet-friendly collection includes the same homes our human guests love — historic miner's cabins in Leadville, lodge-style condos at Crested Butte Mountain Resort, and lake-adjacent properties at Twin Lakes. Book direct, skip the OTA pet fees, and your dog gets the same view you do.",
    ],
    bottomContent: [
      {
        question: "Is there an extra fee for bringing my pet?",
        answer:
          "Most of our pet-friendly properties include a modest pet fee that covers additional cleaning. The exact fee is listed on each property page before you book — no hidden charges.",
      },
      {
        question: "Are there breed or size restrictions?",
        answer:
          "We do not impose breed or weight restrictions on our pet-friendly properties. We ask that all pets be house-trained and well-behaved. Please let us know how many pets you're bringing when you book.",
      },
      {
        question: "Where can I take my dog off-leash near your rentals?",
        answer:
          "Both Crested Butte and Leadville have abundant off-leash options. In CB, the Lower Loop, Snodgrass, and the Slate River corridor are local favorites. In Leadville, the Mineral Belt Trail and the open public land around Turquoise Lake all welcome well-behaved dogs. Always check current trail conditions and yield to wildlife — black bears, moose, and elk are common.",
      },
      {
        question: "Can I leave my pet at the rental while I go skiing or hiking?",
        answer:
          "We ask that pets not be left unattended for extended periods, especially if they're anxious in new environments. If you need a local pet sitter or doggy daycare during a long day on the mountain, we're happy to share recommendations in CB and Leadville.",
      },
    ],
    relatedSlugs: ["family-friendly", "hot-tubs", "large-groups"],
  },

  {
    slug: "large-groups",
    title: "Large Group Vacation Rentals in Crested Butte & Colorado",
    tagline: "Room for everyone, together under one mountain roof",
    metaDescription:
      "Find large-group vacation rentals across Crested Butte, Leadville, and the Colorado mountains sleeping 8+ guests. Multi-bedroom condos and cabins for ski trips, reunions, and weddings. Book directly with Book Traverse.",
    heroImage: "/markets/crested-butte.jpg",
    filters: { tags: ["Group Getaways"], minOccupancy: 8 },
    introContent: [
      "The best ski trips, family reunions, and mountain weddings happen under one roof — and our group-sized rentals are built for it. Whether it's eight friends chasing a powder weekend at Crested Butte Mountain Resort, fifteen extended-family members converging on Leadville for the holidays, or a dozen athletes in town for the Leadville Race Series, we have multi-bedroom homes that keep everyone together without anyone fighting for the second bathroom.",
      "Our group rentals span the full Colorado portfolio: 4–6 bedroom condos at the Grand Lodge and Lodge at Mountaineer Square (steps from the Silver Queen lift), historic Victorians and modern cabins in downtown Leadville, lakeside homes at Twin Lakes, and townhomes near Vail and Avon. Most have open kitchens with two ovens, big dining tables, hot tubs, and gear-storage layouts that make sense after a day on the mountain.",
      "Booking one big property is almost always cheaper and more memorable than splitting a group across hotel rooms. Our team plans dozens of group trips a year — bachelor weekends, corporate offsites, multi-generational ski weeks, summer wildflower retreats — and we'll help you match the right property to your group's vibe. Just reach out.",
    ],
    bottomContent: [
      {
        question: "What's the largest group you can accommodate?",
        answer:
          "Several of our properties sleep 12–16+ guests across multiple bedrooms. If your group is larger, we can coordinate bookings at neighboring properties so everyone stays in the same building or neighborhood — common at the Grand Lodge or in downtown Leadville.",
      },
      {
        question: "Are your large-group homes suitable for weddings or events?",
        answer:
          "Some are. Crested Butte and Leadville are popular wedding destinations, and several of our larger properties welcome rehearsal dinners, welcome parties, or small ceremonies. Tell us what you're planning when you inquire and we'll match you with a property that fits. Quiet hours and neighbor courtesy policies apply.",
      },
      {
        question: "Can we get an early check-in for a large group?",
        answer:
          "We do our best to accommodate early check-in requests, especially for groups arriving from out of state with mountain-pass conditions in play. Let us know your travel plans and we'll confirm timing at least 48 hours before your stay.",
      },
      {
        question: "Is there a discount for longer group stays?",
        answer:
          "Yes — most properties offer weekly and monthly discounts that apply automatically at checkout. For stays of a week or longer (common during ski week or race weekends), reach out directly and we can often offer additional group pricing.",
      },
    ],
    relatedSlugs: ["family-friendly", "pet-friendly", "hot-tubs"],
  },

  {
    slug: "family-friendly",
    title: "Family-Friendly Vacation Rentals in the Colorado Mountains",
    tagline: "Mountain trips the whole family will remember",
    metaDescription:
      "Browse family-friendly vacation rentals in Crested Butte, Leadville, Vail, and across the Colorado mountains. Kid-ready cabins and condos with bunks, gear storage, and walkable access to lifts and trails. Book directly with Book Traverse.",
    heroImage: "/markets/leadville.jpg",
    filters: { tags: ["Family Friendly"] },
    introContent: [
      "The Colorado mountains are made for kids — and our family-friendly rentals are set up to make the trip easier on the parents. Bunk rooms for the cousins, full kitchens for the early-morning pancake situation, gear closets for the ski boots and bike helmets, and floor plans that give the adults somewhere to sit when the small humans finally fall asleep. We pre-vet every family listing for the practical stuff: bedroom layout, walkable access to town, and gear storage.",
      "The best part of staying in a vacation rental with kids is the space to spread out. No hotel-room tiptoeing at bedtime, no overpriced room service — just a real kitchen, a real living room, and a full driveway for the SUV with the cargo box. Our family homes sit close to the things kids actually love in CB and Leadville: the Adventure Park gondola, the Tennessee Pass Nordic Center, the train ride out of Leadville, the chairlifts at Crested Butte Mountain Resort.",
      "We know mountain travel with kids has a long checklist — passes, gear rentals, altitude rules, weather windows. Our team puts together a quick orientation note for every family booking with the local highlights, the rainy-day backups, and the food spots that won't melt down at 6 PM with three hungry kids. Many of our family homes also welcome pets, so the dog comes too.",
    ],
    bottomContent: [
      {
        question: "Do your family-friendly homes include cribs or pack-n-plays?",
        answer:
          "Many do — check the amenities list on each property page, or reach out and we'll confirm what's available. If a property doesn't include one, we can usually arrange a local rental drop-off before you arrive.",
      },
      {
        question: "What family activities are near your rentals?",
        answer:
          "Plenty. In Crested Butte: the Adventure Park (summer ziplines and gondola rides), wildflower hikes on Snodgrass, the free downtown shuttle. In Leadville: the Mineral Belt Trail, the Leadville Colorado & Southern Railroad ride, Turquoise Lake, and the National Mining Hall of Fame. The /plan trip planner on our site builds custom day-by-day itineraries by age and interest.",
      },
      {
        question: "Are your properties safe for kids at altitude?",
        answer:
          "Most of our properties sit between 8,800 ft (CB) and 10,150 ft (Leadville). Kids handle altitude differently than adults — drink more water, take it slow on day one, and skip the high-elevation hike until day two. Our welcome notes include altitude tips and pediatric urgent-care info.",
      },
      {
        question: "Can I book a property with both kid and pet amenities?",
        answer:
          "Yes — many of our family-friendly homes are also pet-friendly. Use the filters on the search page or reach out and we'll narrow it down for you.",
      },
    ],
    relatedSlugs: ["pet-friendly", "large-groups", "hot-tubs"],
  },

  // ──────────────────────────────────────────────
  // AMENITY PAGES
  // ──────────────────────────────────────────────
  {
    slug: "hot-tubs",
    title: "Vacation Rentals with Hot Tubs in Crested Butte & Leadville",
    tagline: "Soak under the stars after a day on the mountain",
    metaDescription:
      "Browse Colorado mountain vacation rentals with private hot tubs in Crested Butte, Leadville, and Twin Lakes. Unwind after a powder day or a 14er hike in your own outdoor spa. Book directly with Book Traverse.",
    heroImage: "/leadville/hot-tub-rental.jpg",
    filters: { amenities: ["HOT_TUB"] },
    introContent: [
      "There are few better ways to end a day in the Colorado mountains than sinking into a hot tub under a sky full of stars. Whether you've been chasing powder at Crested Butte Mountain Resort, climbing Mount Elbert, or biking the Mineral Belt Trail, our hot tub rentals turn the post-adventure routine into the highlight of the trip. These properties feature private hot tubs — no shared resort pools, no time limits, just you, the steam, and the alpine air.",
      "Our hot tub homes range from slope-side condos at the Grand Lodge and Lodge at Mountaineer Square to historic Victorian cottages and modern cabins in Leadville. Many pair the hot tub with other mountain-cozy touches: gas fireplaces, gear-drying rooms, big windows on the peaks, and outdoor decks that catch the late-afternoon sun. They're a favorite for ski weekends, anniversary trips, and shoulder-season stays when the snowmelt creeks are roaring.",
      "Every hot tub is professionally maintained and treated between guests. Water quality, cover condition, and chemistry are inspected on a fixed schedule. Just pack your swimsuit (or don't — it's your private tub) and pour something warm.",
    ],
    bottomContent: [
      {
        question: "Are the hot tubs private?",
        answer:
          "Yes. All of our hot tub properties feature private hot tubs — usually on a deck, patio, or balcony. They are not shared with other guests or neighbors. A few of our condos at the Lodge at Mountaineer Square include access to the building's shared pool/hot tub complex in addition to or instead of an in-unit tub; those are noted on the property page.",
      },
      {
        question: "Are hot tubs available year-round?",
        answer:
          "Absolutely. Hot tubs are kept open and maintained year-round. Soaking in a Colorado hot tub when it's snowing or after a 14er hike is a peak experience.",
      },
      {
        question: "How often are the hot tubs cleaned?",
        answer:
          "Hot tubs are drained and refilled on a regular schedule and chemistry-treated between every guest stay. We provide simple usage instructions at each property — typical things like rinsing off before getting in and keeping the cover on when not in use.",
      },
    ],
    relatedSlugs: ["fireplace", "family-friendly", "pet-friendly"],
  },

  {
    slug: "fireplace",
    title: "Vacation Rentals with Fireplaces in Crested Butte & Leadville",
    tagline: "Cozy up after a day on the mountain",
    metaDescription:
      "Find Colorado mountain vacation rentals with fireplaces in Crested Butte, Leadville, and beyond. Wood-burning hearths and gas fireplaces for ski-weekend coziness. Book directly with Book Traverse.",
    heroImage: "/markets/leadville.jpg",
    filters: { amenities: ["INDOOR_FIREPLACE"] },
    introContent: [
      "There's a specific Colorado mountain ritual: ski boots come off, the fire goes on, the kettle goes on the stove, and the rest of the evening writes itself. Our fireplace rentals are built for that. From historic Victorian cottages with wood-burning hearths in Leadville to modern slope-side condos with gas fireplaces in Mt. Crested Butte, every fireplace listing in our portfolio has a working hearth that's the centerpiece of the living room.",
      "Many of our fireplace properties pair the hearth with the rest of the mountain-cozy stack: hot tubs on the deck, gear-drying mudrooms, big windows on the peaks, and oversized sectionals that fit the whole group. They're our most-booked category from November through April, when the snow is falling and the days are short, but they earn their keep year-round — Colorado nights cool off fast even in July.",
      "A fireplace changes the entire mood of a stay. It turns a rental into a retreat. Whether you're in town for a powder weekend at Crested Butte Mountain Resort, a Leadville Race Series weekend, or a quiet anniversary trip, our fireplace homes set the tone.",
    ],
    bottomContent: [
      {
        question: "Are the fireplaces wood-burning or gas?",
        answer:
          "It varies by property. Some of our historic Leadville and Twin Lakes properties have original wood-burning fireplaces (firewood is provided or available locally); most of our slope-side CB condos have gas fireplaces that turn on with a switch or remote. Each property listing specifies the type.",
      },
      {
        question: "Can I use the fireplace during summer months?",
        answer:
          "Gas fireplaces can be used year-round. Wood-burning fireplaces may have temporary restrictions during high fire-danger conditions or red-flag warnings — we'll note the current status at check-in if relevant.",
      },
      {
        question: "Are fireplace properties good for romantic getaways?",
        answer:
          "Absolutely. Fireplace rentals are among our most-booked properties for anniversaries, honeymoons, and quiet weekends. Pair one with a hot tub and a snowstorm and you have the canonical Colorado mountain weekend.",
      },
    ],
    relatedSlugs: ["hot-tubs", "family-friendly", "pet-friendly"],
  },
];

export function getLandingPage(slug: string): LandingPageConfig | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return LANDING_PAGES.map((p) => p.slug);
}
