/**
 * Curated Google reviews — single source of truth for the carousel on the
 * home page and the /property-management page. Both surfaces import from
 * here so a quarterly refresh updates everything in one place.
 *
 * REFRESH CADENCE: quarterly (Feb 1 / May 1 / Aug 1 / Nov 1) — same as
 * portfolio-stats.ts. Pull the latest 6–10 starred reviews from
 * https://www.google.com/search?q=traverse+leadville (or the corresponding
 * Google Business Profile for each market) and update the array below.
 *
 * AUTOMATION (Phase 2): see `scripts/refresh-google-reviews.ts` — a script
 * that uses the Google Places API to fetch reviews and rewrite this file.
 * Requires GOOGLE_PLACES_API_KEY in .env.local plus the `placeIds` constant
 * below populated with each market's Google Business Profile place_id (run
 * `scripts/find-google-place-ids.ts` once to discover them).
 *
 * Last refreshed: 2026-05-06 (manually seeded from existing site copy)
 */

export interface CuratedReview {
  /** The review body. Keep as-is from Google — don't rewrite. */
  text: string;
  /** First name + last initial only (Google reviewers' default display). */
  authorName: string;
  /** 1–5 stars. Almost all of ours are 5; only include 4+ here. */
  rating: number;
  /** "guest" or "owner" — drives badge color in the carousel. */
  type: "guest" | "owner";
  /**
   * Optional context line shown under the author name —
   * e.g. "Crested Butte stay · 2025" or "Owner · Grand Lodge".
   * Keep brief.
   */
  context?: string;
  /** Which market the reviewer's stay/relationship is tied to (for filtering). */
  market?: "crested-butte" | "leadville" | "vail" | "avon" | "granby" | "twin-lakes" | "all";
}

/**
 * Google Business Profile place_ids for each market. Populate via
 * `scripts/find-google-place-ids.ts` before running the refresh script.
 * Empty strings mean we haven't discovered the place_id yet — the refresh
 * script will skip those entries.
 */
export const GOOGLE_PLACE_IDS = {
  leadville: "",
  crestedButte: "",
} as const;

/**
 * Curated reviews. The carousel shuffles on mount so users see different
 * reviews each visit even though the order here is stable.
 */
export const CURATED_REVIEWS: CuratedReview[] = [
  {
    text: "This rental had everything we needed. The room was spacious, the hot tub felt amazing after hiking, and the pool was warm — great for kids! We'd happily stay here again.",
    authorName: "Toni S.",
    rating: 5,
    type: "guest",
    context: "Crested Butte stay",
    market: "crested-butte",
  },
  {
    text: "We stayed in a beautiful condo steps from the lifts. The check-in was smooth, the place was spotless, and anytime we had a question we got a response within the hour. Better than any hotel experience.",
    authorName: "Jason M.",
    rating: 5,
    type: "guest",
    context: "Lodge at Mountaineer Square",
    market: "crested-butte",
  },
  {
    text: "I stayed for a month-long remote work trip. The extended-stay discount was real, the desk setup was better than my home office, and coffee shops were a 3-minute walk. Will absolutely come back.",
    authorName: "Mia B.",
    rating: 5,
    type: "guest",
    context: "Leadville stay",
    market: "leadville",
  },
  {
    text: "Traverse took over management of our condo and revenue increased meaningfully in the first season. They handle everything — pricing, cleaning, guests, maintenance. We just get a monthly statement.",
    authorName: "David & Karen L.",
    rating: 5,
    type: "owner",
    context: "Owner · Grand Lodge",
    market: "crested-butte",
  },
  // ── Placeholder slots — replace with real Google review text on next refresh ──
  // The carousel renders fine with 4 reviews; these extras give it more depth
  // when populated. Remove or replace with verified Google quotes.
];

/** Convenience: filter by type for surfaces that want guest- or owner-only. */
export function getReviewsByType(type: CuratedReview["type"]): CuratedReview[] {
  return CURATED_REVIEWS.filter((r) => r.type === type);
}

/** Convenience: filter by market. */
export function getReviewsByMarket(
  market: NonNullable<CuratedReview["market"]>
): CuratedReview[] {
  return CURATED_REVIEWS.filter(
    (r) => r.market === market || r.market === "all"
  );
}
