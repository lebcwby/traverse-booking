/**
 * Single source of truth for portfolio counts displayed across the site.
 *
 * Refresh quarterly (Feb 1 / May 1 / Aug 1 / Nov 1) by running:
 *   npx tsx scripts/refresh-portfolio-data.ts
 *
 * The script queries the Guesty BEAPI for live counts and:
 *   1. Rewrites `totalListings` + `perMarket` here.
 *   2. Refreshes market hero photos under /public/property-management/markets/.
 *   3. Sweeps marketing-copy files (src/app/page.tsx, src/components/layout/footer.tsx)
 *      so user-visible "220+ homes" marketing strings (hand-set, see MARKETING_COUNT in the refresh script).
 *
 * Last refreshed: 2026-09-30
 */
export const PORTFOLIO_STATS = {
  /** Total active listings across all markets */
  /**
   * BEAPI-derived count of the bookable catalog. Owned by
   * scripts/refresh-portfolio-data.ts — don't hand-edit; it gets rewritten
   * each quarterly run. This is the honest number the marketing-count audit
   * compares against.
   */
  totalListings: 195,
  /**
   * The number shown to people, set by hand. Deliberately allowed to lead
   * `totalListings`, because listings are active in the PMS (214 as of
   * 2026-09-30) before they become bookable through BEAPI (195). Keep this in
   * step with the "220+" strings across the marketing surfaces — the audit in
   * the refresh script lists every one of them.
   */
  marketingCount: "220+",
  /** Number of distinct Colorado markets we operate in */
  markets: 6,
  /** Average Google rating (manually maintained — Google Places API not yet wired) */
  googleRating: 4.8,
  /** Distribution channels — broadly stable, manually maintained */
  channels: 50,
  /** Per-market counts. Use these strings directly in UI copy. */
  perMarket: {
    crestedButte: "90+ properties",
    leadville: "80+ properties (incl. Lake County)",
    vail: "2+ properties",
    avon: "1+ properties",
    granby: "3+ properties",
    twinLakes: "7+ properties",
  },
} as const;
