// Mapping of neighborhood slug → relevant trip plan slugs. Used by
// /neighborhoods/[slug] to surface a "See a trip built around here" block,
// flowing SEO juice from 10 neighborhood pages to the 5 plan pages.
//
// Each neighborhood lists the 2-3 plans that meaningfully feature it. Order
// reflects relevance (first = strongest match).

import { getPlanSlug, type PlanSlugEntry } from "./slug-map";

const MAP: Record<string, readonly string[]> = {
  "pearl-district": [
    "portland-weekend-itinerary",
    "portland-food-itinerary",
    "portland-neighborhoods-tour",
  ],
  "alberta-arts-district": [
    "portland-neighborhoods-tour",
    "portland-weekend-itinerary",
  ],
  "hawthorne-belmont": [
    "portland-neighborhoods-tour",
    "portland-food-itinerary",
    "portland-with-kids-itinerary",
  ],
  "nob-hill": [
    "portland-weekend-itinerary",
    "portland-food-itinerary",
    "portland-outdoors-itinerary",
  ],
  "mississippi-avenue": [
    "portland-neighborhoods-tour",
    "portland-food-itinerary",
  ],
  sellwood: ["portland-neighborhoods-tour", "portland-with-kids-itinerary"],
  "ne-portland": ["portland-neighborhoods-tour", "portland-weekend-itinerary"],
  "se-portland": [
    "portland-neighborhoods-tour",
    "portland-food-itinerary",
    "portland-with-kids-itinerary",
  ],
  "nw-portland": [
    "portland-outdoors-itinerary",
    "portland-weekend-itinerary",
    "portland-food-itinerary",
  ],
  "north-portland": ["portland-neighborhoods-tour", "portland-food-itinerary"],
  "mt-hood": ["portland-outdoors-itinerary"],
};

export function getPlansForNeighborhood(
  neighborhoodSlug: string
): PlanSlugEntry[] {
  const slugs = MAP[neighborhoodSlug] ?? [];
  const entries: PlanSlugEntry[] = [];
  for (const s of slugs) {
    const entry = getPlanSlug(s);
    if (entry) entries.push(entry);
  }
  return entries;
}
