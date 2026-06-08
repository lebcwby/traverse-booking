/**
 * Guesty reviews → `reviews` table sync.
 *
 * Built 2026-05-19 after discovering the reviews table existed (with the
 * right schema) but had zero rows. Pulls Guesty's ~10-year review history
 * (Airbnb, VRBO, Direct) for any listing and upserts to Postgres so the
 * property detail page can render real review cards + accurate aggregates.
 *
 * Used by:
 *   - One-time backfill via `/api/admin/reviews-sync?action=backfill-all`
 *   - Nightly cron via `/api/cron/sync-reviews` (Phase 2)
 *
 * The `reviews` table schema lives in Supabase. Columns sync'd here:
 *   guesty_id (PK), listing_id, reservation_id, guest_id, channel,
 *   overall_rating, public_review, category_{cleanliness,accuracy,checkin,
 *   communication,location,value}, reviewer_name, review_date,
 *   guesty_created_at, guesty_updated_at, last_synced_at
 */

import { getPool } from "@/lib/db";
import {
  getOpenAPIListingsPage,
  getReviewsPage,
} from "@/lib/guesty-openapi";

const PAGE_SIZE = 100;
const MAX_PAGES_PER_LISTING = 100; // 100 pages × 100 reviews = 10k safety ceiling

// ─── Guesty review wire types ────────────────────────────────────
// Guesty's `/v1/reviews` returns `{ data: [...], limit, skip }`. Each review
// has a top-level wrapper (channelId, listingId, reservationId, guestId,
// createdAt, etc.) plus a `rawReview` payload whose shape differs per channel.

interface AirbnbCategoryRating {
  category?: string;
  rating?: number;
}
interface AirbnbRawReview {
  overall_rating?: number;
  public_review?: string;
  category_ratings?: AirbnbCategoryRating[];
  submitted_at?: string;
}

interface VrboStarRating {
  category?: string;
  value?: string;
}
interface VrboRawReview {
  starRatingOverall?: string;
  body?: { value?: string };
  starRatings?: VrboStarRating[];
  createdDateTime?: string;
  reservation?: {
    primaryGuest?: { firstName?: string; lastName?: string };
  };
}

interface GuestyReview {
  _id?: string;
  reservationId?: string;
  listingId?: string;
  guestId?: string;
  channelId?: string; // "airbnb2", "homeaway2" (= VRBO), etc.
  createdAt?: string;
  createdAtGuesty?: string;
  updatedAt?: string;
  updatedAtGuesty?: string;
  rawReview?: AirbnbRawReview | VrboRawReview | Record<string, unknown>;
}

interface GuestyReviewsResponse {
  data?: GuestyReview[];
  limit?: number;
  skip?: number;
}

interface NormalizedReview {
  guestyId: string;
  listingId: string | null;
  reservationId: string | null;
  guestId: string | null;
  channel: string | null;
  overallRating: number | null;
  publicReview: string | null;
  categoryCleanliness: number | null;
  categoryAccuracy: number | null;
  categoryCheckin: number | null;
  categoryCommunication: number | null;
  categoryLocation: number | null;
  categoryValue: number | null;
  reviewerName: string | null;
  reviewDate: string | null;
  guestyCreatedAt: string | null;
  guestyUpdatedAt: string | null;
}

export interface SyncResult {
  listingId: string;
  fetched: number;
  upserted: number;
  skippedNoId: number;
  errors: number;
  errorMessages?: string[];
}

function pickAirbnbCategory(
  ratings: AirbnbCategoryRating[] | undefined,
  category: string
): number | null {
  if (!Array.isArray(ratings)) return null;
  const found = ratings.find(
    (r) =>
      typeof r.category === "string" &&
      r.category.toLowerCase() === category.toLowerCase()
  );
  return typeof found?.rating === "number" ? found.rating : null;
}

