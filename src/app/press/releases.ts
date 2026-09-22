// Press release metadata — used by both /press and /press/[slug].
//
// Deliberately mirrors src/app/blog/posts.ts. A static array is what lets the
// dynamic route run force-static with dynamicParams:false, which is what makes
// an unknown slug a real routing-level 404 rather than a rendered 200 soft-404
// — see the long note in blog/[slug]/page.tsx for why that distinction cost us
// once already.
//
// Adding a release = an entry here + a `content.ts` in a matching directory.
// The sitemap's `press` segment reads this array, so nothing else needs editing.
export interface PressRelease {
  slug: string;
  headline: string;
  subheadline?: string;
  /** Dateline city — "CRESTED BUTTE, Colo." */
  location: string;
  /** Issue date, ISO. Not the file date. */
  date: string;
  excerpt: string;
  image?: string;
  imageAlt?: string;
  /**
   * Releases issued before the 2024 rebrand went out as "High Rocky Homes".
   * The index labels them so a reader doesn't conclude we're two companies —
   * and so we're not implicitly backdating the Traverse name onto them.
   */
  legacyBrand?: string;
}

export const PRESS_RELEASES: PressRelease[] = [
  {
    slug: "summer-2026-market-snapshot",
    headline:
      "Traverse Hospitality Publishes Summer 2026 Mountain Short-Term Rental Market Snapshot: Managed Homes Grew Revenue 2.7% as Local Competitive Sets Fell 16%",
    subheadline:
      "Colorado-owned property manager releases the report it sent to its owners, with month-by-month data on how homes in Crested Butte, Leadville, and other mountain markets performed against the market in a soft summer.",
    location: "CRESTED BUTTE, Colo.",
    date: "2026-09-20",
    excerpt:
      "Colorado mountain homes Traverse has managed for more than a year earned 2.7% more per available night than in summer 2025 while their PriceLabs competitive sets earned 16% less, with the gap holding in every month. The full report, with methodology, is published at booktraverse.com/summer-2026-market-snapshot.",
    image: "/press/summer-2026-revpar-vs-market.jpg",
    imageAlt:
      "Bar chart: revenue per available night, change vs. summer 2025 — Traverse-managed Colorado mountain homes +2.7% for the summer, their competitive sets −16.0%",
  },
  {
    slug: "largest-independent-manager-crested-butte-base-area",
    headline:
      "Traverse Hospitality Becomes Largest and Highest-Rated Independent Property Manager at the Crested Butte Base Area, Outpacing the Market as Summer Demand Softens",
    subheadline:
      "Locally owned manager now operates 101 condos across the Grand Lodge, Lodge at Mountaineer Square, and The Plaza, and holds the highest Google rating of any property management company in Crested Butte; managed units posted 65% occupancy in August against a 58% market average while market revenue per unit fell 11%.",
    location: "CRESTED BUTTE, Colo.",
    date: "2026-09-02",
    excerpt:
      "Traverse Hospitality now manages 101 condominiums across the three principal buildings at the base of Crested Butte Mountain Resort. Managed units ran 65% occupancy in August against a 58% market average, and revenue per available unit rose year over year while the market's fell 11%.",
    image: "/press/grand-lodge-crested-butte.jpg",
    imageAlt:
      "The Grand Lodge Crested Butte at sunrise, with Mt. Crested Butte and fall aspens behind it",
  },
  {
    slug: "high-rocky-homes-donates-lake-county-soccer",
    headline:
      "High Rocky Homes donates to Lake County High School Soccer Team",
    location: "LEADVILLE, Colo.",
    date: "2022-10-25",
    excerpt:
      "High Rocky Homes, with community members Doug and Alicia Brittain, donated new warm-up jackets to the Lake County High School boys varsity soccer team ahead of the playoffs — the first time in the school's history that gear was funded from outside school funds.",
    legacyBrand: "High Rocky Homes",
  },
];

export function getRelease(slug: string): PressRelease | undefined {
  return PRESS_RELEASES.find((r) => r.slug === slug);
}

/** Newest first — the order both the index and the sitemap present. */
export function getReleasesByDate(): PressRelease[] {
  return [...PRESS_RELEASES].sort((a, b) => b.date.localeCompare(a.date));
}

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
