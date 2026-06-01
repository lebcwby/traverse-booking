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

  // Actual booktraverse-Supabase schema (verified 2026-05-19):
  //   review_date (text, not reviewed_at)
  //   category_{cleanliness,accuracy,checkin,communication,location,value}
  //     (smallint, not rating_*)
  //   reviewer_name (text) lives on reviews — no need to join reservations
  //
  // Earlier code assumed a different schema and queried non-existent columns;
  // queries returned 0 rows silently because the table was also empty. After
  // the Guesty sync backfills (src/lib/guesty-reviews-sync.ts), this is the
  // query that surfaces real review cards on /properties/[id].
  const [reviewsResult, avgResult] = await Promise.all([
    pool.query(
      `SELECT
         r.overall_rating,
         r.public_review,
         r.review_date,
         COALESCE(
           NULLIF(r.reviewer_name, ''),
           res.guest->>'firstName',
           SPLIT_PART(res.guest->>'fullName', ' ', 1),
           'A Guest'
         ) AS reviewer_name
       FROM reviews r
       LEFT JOIN reservations res ON res.guesty_id = r.reservation_id
       WHERE r.listing_id = $1
         AND r.public_review IS NOT NULL
         AND LENGTH(r.public_review) > 0
       ORDER BY r.review_date DESC NULLS LAST`,
      [listingId]
    ),
    pool.query(
      `SELECT
         ROUND(AVG(category_cleanliness)::numeric, 2)::float8 AS cleanliness,
         ROUND(AVG(category_accuracy)::numeric, 2)::float8 AS accuracy,
         ROUND(AVG(category_checkin)::numeric, 2)::float8 AS checkin,
         ROUND(AVG(category_communication)::numeric, 2)::float8 AS communication,
         ROUND(AVG(category_location)::numeric, 2)::float8 AS location,
         ROUND(AVG(category_value)::numeric, 2)::float8 AS value,
         COUNT(*) FILTER (WHERE overall_rating IS NOT NULL) AS rated_count
       FROM reviews
       WHERE listing_id = $1`,
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
    // Total count includes all reviews (with or without text), per
    // 2026-05-19 product decision. `reviews` array above only contains
    // those with non-empty public_review for rendering as review cards.
    totalCount: Number(cat.rated_count ?? reviews.length),
  };
}

/**
 * Returns a precise per-listing aggregate (avg + count) computed from the
 * reviews table — for use on listing cards, hub pages, and the AggregateRating
 * JSON-LD. Falls back gracefully if no reviews exist (caller can then use
 * BEAPI's rounded values).
 *
 * `avgRating` is on a 1-5 scale (matches Guesty's `overall_rating` column).
 * Display code that expects the BEAPI 0-10 convention should multiply by 2.
 */
export async function getListingReviewAggregate(
  listingId: string
): Promise<{ avgRating: number | null; count: number }> {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT
         ROUND(AVG(overall_rating)::numeric, 2)::float8 AS avg_rating,
         COUNT(*) FILTER (WHERE overall_rating IS NOT NULL) AS count
       FROM reviews
       WHERE listing_id = $1`,
      [listingId]
    );
    const row = rows[0] || {};
    return {
      avgRating: row.avg_rating ?? null,
      count: Number(row.count ?? 0),
    };
  } catch (err) {
    console.warn(
      "[reviews] getListingReviewAggregate failed:",
      err instanceof Error ? err.message : err
    );
    return { avgRating: null, count: 0 };
  }
}

/**
 * Enrich listings with precision review averages (not BEAPI's rounded .0/.5
 * values) by aggregating directly from the `reviews` table.
 *
 * History: prior implementation read `computed_review_avg` /
 * `computed_review_count` from the `listings` table. But on Traverse the
 * `listings` table is empty by design — all listings are fetched on-the-fly
 * from BEAPI — so that path was a no-op and every listing card fell back
 * to BEAPI's rounded-to-0.5 average.
 *
 * Current strategy: one batch SQL query that groups the `reviews` table by
 * listing_id for the set of listing IDs in this render. ~19k rows, indexed
 * on listing_id, so a 20-listing /properties page is one fast aggregate.
 *
 * Scale: reviews.overall_rating is 1-5; multiplied by 2 here so listing
 * cards (which expect BEAPI's 0-10 convention and divide by 2 to render
 * stars) work unchanged. Listings with zero rated reviews retain BEAPI's
 * value so we don't blank out cards that have BEAPI ratings but no synced
 * reviews yet.
 */
export async function enrichListingsWithReviewAverages(
  listings: Listing[]
): Promise<void> {
  const ids = listings
    .map((l) => l.guesty_id)
    .filter((id): id is string => !!id);
  if (ids.length === 0) return;

  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      listing_id: string;
      avg_rating: number | null;
      rated_count: number;
    }>(
      `SELECT
         listing_id,
         AVG(overall_rating)::float8 AS avg_rating,
         COUNT(*) FILTER (WHERE overall_rating IS NOT NULL)::int AS rated_count
       FROM reviews
       WHERE listing_id = ANY($1)
       GROUP BY listing_id`,
      [ids]
    );

    const byId = new Map(rows.map((r) => [r.listing_id, r]));
    for (const listing of listings) {
      if (!listing.guesty_id) continue;
      const agg = byId.get(listing.guesty_id);
      if (agg && agg.rated_count > 0 && agg.avg_rating != null) {
        listing.reviewAvg = agg.avg_rating * 2; // 1-5 → 0-10 scale
        listing.reviewTotal = agg.rated_count;
      }
    }
  } catch (err) {
    // DB unavailable — keep BEAPI's rounded averages rather than blanking.
    console.warn(
      "Review enrichment skipped (DB unavailable):",
      err instanceof Error ? err.message : err
    );
  }
}
