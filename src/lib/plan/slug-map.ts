// SEO slug → pre-seeded trip plan mapping. Each slug resolves to the newest
// sp_plans row with the matching cache_key. Rendered server-side at
// /plan/[slug] as an indexable SEO surface.
//
// Slugs are chosen for keyword match (pulled Ahrefs vol/difficulty 2026-04-24):
//   portland-food-itinerary          — "portland food tour" 300/7, long-tail food itinerary
//   portland-outdoors-itinerary      — topical, no direct keyword
//   portland-neighborhoods-tour      — topical, no direct keyword
//   portland-weekend-itinerary       — "portland weekend itinerary" 30/1 (TP 800)
//   portland-with-kids-itinerary     — "portland with kids" 250/0 (TP 1000)
//
// Old slugs (portland-food-weekend, portland-outdoors-weekend,
// portland-classic-weekend) 301 to the new ones via next.config.ts redirects.
//
// To add a slug: add an entry here, ensure a cached plan exists with the
// corresponding cacheKey (seeded via scripts/seed-popular-ideas.ts), and
// it becomes crawlable on next deploy.

export interface PlanSlugEntry {
  slug: string;
  cacheKey: string;
  h1: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  idealFor: string;
  keywords: string[];
}

export const PLAN_SLUGS: Record<string, PlanSlugEntry> = {
  "crested-butte-food-itinerary": {
    slug: "crested-butte-food-itinerary",
    cacheKey: "premade:food",
    h1: "A Crested Butte Food Itinerary",
    subtitle:
      "Two days of the best breakfast, restaurants, and craft drinks on Elk Avenue — built by the team that manages 80+ homes in Crested Butte.",
    metaTitle: "Crested Butte Food Itinerary — 2-Day Weekend Food Tour",
    metaDescription:
      "A 2-day Crested Butte food itinerary from locals who manage 80+ rentals. Paradise Cafe, The Secret Stash, Public House, Montanya rum — with map and matching vacation homes.",
    idealFor:
      "Food-first travelers visiting Crested Butte for a long weekend who want to eat like a local, not a tourist.",
    keywords: [
      "crested butte food itinerary",
      "crested butte restaurants",
      "crested butte weekend food tour",
      "best food spots crested butte",
    ],
  },
  "leadville-14er-itinerary": {
    slug: "leadville-14er-itinerary",
    cacheKey: "premade:outdoors",
    h1: "A Leadville 14er Weekend",
    subtitle:
      "Mount Elbert or Mount Massive, Twin Lakes paddleboarding, and a scenic drive over Independence Pass — from your Leadville basecamp.",
    metaTitle: "Leadville 14er Weekend Itinerary — 3-Day Outdoor Adventure",
    metaDescription:
      "A 3-day Leadville outdoors itinerary with Mount Elbert, Twin Lakes, and Independence Pass. Built by locals who manage 80+ Leadville homes — map, real places, and rentals.",
    idealFor:
      "Hikers and 14er-baggers who want a high-altitude basecamp with great food and a hot tub waiting back at the cabin.",
    keywords: [
      "leadville itinerary",
      "leadville 14er weekend",
      "mount elbert trip",
      "leadville colorado outdoors",
    ],
  },
  "crested-butte-history-arts-tour": {
    slug: "crested-butte-history-arts-tour",
    cacheKey: "premade:neighborhoods",
    h1: "A Crested Butte History & Arts Tour",
    subtitle:
      "Elk Avenue's historic district, the Mountain Heritage Museum, the Center for the Arts, and Townie Books — the local-life CB itinerary.",
    metaTitle: "Crested Butte History & Arts Tour — 2-Day Itinerary",
    metaDescription:
      "A 2-day Crested Butte arts and history itinerary covering the Heritage Museum, Center for the Arts, and Elk Avenue. Written by locals who manage 80+ CB homes.",
    idealFor:
      "Travelers who want to see how Crested Butte actually lives — beyond the ski lifts and the wildflower festival.",
    keywords: [
      "crested butte history",
      "crested butte arts",
      "elk avenue crested butte",
      "things to do crested butte downtown",
    ],
  },
  "crested-butte-weekend-itinerary": {
    slug: "crested-butte-weekend-itinerary",
    cacheKey: "premade:classic",
    h1: "A Crested Butte Weekend Itinerary",
    subtitle:
      "Crested Butte's greatest hits in two days — Elk Avenue, the mountain, a wildflower hike, and dinner with a view.",
    metaTitle: "Crested Butte Weekend Itinerary — 2 Days of the Classics",
    metaDescription:
      "A classic 2-day Crested Butte weekend itinerary from the team that manages 80+ vacation rentals. The Secret Stash, Lower Loop Trail, the gondola, and a craft cocktail.",
    idealFor:
      "First-time Crested Butte visitors and anyone planning a two-night long-weekend escape.",
    keywords: [
      "crested butte weekend itinerary",
      "crested butte 2 day itinerary",
      "weekend in crested butte",
      "first time crested butte",
    ],
  },
  "colorado-mountains-with-kids-itinerary": {
    slug: "colorado-mountains-with-kids-itinerary",
    cacheKey: "premade:kids",
    h1: "A Colorado Mountains Itinerary with Kids",
    subtitle:
      "A 2-day weekend in Crested Butte or Leadville built for families — Storybook Trail, the scenic train, fish hatchery, and the Children's Museum.",
    metaTitle: "Crested Butte & Leadville with Kids — Family Weekend Itinerary",
    metaDescription:
      "A 2-day Colorado mountains itinerary for families. The Trailhead Children's Museum, Leadville Railroad, Storybook Trail — from locals who manage 160+ family-friendly Colorado rentals.",
    idealFor:
      "Families visiting Crested Butte or Leadville with kids aged 5–12 who want hands-on activities, low-altitude wins, and a great hot tub at the rental.",
    keywords: [
      "crested butte with kids",
      "leadville with kids",
      "colorado family weekend",
      "family things to do crested butte",
    ],
  },
};

export function getPlanSlug(slug: string): PlanSlugEntry | null {
  return PLAN_SLUGS[slug] ?? null;
}

export function allPlanSlugs(): PlanSlugEntry[] {
  return Object.values(PLAN_SLUGS);
}

// Old slug → new slug. Used by next.config.ts for 301 redirects and kept in
// code so future renames are easy to audit. Portland-era slugs are mapped
// to their closest Colorado equivalents post-rebrand (2026-05-05).
export const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
  "portland-food-weekend": "crested-butte-food-itinerary",
  "portland-outdoors-weekend": "leadville-14er-itinerary",
  "portland-classic-weekend": "crested-butte-weekend-itinerary",
  "portland-food-itinerary": "crested-butte-food-itinerary",
  "portland-outdoors-itinerary": "leadville-14er-itinerary",
  "portland-neighborhoods-tour": "crested-butte-history-arts-tour",
  "portland-weekend-itinerary": "crested-butte-weekend-itinerary",
  "portland-with-kids-itinerary": "colorado-mountains-with-kids-itinerary",
};
