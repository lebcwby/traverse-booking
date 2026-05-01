// src/lib/plan/neighborhood-match.ts
// Match a trip-planner itinerary's POI neighborhoods against Book Traverse's
// listing-tag vocabulary so the sidebar surfaces rentals near (or adjacent to)
// the places the trip actually visits.
//
// Signal strength rules:
//   - Dominant primary: ≥3 POIs mapped to the same primary tag AND that tag
//     has at least 1.5× as many hits as the runner-up. → boost primary.
//   - Quadrant fallback: same rule against quadrant counts when there is no
//     dominant primary. → boost the quadrant.
//   - Otherwise: no signal. Rank listings by quality alone. Showing
//     Portland-wide quality picks is better than arbitrarily weighting one
//     neighborhood on a weak signal.
//
// The POI vocabulary was pulled directly from sp_pois on 2026-04-12 via
// scripts/inspect-poi-neighborhoods.ts. Day-trip slugs (mt_hood, cannon_beach,
// etc.) intentionally map to { null, null } so they don't contribute — there
// are no rentals at those destinations.

import type { Poi } from "@/lib/pois/types";
import type { Listing } from "@/lib/supabase";
import type { Itinerary } from "./schema";

interface MappingEntry {
  // Specific listing tag this POI neighborhood maps to, if any. Matches the
  // vocabulary in src/lib/neighborhoods.ts.
  primary: string | null;
  // Quadrant-level fallback tag. Null for day-trip destinations.
  quadrant: string | null;
}

const POI_NEIGHBORHOOD_TO_TAGS: Record<string, MappingEntry> = {
  // Direct specific-tag matches
  nob_hill: { primary: "NW 23rd", quadrant: "Northwest" },
  hawthorne: { primary: "Hawthorne Belmont", quadrant: "Southeast" },
  alberta: { primary: "Alberta", quadrant: "Northeast" },
  pearl: { primary: "Pearl District", quadrant: "Northwest" },
  sellwood: { primary: "Sellwood Moreland", quadrant: "Southeast" },
  northwest: { primary: "NW 23rd", quadrant: "Northwest" },

  // Adjacent / roll-up (see chat 2026-04-12 for rationale)
  buckman: { primary: "Hawthorne Belmont", quadrant: "Southeast" },
  richmond: { primary: "Hawthorne Belmont", quadrant: "Southeast" },
  division: { primary: "Hawthorne Belmont", quadrant: "Southeast" },
  mt_tabor: { primary: "Hawthorne Belmont", quadrant: "Southeast" },
  woodstock: { primary: "Sellwood Moreland", quadrant: "Southeast" },
  se_industrial: { primary: null, quadrant: "Southeast" },
  kerns: { primary: "Alberta", quadrant: "Northeast" },
  hollywood: { primary: "Alberta", quadrant: "Northeast" },
  lloyd: { primary: null, quadrant: "Northeast" },
  north_portland: { primary: "Mississippi", quadrant: "North" },
  st_johns: { primary: null, quadrant: "North" },
  downtown: { primary: "Pearl District", quadrant: "Northwest" },

  // Day-trip destinations — no Book Traverse inventory, explicitly null so
  // the aggregator knows to ignore them.
  mt_hood: { primary: null, quadrant: null },
  cannon_beach: { primary: null, quadrant: null },
  columbia_gorge: { primary: null, quadrant: null },
  astoria: { primary: null, quadrant: null },
  dundee: { primary: null, quadrant: null },
  carlton: { primary: null, quadrant: null },
  hood_river: { primary: null, quadrant: null },
  mcminnville: { primary: null, quadrant: null },
  seaside: { primary: null, quadrant: null },
  tillamook: { primary: null, quadrant: null },
  turner: { primary: null, quadrant: null },
};

// Canonical display names for every POI neighborhood slug surfaced in the UI.
// Anything not in this map falls through to a generic prettifier (underscores
// → spaces, title case). The map covers edge cases the prettifier can't get
// right: directionals (SE/NW), abbreviations (Mt./St.), and proper-noun casing
// (McMinnville).
const NEIGHBORHOOD_DISPLAY: Record<string, string> = {
  alberta: "Alberta",
  astoria: "Astoria",
  buckman: "Buckman",
  cannon_beach: "Cannon Beach",
  carlton: "Carlton",
  columbia_gorge: "Columbia Gorge",
  division: "Division",
  downtown: "Downtown",
  dundee: "Dundee",
  hawthorne: "Hawthorne",
  hollywood: "Hollywood",
  hood_river: "Hood River",
  kerns: "Kerns",
  lloyd: "Lloyd District",
  mcminnville: "McMinnville",
  mississippi: "Mississippi",
  mt_hood: "Mt. Hood",
  mt_tabor: "Mt. Tabor",
  ne_28th: "NE 28th",
  nob_hill: "Nob Hill",
  north_portland: "North Portland",
  northwest: "Northwest",
  nw_23rd: "NW 23rd",
  pearl: "Pearl District",
  richmond: "Richmond",
  se_industrial: "SE Industrial",
  seaside: "Seaside",
  sellwood: "Sellwood",
  st_johns: "St. Johns",
  sunnyside: "Sunnyside",
  tillamook: "Tillamook",
  turner: "Turner",
  woodstock: "Woodstock",
};