function pickVrboStarRating(
  ratings: VrboStarRating[] | undefined,
  category: string
): number | null {
  if (!Array.isArray(ratings)) return null;
  const found = ratings.find(
    (r) =>
      typeof r.category === "string" &&
      r.category.toLowerCase() === category.toLowerCase()
  );
  if (!found?.value) return null;
  const n = parseInt(found.value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a Guesty review (which differs per channel) into our DB shape.
 * Returns null if the review doesn't have an _id or is in an unsupported
 * channel — callers should treat as skip.
 */
function normalizeReview(
  raw: GuestyReview,
  fallbackListingId: string
): NormalizedReview | null {
  if (!raw._id) return null;

  const channelKey = (raw.channelId || "").toLowerCase();
  const channel =
    channelKey === "airbnb2"
      ? "airbnb"
      : channelKey === "homeaway2"
        ? "vrbo"
        : channelKey || null;

  const base = {
    guestyId: raw._id,
    listingId: raw.listingId || fallbackListingId || null,
    reservationId: raw.reservationId || null,
    guestId: raw.guestId || null,
    channel,
    guestyCreatedAt: raw.createdAtGuesty || raw.createdAt || null,
    guestyUpdatedAt: raw.updatedAtGuesty || raw.updatedAt || null,
  };

  // ── Airbnb ────────────────────────────────────────────────────
  if (channel === "airbnb") {
    const r = (raw.rawReview as AirbnbRawReview) || {};
    return {
      ...base,
      overallRating: typeof r.overall_rating === "number" ? r.overall_rating : null,
      publicReview: r.public_review || null,
      categoryCleanliness: pickAirbnbCategory(r.category_ratings, "cleanliness"),
      categoryAccuracy: pickAirbnbCategory(r.category_ratings, "accuracy"),
      categoryCheckin: pickAirbnbCategory(r.category_ratings, "checkin"),
      categoryCommunication: pickAirbnbCategory(
        r.category_ratings,
        "communication"
      ),
      categoryLocation: pickAirbnbCategory(r.category_ratings, "location"),
      categoryValue: pickAirbnbCategory(r.category_ratings, "value"),
      // Airbnb's review payload has no reviewer name; the display layer
      // (src/lib/reviews.ts) falls back to reservations.guest or "A Guest".
      reviewerName: null,
      reviewDate: r.submitted_at || raw.createdAt || null,
    };
  }

  // ── VRBO (homeaway2) ─────────────────────────────────────────
  if (channel === "vrbo") {
    const r = (raw.rawReview as VrboRawReview) || {};
    const first = r.reservation?.primaryGuest?.firstName?.trim() || "";
    const last = r.reservation?.primaryGuest?.lastName?.trim() || "";
    const reviewerName = [first, last].filter(Boolean).join(" ").trim() || null;
    const overallRating = r.starRatingOverall
      ? (() => {
          const n = parseInt(r.starRatingOverall!, 10);
          return Number.isFinite(n) ? n : null;
        })()
      : pickVrboStarRating(r.starRatings, "overall");
    return {
      ...base,
      overallRating,
      publicReview: r.body?.value || null,
      categoryCleanliness: pickVrboStarRating(r.starRatings, "roomCleanliness"),
      // VRBO doesn't have a direct "accuracy" category; closest is "onlineListing"
      // (whether the listing matched the photos/description). We map it so we
      // don't lose the signal entirely.
      categoryAccuracy: pickVrboStarRating(r.starRatings, "onlineListing"),
      categoryCheckin: pickVrboStarRating(r.starRatings, "checkIn"),
      categoryCommunication: pickVrboStarRating(r.starRatings, "communication"),
      categoryLocation: pickVrboStarRating(r.starRatings, "location"),
      categoryValue: pickVrboStarRating(r.starRatings, "valueForMoney"),
      reviewerName,
      reviewDate: r.createdDateTime || raw.createdAt || null,
    };
  }

  // Unsupported channel — skip rather than insert malformed data
  return null;
}

async function upsertReview(normalized: NormalizedReview) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO reviews (
      guesty_id, listing_id, reservation_id, guest_id, channel,
      overall_rating, public_review,
      category_cleanliness, category_accuracy, category_checkin,
      category_communication, category_location, category_value,
      reviewer_name, review_date,
      guesty_created_at, guesty_updated_at, last_synced_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15,
      $16, $17, $18
    )
    ON CONFLICT (guesty_id) DO UPDATE SET
      listing_id           = EXCLUDED.listing_id,
      reservation_id       = COALESCE(EXCLUDED.reservation_id, reviews.reservation_id),
      guest_id             = COALESCE(EXCLUDED.guest_id, reviews.guest_id),
      channel              = COALESCE(EXCLUDED.channel, reviews.channel),
      overall_rating       = EXCLUDED.overall_rating,
      public_review        = EXCLUDED.public_review,
      category_cleanliness = EXCLUDED.category_cleanliness,
      category_accuracy    = EXCLUDED.category_accuracy,
      category_checkin     = EXCLUDED.category_checkin,
      category_communication = EXCLUDED.category_communication,
      category_location    = EXCLUDED.category_location,
      category_value       = EXCLUDED.category_value,
      reviewer_name        = COALESCE(EXCLUDED.reviewer_name, reviews.reviewer_name),
      review_date          = COALESCE(EXCLUDED.review_date, reviews.review_date),
      guesty_updated_at    = EXCLUDED.guesty_updated_at,
      last_synced_at       = EXCLUDED.last_synced_at
    `,
    [
      normalized.guestyId,
      normalized.listingId,
      normalized.reservationId,
      normalized.guestId,
      normalized.channel,
      normalized.overallRating,
      normalized.publicReview,
      normalized.categoryCleanliness,
      normalized.categoryAccuracy,
      normalized.categoryCheckin,
      normalized.categoryCommunication,
      normalized.categoryLocation,
      normalized.categoryValue,
      normalized.reviewerName,
      normalized.reviewDate,
      normalized.guestyCreatedAt,
      normalized.guestyUpdatedAt,
      Date.now(),
    ]
  );
  return true;
}

/**
 * Sync all reviews for a single Guesty listing. Paginated; safe to re-run.
 */
export async function syncReviewsForListing(
  listingId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    listingId,
    fetched: 0,
    upserted: 0,
    skippedNoId: 0,
    errors: 0,
    errorMessages: [],
  };

  let skip = 0;
  for (let page = 0; page < MAX_PAGES_PER_LISTING; page++) {
    let response: GuestyReviewsResponse;
    try {
      response = (await getReviewsPage({
        listingId,
        limit: PAGE_SIZE,
        skip,
      })) as GuestyReviewsResponse;
    } catch (err) {
      result.errors++;
      result.errorMessages?.push(
        `page ${page}: ${err instanceof Error ? err.message : String(err)}`
      );
      break;
    }

    // Guesty `/v1/reviews` returns `{ data: [...], limit, skip }` — no
    // total `count` field. End-of-pagination detected by short page.
    const reviews = Array.isArray(response?.data) ? response.data : [];
    if (reviews.length === 0) break;
    result.fetched += reviews.length;

    for (const review of reviews) {
      const normalized = normalizeReview(review, listingId);
      if (!normalized) {
        result.skippedNoId++;
        continue;
      }
      try {
        const inserted = await upsertReview(normalized);
        if (inserted) result.upserted++;
      } catch (err) {
        result.errors++;
        result.errorMessages?.push(
          `upsert ${normalized.guestyId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    skip += reviews.length;
    if (reviews.length < PAGE_SIZE) break;
  }

  if (result.errorMessages?.length === 0) delete result.errorMessages;
  return result;
}

/**
 * Enumerate every listing from Guesty OpenAPI (active + inactive).
 *
 * The local `listings` mirror is BEAPI-sourced (sync-listings cron) and holds
 * only bookable inventory. Reviews can attach to inactive/delisted listings
 * too, so for a complete backfill we enumerate the canonical list — including
 * inactive — straight from Guesty OpenAPI.
 */
async function getAllGuestyListingIds(): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 100;
  let skip = 0;
  for (let page = 0; page < 100; page++) {
    const response = (await getOpenAPIListingsPage({
      fields: "_id",
      limit: pageSize,
      skip,
    })) as { results?: Array<{ _id?: string }>; count?: number };
    const results = Array.isArray(response?.results) ? response.results : [];
    if (results.length === 0) break;
    for (const listing of results) {
      if (listing._id) ids.push(listing._id);
    }
    skip += results.length;
    if (results.length < pageSize) break;
    if (typeof response.count === "number" && skip >= response.count) break;
  }
  return ids;
}

