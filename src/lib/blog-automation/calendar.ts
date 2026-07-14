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
    status: "pending",
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
