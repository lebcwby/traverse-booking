// src/lib/portland-pois.ts
//
// HISTORY: This file originally held the curated Portland POI dataset that
// powered the "Nearby Attractions" + "Where you'll be" sections on
// /properties/[id]. As of 2026-05-27 the site is Colorado-only and there is
// no curated Colorado POI dataset shipped here — those sections fall back
// to whatever address/transit/neighborhood text is present on the listing.
//
// Kept (for now):
//   - The Poi / NearbyPoi / PoiCategory types, which several property-detail
//     components still import for their props.
//   - getNearbyPois() with an empty POIS list, so existing call sites compile
//     and return [] without surfacing Portland coffee shops on Colorado
//     listings.
//
// TODO: when a curated Colorado POI dataset lands (likely seeded from
// sp_pois), replace POIS with it and rename this file to colorado-pois.ts
// (or just nearby-pois.ts).

export type PoiCategory =
  | "dining"
  | "coffee"
  | "parks"
  | "shopping"
  | "transit"
  | "attractions";

export interface Poi {
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  description?: string;
}

export interface NearbyPoi extends Poi {
  walkMinutes: number;
}

// Empty until a Colorado POI dataset is added. See header comment.
export const POIS: Poi[] = [];

/**
 * Find the closest POIs to a given lat/lng. Currently returns [] because
 * POIS is empty (see file header). Signature preserved so consumers don't
 * need to change.
 */
export function getNearbyPois(
  _lat: number,
  _lng: number,
  _opts: { limit?: number; maxWalkMinutes?: number } = {}
): NearbyPoi[] {
  return [];
}

/** Category display labels. */
export const CATEGORY_LABELS: Record<PoiCategory, string> = {
  dining: "Dining",
  coffee: "Coffee",
  parks: "Parks & Outdoors",
  shopping: "Shopping",
  transit: "Transit",
  attractions: "Attractions",
};
