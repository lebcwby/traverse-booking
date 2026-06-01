// Long-form SEO body + FAQs per slug. Rendered at /plan/<slug> below the
// main itinerary block. Each entry has ~600 words of keyword-targeted copy
// (best time to visit, where to stay, getting around, cost) plus 5 FAQs.
//
// Kept in a separate module from slug-map.ts so routing/metadata edits
// don't trip on long strings, and so this file can be edited independently
// when refreshing copy.
//
// HISTORY (2026-05-26): the file previously held 5 Portland-era slug
// bodies inherited from the Stay Portland codebase. They were never wired
// into Traverse's Colorado slug-map (only crested-butte-* and
// colorado-mountains-* slugs route to /plan/<slug>), so the Portland
// bodies were dead code and the live Colorado plan pages rendered with
// no body or FAQs. The Portland content has been stripped; the structure
// and SLUG_CONTENT export are preserved so getSlugContent(slug) keeps
// returning null cleanly. Add Colorado entries below as copy is drafted.

export interface PlanFaq {
  question: string;
  answer: string;
}

export interface PlanSlugContent {
  // Full markdown-ish body with `## Heading` blocks + paragraphs + [links](/url).
  // Rendered by <MarkdownContent />.
  body: string;
  faqs: PlanFaq[];
}

// Shared E-E-A-T line. Rendered once per slug page immediately below the
// hero CTAs. Google's Search Raters guidelines reward a visible author/org
// attribution paired with concrete credentials.
export const AUTHOR_BYLINE =
  "Written by the Traverse Hospitality team — locals managing 189+ vacation rentals across Colorado's Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes markets. We've hosted thousands of guests and built these itineraries from the places we recommend to friends, family, and our own booked guests.";

// Empty until Colorado-specific copy is drafted. Slugs are routed from
// slug-map.ts; until matching entries land here, /plan/<slug> renders
// without the long-form body + FAQ block (getSlugContent returns null).
//
// Slugs to fill when ready:
//   - crested-butte-food-itinerary
//   - crested-butte-history-arts-tour
//   - crested-butte-weekend-itinerary
//   - colorado-mountains-with-kids-itinerary
export const SLUG_CONTENT: Record<string, PlanSlugContent> = {};

export function getSlugContent(slug: string): PlanSlugContent | null {
  return SLUG_CONTENT[slug] ?? null;
}
