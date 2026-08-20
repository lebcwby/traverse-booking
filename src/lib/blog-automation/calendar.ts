// Blog content calendar — every 3 days, the cron picks the next entry whose
// `status` is "pending" and whose `publishDate` is on or before today.
//
// To add a post: append a new entry. To mark one done: change status to "done".
// The wildflower post is "done" because it was seeded by hand from the original
// .md file (see src/app/blog/crested-butte-wildflower-season-guide-2026/).

import type { BlogPost } from "@/app/blog/posts";

export type Pillar =
  | "destination"
  | "owner-education"
  | "seo-anchor"
  | "guest-experience";

export interface CalendarEntry {
  /** Final url slug. Must match the folder name under src/app/blog/. */
  slug: string;
  publishDate: string; // YYYY-MM-DD
  title: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  pillar: Pillar;
  market: BlogPost["market"];
  category: BlogPost["category"];
  /** One-paragraph brief Claude uses to seed the post. */
  brief: string;
  status: "pending" | "in_progress" | "done";
}

export const CONTENT_CALENDAR: CalendarEntry[] = [
  {
    slug: "crested-butte-wildflower-season-guide-2026",
    publishDate: "2026-05-12",
    title: "Crested Butte Wildflower Season: The Insider's Guide (2026)",
    primaryKeyword: "Crested Butte wildflower season",
    secondaryKeywords: [
      "Crested Butte Wildflower Festival 2026",
      "best wildflower hikes Crested Butte",
    ],
    pillar: "destination",
    market: "crested-butte",
    category: "Crested Butte",
    brief:
      "Seasonal guide to wildflower bloom timing, the 2026 Wildflower Festival (July 10–19, 40th anniversary), best hikes (Trail 403, Snodgrass, West Maroon Pass), and lodging at Grand Lodge.",
    status: "done",
  },
  {
    slug: "what-to-pack-colorado-mountain-trip",
    publishDate: "2026-05-15",
    title: "What to Pack for a Colorado Mountain Trip",
    primaryKeyword: "what to pack Colorado mountain trip",
    secondaryKeywords: ["Colorado packing list", "altitude packing essentials"],
    pillar: "guest-experience",
    market: "company",
    category: "Travel Tips",
    brief:
      "Practical packing list for guests visiting Crested Butte, Leadville, Vail. Covers layers, altitude prep, sun protection, footwear by season, and what you can leave at home because the rental provides it.",
    status: "done",
  },
  {
    slug: "best-hiking-near-leadville-colorado",
    publishDate: "2026-05-18",
    title: "Best Hiking Near Leadville, Colorado",
    primaryKeyword: "hiking near Leadville Colorado",
    secondaryKeywords: [
      "Mount Elbert trail",
      "Mineral Belt Trail Leadville",
      "Colorado Trail Leadville",
    ],
    pillar: "destination",
    market: "leadville",
    category: "Leadville",
    brief:
      "Hiking guide for Leadville: Mount Elbert (14er, 4.3 mi North Trail), Mount Massive, Mineral Belt Trail (12.5 mi loop), Colorado Trail access points, Twin Lakes trailheads. Difficulty + season + access notes.",
    status: "done",
  },
  {
    slug: "crested-butte-vacation-rental-income",
    publishDate: "2026-05-21",
    title: "How Much Can You Earn Renting Your Crested Butte Condo?",
    primaryKeyword: "Crested Butte vacation rental income",
    secondaryKeywords: [
      "STR income Crested Butte",
      "Grand Lodge rental revenue",
    ],
    pillar: "owner-education",
    market: "owners",
    category: "For Owners",
    brief:
      "Owner-education post on revenue expectations for a Crested Butte short-term rental. Covers seasonality (Dec–Feb peak, July wildflower peak), occupancy norms, OTA vs direct mix, the case for Traverse management. No fabricated stats.",
    status: "done",
  },
  {
    slug: "leadville-colorado-vacation-rentals-booking-guide",
    publishDate: "2026-05-24",
    title:
      "Leadville Colorado Vacation Rentals: The Complete Booking Guide",
    primaryKeyword: "Leadville Colorado vacation rentals",
    pillar: "seo-anchor",
    market: "leadville",
    category: "Leadville",
    brief:
      "High-intent SEO anchor: how to choose and book a Leadville rental. Governor's Mansion (3 units, 129 W 8th), Mountain Hideaway Lodge (10 BR, 201 W 8th), direct-book savings, when to book by season.",
    status: "pending",
  },
  {
    slug: "best-restaurants-leadville-colorado",
    publishDate: "2026-05-27",
    title: "Best Restaurants in Leadville CO: Where Locals Actually Eat",
    primaryKeyword: "best restaurants Leadville Colorado",
    pillar: "destination",
    market: "leadville",
    category: "Leadville",
    brief:
      "Local-perspective restaurant guide for Leadville. VERIFY each business is open before naming it. Group by meal/occasion. Avoid Crested Butte restaurant names (see project memory — several CB restaurants are closed; do not name CB-specific restaurants without verifying).",
    status: "pending",
  },
  {
    slug: "leadville-100-race-weekend-where-to-stay",
    publishDate: "2026-05-30",
    title:
      "Leadville 100 Race Weekend: Where to Stay and What to Expect",
    primaryKeyword: "Leadville 100 race weekend where to stay",
    pillar: "destination",
    market: "leadville",
    category: "Leadville",
    brief:
      "Race weekend guide. Leadville Trail 100 Run is August 22, 2026. Lodging strategy (book months ahead), course logistics, spectator spots, crew tips. Pitch Mountain Hideaway Lodge for crews.",
    status: "pending",
  },
  {
    slug: "twin-lakes-colorado-hidden-gem",
    publishDate: "2026-06-02",
    title: "Twin Lakes Colorado: The Hidden Gem Near Leadville",
    primaryKeyword: "Twin Lakes Colorado",
    pillar: "destination",
    market: "leadville",
    category: "Leadville",
    brief:
      "Travel guide to Twin Lakes: ~15 mi from Leadville on Hwy 82, boating/kayaking/fishing, South Mount Elbert trailhead, scenic drives, historic Interlaken site. Day-trip itinerary from a Leadville rental.",
    status: "pending",
  },
  {
    slug: "things-to-do-granby-colorado",
    publishDate: "2026-06-05",
    title: "A Weekend in Granby: Mountain Lakes and Trails",
    primaryKeyword: "things to do Granby Colorado",
    pillar: "destination",
    market: "company",
    category: "Travel Guides",
    brief:
      "Granby weekend itinerary: Lake Granby, Grand Lake village, Rocky Mountain National Park west entrance, Granby Ranch, hot springs. Position Traverse rentals as the base.",
    status: "done",
  },
  {
    slug: "pet-friendly-condos-crested-butte",
    publishDate: "2026-06-08",
    title: "Pet-Friendly Condo Rentals in Crested Butte",
    primaryKeyword: "pet-friendly condos Crested Butte",
    secondaryKeywords: [
      "pet-friendly rentals Crested Butte",
      "dog-friendly condos Crested Butte",
      "Grand Lodge pet policy",
    ],
    pillar: "seo-anchor",
    market: "crested-butte",
    category: "Crested Butte",
    brief:
      "SEO anchor for pet-friendly seekers. Traverse manages CONDOS at Grand Lodge Crested Butte (some units are pet-friendly) — we do NOT manage any cabins, so this post must NOT use the word 'cabin' anywhere. Focus on: pet policies at Grand Lodge units Traverse manages, dog-friendly trails around Mt Crested Butte and Gothic Road, vet/groomer notes for the area, tips for arriving with a dog at a slopeside condo (no yard, walkable path to town). Reference the existing detail post `pet-friendly-crested-butte-grand-lodge-153`.",
    status: "pending",
  },

  // ────────────────────────────────────────────────────────────────
  // Batch #2 — 2026-07-15 onward. Fills Vail + Avon coverage gaps,
  // adds more owner-education, and front-loads winter/ski SEO before
  // the Nov–Apr season for indexing lift. Every 3 days.
  // ────────────────────────────────────────────────────────────────

  {
    slug: "vail-vacation-rentals-guide",
    publishDate: "2026-07-15",
    title: "Vail Vacation Rentals: A Local's Guide to Where to Stay",
    primaryKeyword: "Vail vacation rentals",
    secondaryKeywords: [
      "Vail Colorado condos",
      "where to stay in Vail",
      "Vail Village rentals",
    ],
    pillar: "seo-anchor",
    market: "company",
    category: "Travel Guides",
    brief:
      "SEO anchor for the Vail market — the Traverse portfolio includes Vail rentals so this post has real inventory to point to. Cover: how to choose between Vail Village vs Lionshead vs West Vail vs East Vail; ski-in/ski-out vs walkable-to-lift; typical size ranges and party fit; comparison of booking direct with Traverse vs OTAs (up to 15% savings). End with a CTA to `/vail` (booktraverse.com/vail). Do NOT invent specific unit numbers or amenities — describe the market, not individual listings.",
    status: "pending",
  },
  {
    slug: "avon-colorado-vacation-rentals",
    publishDate: "2026-07-18",
    title: "Avon Colorado Vacation Rentals: Base Camp for Beaver Creek and Vail",
    primaryKeyword: "Avon Colorado vacation rentals",
    secondaryKeywords: [
      "Beaver Creek lodging",
      "Avon condos",
      "cheaper alternative to Vail",
    ],
    pillar: "seo-anchor",
    market: "company",
    category: "Travel Guides",
    brief:
      "SEO anchor for Avon — position it as the value-play for skiing Beaver Creek and Vail without paying Vail Village prices. Cover: Avon's location vs Beaver Creek gondola (walkable from many Avon condos), free town shuttle to the mountain, comparison to Vail (typically 20-40% cheaper for similar-size units), what's walkable in town, and when Avon makes more sense than Vail. Link to `/avon` (booktraverse.com/avon).",
    status: "pending",
  },
  {
    slug: "crested-butte-property-management-guide",
    publishDate: "2026-07-21",
    title: "Crested Butte Property Management: What to Look For",
    primaryKeyword: "Crested Butte property management",
    secondaryKeywords: [
      "short-term rental management Crested Butte",
      "STR property manager Colorado",
      "vacation rental management company Colorado",
    ],
    pillar: "seo-anchor",
    market: "owners",
    category: "For Owners",
    brief:
      "High-intent SEO anchor targeting condo owners searching for a Crested Butte management company. Cover: what a full-service PM does (marketing, listings, guest comms, cleaning, maintenance, tax, revenue management), the questions owners should ask when comparing PMs (fee structure, transparency, direct-booking capability, guest-rating track record), and how Traverse specifically approaches Crested Butte (~50 Grand Lodge units, boots-on-the-ground, 4.84-star portfolio average, direct-booking channel that saves owners the OTA cut). End with CTA to /property-management. Owner-facing tone — no consumer wanderlust prose.",
    status: "pending",
  },
  {
    slug: "governors-mansion-leadville-guide",
    publishDate: "2026-07-24",
    title: "Governor's Mansion Leadville: Inside a Historic Colorado Rental",
    primaryKeyword: "Governor's Mansion Leadville",
    secondaryKeywords: [
      "historic vacation rental Colorado",
      "Leadville historic district lodging",
      "129 W 8th Street Leadville",
    ],
    pillar: "seo-anchor",
    market: "leadville",
    category: "Leadville",
    brief:
      "Property-anchor post for Governor's Mansion at 129 W 8th St, Leadville — a 3-unit historic property Traverse manages. Cover: the building's history in Leadville's National Historic Landmark District, how the 3 units differ (size, group fit), what makes staying in a historic rental different from a modern condo, nearby walking-distance points on Harrison Ave, and how to book. Link to governorsmansion.net and `/leadville`. Facts to hew to: 3 units, 129 W 8th St. Do NOT invent unit-specific amenities without confirming.",
    status: "pending",
  },
  {
    slug: "mountain-hideaway-lodge-large-groups-leadville",
    publishDate: "2026-07-27",
    title: "Mountain Hideaway Lodge: The 10-Bedroom Leadville Rental for Big Groups",
    primaryKeyword: "Leadville large group vacation rental",
    secondaryKeywords: [
      "Mountain Hideaway Lodge Leadville",
      "10 bedroom vacation rental Colorado",
      "Leadville group lodging",
    ],
    pillar: "seo-anchor",
    market: "leadville",
    category: "Leadville",
    brief:
      "Property-anchor post for Mountain Hideaway Lodge at 201 W 8th St, Leadville — a 10-bedroom Victorian lodge Traverse manages for large groups. Cover: who this property is for (family reunions, wedding parties, ski groups, race crews for Leadville Trail 100 or Leadville Marathon), what a 10-bedroom Victorian actually feels like day-to-day (common areas, dining, gathering spaces), booking timing for large groups, and comparison to booking multiple smaller rentals. Link to mountainhideaway.com. Facts: 10-bedroom, Victorian, 201 W 8th St.",
    status: "pending",
  },
  {
    slug: "vacation-rental-minimum-nights-colorado",
    publishDate: "2026-07-30",
    title: "How Many Nights Should You Require for Your Colorado STR?",
    primaryKeyword: "vacation rental minimum stay",
    secondaryKeywords: [
      "STR minimum nights",
      "short-term rental strategy Colorado",
      "how many nights minimum Airbnb",
    ],
    pillar: "owner-education",
    market: "owners",
    category: "For Owners",
    brief:
      "Owner-education post on minimum-night policy. Cover: how minimum-night settings affect occupancy vs ADR (average daily rate) vs total revenue, when to use higher mins (peak weeks: Christmas, President's Day, spring break, wildflower peak, Leadville 100 weekend) vs lower mins (shoulder seasons), the tradeoff of turnover cost vs booked-nights, why 2-night minimums are the industry default and when to deviate. Reference Traverse's approach across CB / Leadville / Vail without inventing specific policies. Owner-facing, practical, no fabricated stats.",
    status: "pending",
  },
  {
    slug: "winter-driving-colorado-mountains",
    publishDate: "2026-08-02",
    title: "Winter Driving in the Colorado Rockies: What Guests Need to Know",
    primaryKeyword: "winter driving Colorado mountains",
    secondaryKeywords: [
      "driving to Vail in winter",
      "I-70 chain law Colorado",
      "renting AWD Colorado ski trip",
    ],
    pillar: "guest-experience",
    market: "company",
    category: "Travel Tips",
    brief:
      "Practical safety guide for guests driving into Colorado mountain rentals in winter. Cover: Colorado's chain law and traction requirements (Passenger Vehicle Traction Law + Chain Law), when they get enforced (I-70 during storms, CO-135 to CB, US-24 to Leadville), 2WD vs AWD reality, snow tires vs all-seasons, avoiding I-70 peak-storm windows, tips for arriving at high-altitude condos safely, what to have in the car (chains, water, blanket). Positioned as helpful pre-trip prep, not fear-mongering. Fact-check chain law specifics against Colorado DOT — use qualitative language where dates/rules would need verification.",
    status: "pending",
  },
  {
    slug: "ski-in-ski-out-crested-butte-mountain-resort",
    publishDate: "2026-08-05",
    title: "Ski-In Ski-Out Rentals at Crested Butte Mountain Resort",
    primaryKeyword: "ski-in ski-out Crested Butte",
    secondaryKeywords: [
      "slopeside condos Crested Butte",
      "walkable to lifts Crested Butte",
      "Grand Lodge ski-in ski-out",
    ],
    pillar: "seo-anchor",
    market: "crested-butte",
    category: "Crested Butte",
    brief:
      "High-intent winter SEO for CB ski-in / ski-out seekers. Cover: what 'ski-in ski-out' actually means at CBMR (Grand Lodge is at the base of the Silver Queen lift — literally walk out and click in), the practical difference between true slopeside vs 'a short walk' properties, why families and multi-day skiers value it, and how Traverse's ~50 Grand Lodge units position guests. Include CBMR building facts (indoor/outdoor heated pool, hot tubs, steam room, keyless entry, free town shuttle every 15 min). Publish 3 months before ski season so it indexes for winter searches. Link to /crested-butte and to the Grand Lodge building page.",
    status: "pending",
  },
  {
    slug: "crested-butte-ski-season-2026-2027",
    publishDate: "2026-08-08",
    title: "When Does Crested Butte Ski Season Start? The 2026-27 Guide",
    primaryKeyword: "Crested Butte ski season 2026",
    secondaryKeywords: [
      "Crested Butte opening day 2026",
      "when to ski Crested Butte",
      "CBMR season pass",
    ],
    pillar: "destination",
    market: "crested-butte",
    category: "Crested Butte",
    brief:
      "Timely pre-season post covering the 2026-27 CBMR season. Cover: typical opening-day timing (late November — do NOT commit to a specific date without confirming with CBMR), Epic Pass access (CBMR is a Vail Resorts property), how the ski calendar breaks down (opening weekend, Thanksgiving, Christmas, MLK, President's, spring break, closing weekend around early April), when snow is most reliable (mid-Dec through Feb — averages ~300 inches/year), when to book by season, and why booking direct through Traverse saves up to 15%. Publish in August so it starts indexing before searches peak in Sept-Nov.",
    status: "pending",
  },
  {
    slug: "ski-cooper-vs-vail-family-alternative",
    publishDate: "2026-08-11",
    title: "Ski Cooper vs Vail: A Family-Friendly Alternative Near Leadville",
    primaryKeyword: "Ski Cooper Colorado",
    secondaryKeywords: [
      "family ski resort Colorado",
      "small ski resort near Vail",
      "ski Cooper Leadville",
    ],
    pillar: "destination",
    market: "leadville",
    category: "Leadville",
    brief:
      "Positioning post: Ski Cooper is the small, family-friendly resort ~10 mi north of Leadville — an approachable alternative when Vail is overwhelming or too expensive. Cover: what makes Cooper different (short lift lines, all-ages terrain, way lower ticket prices, less crowded), who it's a great fit for (young kids, learners, budget-conscious families, seasoned skiers wanting a quiet powder day), day-tripping to Cooper from a Leadville rental vs staying near Vail, and how it stacks up against Vail on a $/day-per-person basis. Verify Cooper facts qualitatively — avoid quoting specific 2026-27 prices without checking.",
    status: "pending",
  },
];

/**
 * Pick the next post the cron should generate.
 * Returns the earliest pending entry whose publishDate is today or in the past.
 * Returns null if nothing is due.
 */
export function pickNextDue(today: Date = new Date()): CalendarEntry | null {
  const todayStr = today.toISOString().slice(0, 10);
  const due = CONTENT_CALENDAR.filter(
    (e) => e.status === "pending" && e.publishDate <= todayStr,
  ).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  return due[0] ?? null;
}
