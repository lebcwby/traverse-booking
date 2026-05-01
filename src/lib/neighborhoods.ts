/**
 * Neighborhood mapping utility.
 * Maps listing tags to neighborhood metadata for SEO content on property pages.
 */

export interface NeighborhoodInfo {
  name: string;
  slug: string; // landing page slug under /s/
  quadrant?: string;
  quadrantSlug?: string;
  tagline: string;
  landmarks: string[];
  guideSlug?: string;
}

/** Tag value → neighborhood data. Specific neighborhoods listed first, quadrants last. */
const NEIGHBORHOODS: Record<string, NeighborhoodInfo> = {
  Alberta: {
    name: "Alberta Arts District",
    slug: "alberta",
    quadrant: "Northeast Portland",
    quadrantSlug: "northeast-portland",
    tagline:
      "A vibrant corridor of murals, independent shops, craft cocktail bars, and some of Portland's best brunch spots. Last Thursday art walks (May\u2013September) transform the street into an open-air gallery.",
    landmarks: [
      "Salt & Straw",
      "Tin Shed Garden Cafe",
      "Alberta Park",
      "Pine State Biscuits",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  "Hawthorne Belmont": {
    name: "Hawthorne & Belmont",
    slug: "hawthorne-belmont",
    quadrant: "Southeast Portland",
    quadrantSlug: "southeast-portland",
    tagline:
      "Eclectic vintage shops, independent bookstores, and walkable dining along two of Portland's most iconic streets. Mt. Tabor Park, an extinct volcanic cinder cone with panoramic city views, is a short walk east.",
    landmarks: [
      "Powell's Books on Hawthorne",
      "Mt. Tabor Park",
      "Ladd's Addition Rose Gardens",
      "Division Street restaurants",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  "Pearl District": {
    name: "Pearl District",
    slug: "pearl-district",
    quadrant: "Northwest Portland",
    quadrantSlug: "northwest-portland",
    tagline:
      "Portland's most walkable urban neighborhood \u2014 converted warehouses, art galleries, upscale dining, and Powell's City of Books. First Thursday gallery walks draw crowds monthly.",
    landmarks: [
      "Powell's City of Books",
      "Jamison Square",
      "Lan Su Chinese Garden",
      "Portland Saturday Market",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  Mississippi: {
    name: "Mississippi Avenue",
    slug: "mississippi",
    quadrant: "North Portland",
    quadrantSlug: "north-portland",
    tagline:
      "A charming, compact stretch of independent shops, restaurants, and live music venues with string lights overhead and a creative community feel.",
    landmarks: [
      "Mississippi Studios",
      "Lovely's Fifty Fifty",
      "Prost! Beer Hall",
      "Mississippi Marketplace",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  "NW 23rd": {
    name: "NW 23rd Avenue (Nob Hill)",
    slug: "nw-23rd",
    quadrant: "Northwest Portland",
    quadrantSlug: "northwest-portland",
    tagline:
      "Boutique shopping, cozy restaurants, and tree-lined Victorian streets at the base of Forest Park \u2014 Portland's 5,200-acre urban forest.",
    landmarks: [
      "Forest Park",
      "NW 23rd Avenue shops",
      "Pittock Mansion",
      "Washington Park",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  "Sellwood Moreland": {
    name: "Sellwood-Moreland",
    slug: "sellwood-moreland",
    quadrant: "Southeast Portland",
    quadrantSlug: "southeast-portland",
    tagline:
      "A charming neighborhood with Antique Row, riverfront parks, and tree-lined residential streets that feel like a small town within the city.",
    landmarks: [
      "Antique Row (SE 13th)",
      "Sellwood Riverfront Park",
      "Oaks Amusement Park",
      "Springwater Corridor Trail",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  Northeast: {
    name: "Northeast Portland",
    slug: "northeast-portland",
    tagline:
      "Creative energy, tree-lined streets, and Portland's best food scene \u2014 from the Alberta Arts District to the Hollywood District.",
    landmarks: [
      "Alberta Street",
      "Mississippi Avenue",
      "Hollywood Theatre",
      "Grant Park",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  Southeast: {
    name: "Southeast Portland",
    slug: "southeast-portland",
    tagline:
      "Portland's most eclectic, walkable neighborhoods \u2014 Hawthorne, Division, Belmont, and Clinton \u2014 with independent shops, food carts, and vibrant dining.",
    landmarks: [
      "Hawthorne Boulevard",
      "Division Street",
      "Mt. Tabor Park",
      "Eastside Esplanade",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  Northwest: {
    name: "Northwest Portland",
    slug: "northwest-portland",
    tagline:
      "Urban walkability meets nature \u2014 NW 23rd Avenue boutiques, Pearl District galleries, and Forest Park trails all within reach.",
    landmarks: [
      "NW 23rd Avenue",
      "Pearl District",
      "Forest Park",
      "Pittock Mansion",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
  North: {
    name: "North Portland",
    slug: "north-portland",
    tagline:
      "Mississippi Avenue's creative scene, St. Johns' small-town charm, and Cathedral Park's gothic bridge \u2014 Portland's most neighborhood-driven quadrant.",
    landmarks: [
      "Mississippi Avenue",
      "St. Johns Bridge",
      "Cathedral Park",
      "University of Portland",
    ],
    guideSlug: "where-to-stay-in-portland",
  },
};

/** Priority order: specific neighborhoods first, then quadrants. */
const SPECIFIC_TAGS = [
  "Alberta",
  "Hawthorne Belmont",
  "Pearl District",
  "Mississippi",
  "NW 23rd",
  "Sellwood Moreland",
];
const QUADRANT_TAGS = ["Northeast", "Southeast", "Northwest", "North"];

/**
 * Resolve the best neighborhood match from a listing's tags.
 * Prefers specific neighborhoods over quadrants.
 */
export function getNeighborhoodFromTags(
  tags: string[] | null
): NeighborhoodInfo | null {
  if (!tags?.length) return null;

  // Try specific neighborhoods first
  for (const tag of SPECIFIC_TAGS) {
    if (tags.includes(tag)) return NEIGHBORHOODS[tag];
  }
  // Fall back to quadrant
  for (const tag of QUADRANT_TAGS) {
    if (tags.includes(tag)) return NEIGHBORHOODS[tag];
  }
  return null;
}

/** Get the neighborhood tag from a listing's tags (for querying similar listings). */
export function getNeighborhoodTag(tags: string[] | null): string | null {
  if (!tags?.length) return null;
  for (const tag of SPECIFIC_TAGS) {
    if (tags.includes(tag)) return tag;
  }
  for (const tag of QUADRANT_TAGS) {
    if (tags.includes(tag)) return tag;
  }
  return null;
}

/** Strip emoji from text (reusable for meta descriptions and JSON-LD). */
export function stripEmoji(text: string): string {
  return text
    .replace(
      /[\u2700-\u27BF\uE000-\uF8FF]|[\uD83C-\uDBFF][\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF\uDE00-\uDEFF]/g,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
