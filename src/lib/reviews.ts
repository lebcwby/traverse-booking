import { getPool } from "@/lib/db";
import { type Listing } from "@/lib/supabase";

export interface Review {
  id: number;
  guesty_id: string;
  listing_id: string;
  reservation_id: string | null;
  guest_id: string | null;
  channel: string | null;
  overall_rating: number | null;
  public_review: string | null;
  category_cleanliness: number | null;
  category_accuracy: number | null;
  category_checkin: number | null;
  category_communication: number | null;
  category_location: number | null;
  category_value: number | null;
  reviewer_name: string | null;
  review_date: string | null;
}

export interface CategoryAverages {
  cleanliness: number | null;
  accuracy: number | null;
  checkin: number | null;
  communication: number | null;
  location: number | null;
  value: number | null;
}

export interface ReviewsData {
  reviews: Review[];
  categoryAverages: CategoryAverages;
  totalCount: number;
}

export async function getListingReviews(
  listingId: string
): Promise<ReviewsData> {
  const pool = getPool();

  // Shared DB schema: reviewed_at (not review_date), rating_* (not category_*),
  // no reviewer_name column — join to reservations for guest name
  const [reviewsResult, avgResult] = await Promise.all([
    pool.query(
      `SELECT r.overall_rating, r.public_review,
              r.reviewed_at as review_date,
              COALESCE(
                res.guest->>'firstName',
                SPLIT_PART(res.guest->>'fullName', ' ', 1),
                'A Guest'
              ) as reviewer_name
       FROM reviews r
       LEFT JOIN reservations res ON res.guesty_id = r.reservation_id
       WHERE r.listing_id = $1 AND r.public_review IS NOT NULL
       ORDER BY r.reviewed_at DESC`,
      [listingId]
    ),
    pool.query(
      `SELECT
         ROUND(AVG(rating_cleanliness)::numeric, 2)::float8 as cleanliness,
         ROUND(AVG(rating_accuracy)::numeric, 2)::float8 as accuracy,
         ROUND(AVG(rating_checkin)::numeric, 2)::float8 as checkin,
         ROUND(AVG(rating_communication)::numeric, 2)::float8 as communication,
         ROUND(AVG(rating_location)::numeric, 2)::float8 as location,
         ROUND(AVG(rating_value)::numeric, 2)::float8 as value
       FROM reviews
       WHERE listing_id = $1 AND overall_rating IS NOT NULL`,
      [listingId]
    ),
  ]);

  const reviews = reviewsResult.rows as Review[];
  const cat = avgResult.rows[0] || {};

  return {
    reviews,
    categoryAverages: {
      cleanliness: cat.cleanliness ?? null,
      accuracy: cat.accuracy ?? null,
      checkin: cat.checkin ?? null,
      communication: cat.communication ?? null,
      location: cat.location ?? null,
      value: cat.value ?? null,
    },
    totalCount: reviews.length,
  };
}

/**
 * Enrich listings with precision review averages (not BEAPI's rounded .0/.5 values).
 * First tries pre-computed columns on the listing (from Supabase queries).
 * Falls back to a batch DB query for listings without them (BEAPI results, cached data).
 * reviewAvg is stored on the 0-10 scale (matching BEAPI convention) so
 * downstream display code (listing.reviewAvg / 2) works unchanged.
 */
export async function enrichListingsWithReviewAverages(
  listings: Listing[]
): Promise<void> {
  const needsDbLookup: Listing[] = [];

  for (const listing of listings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = listing as any;
    if (row.computed_review_avg != null && row.computed_review_count > 0) {
      listing.reviewAvg = row.computed_review_avg * 2; // 1-5 → 0-10 scale
      listing.reviewTotal = row.computed_review_count;
    } else if (listing.guesty_id) {
      needsDbLookup.push(listing);
    }
  }

  // Batch query for listings not from the listings table (BEAPI, kv_store cache)
  if (needsDbLookup.length > 0) {
    try {
      const ids = needsDbLookup.map((l) => l.guesty_id);
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT guesty_id, computed_review_avg, computed_review_count
         FROM listings
         WHERE guesty_id = ANY($1) AND computed_review_avg IS NOT NULL`,
        [ids]
      );

      const map = new Map(rows.map((r) => [r.guesty_id, r]));
      for (const listing of needsDbLookup) {
        const data = map.get(listing.guesty_id);
        if (data && data.computed_review_count > 0) {
          listing.reviewAvg = data.computed_review_avg * 2;
          listing.reviewTotal = data.computed_review_count;
        }
      }
    } catch (err) {
      // Database not available — skip review enrichment gracefully
      console.warn("Review enrichment skipped (DB unavailable):", (err as Error).message);
    }
  }
}
