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
  "portland-food-itinerary": {
    slug: "portland-food-itinerary",
    cacheKey: "premade:food",
    h1: "A Portland Food Itinerary",
    subtitle:
      "Two days of the best coffee, food carts, and kitchens in Portland — built by the team that manages 275+ homes in the city.",
    metaTitle: "Portland Food Itinerary — 2-Day Weekend Food Tour",
    metaDescription:
      "A 2-day Portland food itinerary from locals who manage 275+ rentals. Coffee, food carts, James Beard kitchens, craft beer — with map and matching vacation homes.",
    idealFor:
      "Food-first travelers visiting Portland for a long weekend who want to eat like a local, not a tourist.",
    keywords: [
      "portland food itinerary",
      "portland food tour",
      "portland weekend food tour",
      "best food spots portland",
    ],
  },
  "portland-outdoors-itinerary": {
    slug: "portland-outdoors-itinerary",
    cacheKey: "premade:outdoors",
    h1: "A Portland Outdoors Itinerary",
    subtitle:
      "Forest hikes, waterfalls, viewpoints, and Gorge day trips — all from your Portland basecamp.",
    metaTitle: "Portland Outdoors Itinerary — 3-Day Parks, Hikes, and Views",
    metaDescription:
      "A 3-day Portland outdoors itinerary with Forest Park, the Columbia Gorge, and Mt. Hood day trips. Built by Portlanders who manage 275+ homes — map, real places, and rentals.",
    idealFor:
      "Hikers, trail runners, and travelers who want nature on the doorstep without giving up a great coffee or dinner.",
    keywords: [
      "portland outdoors itinerary",
      "portland hiking weekend",
      "3 days in portland outdoors",
      "portland nature trip",
    ],
  },
  "portland-neighborhoods-tour": {
    slug: "portland-neighborhoods-tour",
    cacheKey: "premade:neighborhoods",
    h1: "A Portland Neighborhoods Tour",
    subtitle:
      "Alberta, Hawthorne, Mississippi, the Pearl — the neighborhoods locals actually go to.",
    metaTitle: "Portland Neighborhoods Tour — 2-Day Itinerary",
    metaDescription:
      "A 2-day Portland neighborhoods tour covering Alberta, Hawthorne, Mississippi, and the Pearl. Written by Portlanders who manage 275+ homes — with map and matching rentals.",
    idealFor:
      "Travelers who want to see how Portland actually lives, not just the downtown loop.",
    keywords: [
      "portland neighborhoods itinerary",
      "best portland neighborhoods",
      "portland neighborhood tour",
    ],
  },
  "portland-weekend-itinerary": {
    slug: "portland-weekend-itinerary",
    cacheKey: "premade:classic",
    h1: "A Portland Weekend Itinerary",
    subtitle:
      "Portland's greatest hits in two days — coffee, food carts, Powell's, a craft brewery, and one big view.",
    metaTitle: "Portland Weekend Itinerary — 2 Days of the Classics",
    metaDescription:
      "A classic 2-day Portland weekend itinerary from the team that manages 275+ vacation rentals. Powell's, food carts, Forest Park, a brewery — with map and matching homes.",
    idealFor:
      "First-time Portland visitors and anyone planning a two-night weekend escape.",
    keywords: [
      "portland weekend itinerary",
      "portland 2 day itinerary",
      "weekend in portland",
      "first time portland",
    ],
  },
  "portland-with-kids-itinerary": {
    slug: "portland-with-kids-itinerary",
    cacheKey: "premade:kids",
    h1: "A Portland Itinerary with Kids",
    subtitle:
      "A 2-day Portland weekend built for families — kid-friendly food, parks, and hands-on outings from the team that manages 275+ vacation homes.",
    metaTitle: "Portland with Kids — Family Weekend Itinerary",
    metaDescription:
      "A 2-day Portland itinerary with kids from locals who manage 275+ family-friendly rentals. Kid-friendly restaurants, parks, hands-on activities, and matching vacation homes.",
    idealFor:
      "Families visiting Portland with kids aged 5–12 who want a mix of food, parks, and one memorable outing without endless car time.",
    keywords: [
      "portland with kids",
      "portland itinerary with kids",
      "portland family weekend",
      "family things to do in portland",
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
// code so future renames are easy to audit. The short-lived old slugs have
// <24h of indexed footprint (submitted to Indexing API + IndexNow 2026-04-24);
// a hard 301 is safe.
export const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
  "portland-food-weekend": "portland-food-itinerary",
  "portland-outdoors-weekend": "portland-outdoors-itinerary",
  "portland-classic-weekend": "portland-weekend-itinerary",
};
