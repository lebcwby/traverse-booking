const LANDING_PAGE_CANONICAL_PATHS = {
  "pearl-district": "/neighborhoods/pearl-district",
  alberta: "/neighborhoods/alberta-arts-district",
  "hawthorne-belmont": "/neighborhoods/hawthorne-belmont",
  mississippi: "/neighborhoods/mississippi-avenue",
  "nw-23rd": "/neighborhoods/nob-hill",
  "sellwood-moreland": "/neighborhoods/sellwood",
  "northeast-portland": "/neighborhoods/ne-portland",
  "southeast-portland": "/neighborhoods/se-portland",
  "northwest-portland": "/neighborhoods/nw-portland",
  "north-portland": "/neighborhoods/north-portland",
  "corporate-housing": "/stays/corporate-housing-portland",
  "travel-nurse-housing": "/stays/travel-nurse-housing-portland",
  "relocation-housing": "/stays/relocation-housing-portland",
  "extended-stay": "/stays/extended-book-traverse",
} as const satisfies Record<string, string>;

export function getLandingPagePath(slug: string): string {
  const canonicalPath =
    LANDING_PAGE_CANONICAL_PATHS[
      slug as keyof typeof LANDING_PAGE_CANONICAL_PATHS
    ];
  return canonicalPath ?? `/s/${slug}`;
}

export function getLandingPageUrl(slug: string): string {
  return `https://www.booktraverse.com${getLandingPagePath(slug)}`;
}

export function landingPageHasCanonicalOverride(slug: string): boolean {
  return Object.hasOwn(LANDING_PAGE_CANONICAL_PATHS, slug);
}
