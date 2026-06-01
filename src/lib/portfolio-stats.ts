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
 *      so user-visible "189+ homes" strings stay aligned with totalListings.
 *
 * Last refreshed: 2026-05-07
 */
export const PORTFOLIO_STATS = {
  /** Total active listings across all markets */
  totalListings: 182,
  /** Number of distinct Colorado markets we operate in */
  markets: 6,
  /** Average Google rating (manually maintained — Google Places API not yet wired) */
  googleRating: 4.8,
  /** Distribution channels — broadly stable, manually maintained */
  channels: 50,
  /** Per-market counts. Use these strings directly in UI copy. */
  perMarket: {
    crestedButte: "80+ properties",
    leadville: "80+ properties (incl. Lake County)",
    vail: "2+ properties",
    avon: "2+ properties",
    granby: "3+ properties",
    twinLakes: "7+ properties",
  },
} as const;