/**
 * Sync reviews for every Guesty listing. Enumerates the inventory from the
 * local `listings` mirror (BEAPI-sourced via sync-listings), falling back to
 * Guesty OpenAPI only if the mirror is empty. Iterates serially to avoid
 * hammering Guesty's rate limit.
 */
export async function syncAllListingReviews(opts?: {
  /** Optionally cap how many listings to process this run. */
  limit?: number;
  /** Optionally skip the first N listings (for resumable batching). */
  skip?: number;
}): Promise<{
  listingsProcessed: number;
  totalFetched: number;
  totalUpserted: number;
  totalErrors: number;
  totalListingIdsConsidered: number;
  skip: number;
  limit: number | null;
  nextSkip: number | null;
  perListing: SyncResult[];
}> {
  // Enumerate from the local `listings` mirror first (BEAPI-sourced, populated
  // by the sync-listings cron). This covers active/bookable inventory — what
  // accrues new reviews — and avoids the OpenAPI dependency, whose creds aren't
  // configured in prod. Only fall back to OpenAPI enumeration if the mirror is
  // empty (e.g. before the first sync-listings run).
  const pool = getPool();
  const local = await pool.query<{ guesty_id: string }>(
    `SELECT guesty_id FROM listings
     WHERE guesty_id IS NOT NULL
     ORDER BY guesty_id`
  );
  let listingIds = local.rows.map((r) => r.guesty_id);
  if (listingIds.length === 0) {
    listingIds = await getAllGuestyListingIds();
  }
  const totalListingIdsConsidered = listingIds.length;

  const skip = Math.max(0, opts?.skip ?? 0);
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : null;
  const slice = listingIds.slice(skip, limit ? skip + limit : undefined);

  const perListing: SyncResult[] = [];
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (const listingId of slice) {
    const result = await syncReviewsForListing(listingId);
    perListing.push(result);
    totalFetched += result.fetched;
    totalUpserted += result.upserted;
    totalErrors += result.errors;
  }

  // For resume convenience: if we cap'd via `limit` and there are more
  // listings beyond what we just processed, expose the next skip offset
  // so the caller can re-invoke with `?skip=<nextSkip>`.
  const nextSkip =
    limit !== null && skip + slice.length < totalListingIdsConsidered
      ? skip + slice.length
      : null;

  return {
    listingsProcessed: slice.length,
    totalFetched,
    totalUpserted,
    totalErrors,
    totalListingIdsConsidered,
    skip,
    limit,
    nextSkip,
    perListing,
  };
}
