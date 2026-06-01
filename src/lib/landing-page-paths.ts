// Landing-page slug → canonical path map + retirement registry.
//
// The Portland-era landing slugs below are all 301-redirected to /properties
// via next.config.ts. They are intentionally kept in LANDING_PAGES (in
// landing-pages.ts) for historical reasons but should NOT be surfaced to
// users — search suggestions, sitemap, and any UI that lists landing pages
// must skip anything in RETIRED_LANDING_SLUGS.

const LANDING_PAGE_CANONICAL_PATHS: Record<string, string> = {
  // (Kept for legacy code paths — every entry below 301-redirects to
  // /properties via next.config.ts. Do not link from new UI.)
};

export function getLandingPagePath(slug: string): string {
  const canonicalPath = LANDING_PAGE_CANONICAL_PATHS[slug];
  return canonicalPath ?? `/s/${slug}`;
}

export function getLandingPageUrl(slug: string): string {
  return `https://www.booktraverse.com${getLandingPagePath(slug)}`;
}

export function landingPageHasCanonicalOverride(slug: string): boolean {
  return Object.hasOwn(LANDING_PAGE_CANONICAL_PATHS, slug);
}

/**
 * Slugs from the Portland-era LANDING_PAGES array that have been retired:
 * every one is 301-redirected to /properties via next.config.ts. Keep this
 * list in sync with the redirects block.
 *
 * Surfaces:
 *   - sitemap.ts (exclude from /sitemap/landing-pages.xml)
 *   - api/search-suggestions (don't surface in autocomplete dropdown)
 *   - any future LANDING_PAGES iterator that renders UI
 */
export const RETIRED_LANDING_SLUGS: ReadonlySet<string> = new Set([
  "luxury",
  "budget-friendly",
  "short-term-rentals",
  "airbnb-alternative",
  "top-rated",
  "monthly-rentals",
  "northeast-portland",
  "southeast-portland",
  "northwest-portland",
  "north-portland",
  "mt-hood",
  "alberta",
  "hawthorne-belmont",
  "pearl-district",
  "mississippi",
  "nw-23rd",
  "sellwood-moreland",
  "1-bedroom",
  "2-bedroom",
  "3-bedroom",
  "4-bedroom-plus",
  "near-ohsu",
  "near-moda-center",
  "near-portland-airport",
  "near-providence-park",
  "near-convention-center",
  "near-lloyd-center",
  "downtown-portland",
  "corporate-housing",
  "furnished-apartments",
  "travel-nurse-housing",
  "relocation-housing",
  "walkable",
  "free-parking",
  "portland-accommodations",
  "downtown-portland-stays",
  "best-portland-stays",
  "backyard",
  // Portland-bodied "extended-stay" entry retired 2026-05-27 via Codex #14
  // (next.config.ts redirects /s/extended-stay -> /properties). A
  // Colorado long-stay landing page can be added later as a new entry.
  "extended-stay",
]);

export function isRetiredLandingSlug(slug: string): boolean {
  return RETIRED_LANDING_SLUGS.has(slug);
}