/**
 * Render a POI neighborhood slug as a human-readable label.
 *
 * - `nob_hill` → `Nob Hill`
 * - `se_industrial` → `SE Industrial`
 * - `mcminnville` → `McMinnville`
 * - Unknown slug `foo_bar` → `Foo Bar` (generic fallback)
 * - Empty / `"other"` / `"unknown"` → `""` (caller decides how to handle)
 */
export function formatNeighborhood(slug: string | null | undefined): string {
  if (!slug) return "";
  const lower = slug.toLowerCase().trim();
  if (!lower || lower === "other" || lower === "unknown") return "";
  const mapped = NEIGHBORHOOD_DISPLAY[lower];
  if (mapped) return mapped;
  return lower
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export interface NeighborhoodMatch {
  primaryTags: string[];
  quadrantTags: string[];
  hasSignal: boolean;
}

const EMPTY_MATCH: NeighborhoodMatch = {
  primaryTags: [],
  quadrantTags: [],
  hasSignal: false,
};

function toPoiSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

// The agent sometimes stores anchorNeighborhood as a POI slug ("pearl") and
// sometimes as a listing-tag label ("Pearl District"). Try both shapes.
function resolveAnchorMapping(anchor: string): MappingEntry | null {
  const slug = toPoiSlug(anchor);
  if (POI_NEIGHBORHOOD_TO_TAGS[slug]) return POI_NEIGHBORHOOD_TO_TAGS[slug];

  const lowered = anchor.trim().toLowerCase();
  for (const entry of Object.values(POI_NEIGHBORHOOD_TO_TAGS)) {
    if (entry.primary && entry.primary.toLowerCase() === lowered) return entry;
    if (entry.quadrant && entry.quadrant.toLowerCase() === lowered)
      return entry;
  }
  return null;
}

export function matchItineraryNeighborhood(
  itinerary: Itinerary,
  poisById: Map<string, Poi>
): NeighborhoodMatch {
  const primaryCounts = new Map<string, number>();
  const quadrantCounts = new Map<string, number>();

  const addVote = (mapping: MappingEntry, weight = 1) => {
    if (mapping.primary) {
      primaryCounts.set(
        mapping.primary,
        (primaryCounts.get(mapping.primary) ?? 0) + weight
      );
    }
    if (mapping.quadrant) {
      quadrantCounts.set(
        mapping.quadrant,
        (quadrantCounts.get(mapping.quadrant) ?? 0) + weight
      );
    }
  };

  for (const day of itinerary.days) {
    for (const item of day.items) {
      const poi = poisById.get(item.poiId);
      if (!poi) continue;
      const mapping = POI_NEIGHBORHOOD_TO_TAGS[poi.neighborhood];
      if (!mapping) continue;
      addVote(mapping, 1);
    }
  }

  if (itinerary.anchorNeighborhood) {
    const anchorMapping = resolveAnchorMapping(itinerary.anchorNeighborhood);
    if (anchorMapping) addVote(anchorMapping, 3);
  }

  const primaries = [...primaryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const quadrants = [...quadrantCounts.entries()].sort((a, b) => b[1] - a[1]);

  const [topPrimary, runnerUpPrimary] = primaries;
  const [topQuadrant, runnerUpQuadrant] = quadrants;

  const hasStrongPrimary =
    topPrimary != null &&
    topPrimary[1] >= 3 &&
    (runnerUpPrimary == null || topPrimary[1] >= runnerUpPrimary[1] * 1.5);

  const hasStrongQuadrant =
    topQuadrant != null &&
    topQuadrant[1] >= 3 &&
    (runnerUpQuadrant == null || topQuadrant[1] >= runnerUpQuadrant[1] * 1.5);

  if (hasStrongPrimary) {
    // Include any secondary primary with ≥2 hits so multi-neighborhood trips
    // (a Pearl-anchored itinerary with a Hawthorne day) still boost both.
    const primaryTags = primaries.filter(([, n]) => n >= 2).map(([tag]) => tag);
    const quadrantTags = hasStrongQuadrant ? [topQuadrant![0]] : [];
    return { primaryTags, quadrantTags, hasSignal: true };
  }

  if (hasStrongQuadrant) {
    return {
      primaryTags: [],
      quadrantTags: [topQuadrant![0]],
      hasSignal: true,
    };
  }

  return EMPTY_MATCH;
}

// Reorder a quality-ranked list so listings tagged with a matched primary
// float to the top, listings tagged with the matched quadrant come next, and
// everything else falls to the tail. rankListings order is preserved within
// each tier.
export function boostListingsByNeighborhood(
  listings: Listing[],
  match: NeighborhoodMatch
): Listing[] {
  if (!match.hasSignal || listings.length === 0) return listings;

  const primarySet = new Set(match.primaryTags);
  const quadrantSet = new Set(match.quadrantTags);

  const primary: Listing[] = [];
  const quadrant: Listing[] = [];
  const other: Listing[] = [];

  for (const listing of listings) {
    const tags = listing.tags ?? [];
    if (tags.some((t) => primarySet.has(t))) {
      primary.push(listing);
    } else if (tags.some((t) => quadrantSet.has(t))) {
      quadrant.push(listing);
    } else {
      other.push(listing);
    }
  }

  return [...primary, ...quadrant, ...other];
}
