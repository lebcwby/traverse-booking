import { searchCardListingsCached } from "@/lib/guesty-beapi";
import { mapBeapiToListing, type BeapiListingResult } from "@/lib/listing-utils";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { type Listing } from "@/lib/supabase";

/**
 * Fetch the bookable units for a Guesty building tag from BEAPI (the live
 * source — the Supabase `listings` table is empty by design), priced and
 * review-enriched, best-reviewed first. Cached at the fetch layer
 * (`searchCardListingsCached`, revalidate 300) so calling this from both the
 * landing page (for the aggregate rating) and the units grid is one cache hit.
 */
export async function fetchUnitsForTag(
  tag: string,
  max = 40,
): Promise<Listing[]> {
  try {
    const data = await searchCardListingsCached({ tags: [tag], limit: max }, 300);
    const results = (data.results || []) as BeapiListingResult[];
    const units = results
      .filter((r) => !!(r.prices?.basePrice && r.prices.basePrice > 0))
      .map(mapBeapiToListing);
    await enrichListingsWithReviewAverages(units);
    units.sort((a, b) => (b.reviewAvg ?? 0) - (a.reviewAvg ?? 0));
    return units;
  } catch {
    return [];
  }
}

export interface UnitRatingSummary {
  /** Weighted average on the 0–5 scale guests recognise. */
  avg5: number;
  /** Total review count across the units. */
  total: number;
  /** How many units contributed a rating. */
  unitCount: number;
}

/**
 * Review-count-weighted aggregate rating across a building's units. `reviewAvg`
 * is stored on Guesty's 0–10 scale; we return it halved to the 0–5 scale.
 * Returns null when no unit has any reviews (so callers can skip the badge).
 */
export function aggregateUnitRating(units: Listing[]): UnitRatingSummary | null {
  let weighted = 0;
  let total = 0;
  let unitCount = 0;
  for (const u of units) {
    const avg = u.reviewAvg;
    const count = u.reviewTotal ?? 0;
    if (avg != null && count > 0) {
      weighted += avg * count;
      total += count;
      unitCount += 1;
    }
  }
  if (total === 0) return null;
  return { avg5: weighted / total / 2, total, unitCount };
}
