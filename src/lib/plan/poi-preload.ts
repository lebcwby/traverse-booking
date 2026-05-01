// src/lib/plan/poi-preload.ts
// Server-side POI preloader. Before the agent's first generate_itinerary
// turn, we run a single round of parallel Supabase queries to assemble ~60
// balanced POI candidates tailored to the user's vibe. The candidates are
// injected as an additional system block so the agent can pick ids directly
// instead of burning 5-8 sequential search_pois round-trips (~20s saved).
//
// The search_pois tool stays available on refinement turns where the user
// asks for something outside the slate ("find me a Spanish restaurant",
// "swap in a food cart pod") — that's where AI flexibility matters most.
//
// Variety matters more than cache reuse here — plans feel stale if every
// visitor sees the same 60 picks. We order favorites first within each
// category, then anchor-neighborhood matches, then random tiebreak.

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { findFavoriteForPoi } from "./favorites";
import type { Favorite } from "./favorites";
import type { PoiCategory, PoiPartyType, PoiRow } from "@/lib/pois/types";

export interface PreloadedCandidate {
  id: string;
  name: string;
  category: PoiCategory;
  neighborhood: string;
  description: string;
  address: string;
  tags: string[];
  timeSlots: string[];
  partyTypes: string[];
  priceLevel: number | null;
  favorite?: { orderThis?: string; note?: string };
}

export interface PreloadInput {
  vibe?: string;
  nights?: number;
  anchorNeighborhoods?: string[];
  partyType?: PoiPartyType;
}

// Per-vibe category quotas. The slate biases toward what matches the vibe
// but always includes some of every category — food vibes still get a park,
// outdoor vibes still get a coffee shop, so the agent has flexibility to
// compose a full day. Values are "items in the candidate pool" not "items
// in the final plan" — agent picks a subset.
const CATEGORY_QUOTAS: Record<string, Partial<Record<PoiCategory, number>>> = {
  food: {
    restaurant: 14,
    coffee: 10,
    bar: 8,
    food_cart_pod: 5,
    activity: 6,
    park: 3,
    viewpoint: 2,
    shop: 3,
    museum: 1,
  },
  outdoors: {
    park: 10,
    viewpoint: 6,
    activity: 14,
    restaurant: 8,
    coffee: 6,
    bar: 3,
    food_cart_pod: 2,
    shop: 2,
    museum: 1,
  },
  neighborhoods: {
    shop: 10,
    restaurant: 10,
    coffee: 8,
    bar: 6,
    activity: 8,
    park: 4,
    viewpoint: 2,
    museum: 2,
    food_cart_pod: 2,
  },
  classic: {
    viewpoint: 4,
    activity: 10,
    park: 5,
    restaurant: 10,
    coffee: 6,
    bar: 4,
    shop: 4,
    museum: 2,
    food_cart_pod: 3,
  },
  default: {
    restaurant: 10,
    coffee: 6,
    bar: 5,
    activity: 10,
    park: 5,
    viewpoint: 3,
    shop: 4,
    museum: 1,
    food_cart_pod: 3,
  },
};

function quotasFor(vibe?: string): Partial<Record<PoiCategory, number>> {
  if (!vibe) return CATEGORY_QUOTAS.default;
  const v = vibe.toLowerCase();
  if (/\b(food|drink|eat|coffee|restaurant|dinner|brunch|cocktail)\b/.test(v)) {
    return CATEGORY_QUOTAS.food;
  }
  if (/\b(outdoor|hike|park|mountain|view|gorge|hood|nature)\b/.test(v)) {
    return CATEGORY_QUOTAS.outdoors;
  }
  if (/\b(neighborhood|shop|art|vintage|local|gallery|bookstore)\b/.test(v)) {
    return CATEGORY_QUOTAS.neighborhoods;
  }
  if (/\b(classic|first.*time|must.*see|iconic|highlights)\b/.test(v)) {
    return CATEGORY_QUOTAS.classic;
  }
  return CATEGORY_QUOTAS.default;
}

// Detect a short vibe label from free-form user text. Heuristic only — the
// agent still picks freely; this just shapes the slate. Returns the raw
// keyword chunk so `quotasFor` can do its regex match downstream.
export function detectVibe(text: string): string | undefined {
  const lc = text.toLowerCase();
  if (/food|drink|restaurant|coffee|brunch|cocktail|dinner/.test(lc)) {
    return "food";
  }
  if (/outdoor|hike|park|viewpoint|mt\.? hood|gorge|nature/.test(lc)) {
    return "outdoors";
  }
  if (/neighborhood|shop|bookstore|gallery|vintage|art|local finds/.test(lc)) {
    return "neighborhoods";
  }
  if (/classic|first.?time|must.?see|iconic|highlights/.test(lc)) {
    return "classic";
  }
  return undefined;
}

// Detect anchor neighborhoods from free-form user text. Keys match sp_pois
// neighborhood slugs. Returns ALL hits because a user can legitimately name
// more than one ("we're between Pearl and Nob Hill"). When populated, the
// preload promotes POIs in these neighborhoods ahead of favorites elsewhere.
export function detectAnchorNeighborhoods(text: string): string[] {
  const lc = text.toLowerCase();
  const hits: string[] = [];
  const MAP: Array<[RegExp, string[]]> = [
    [/\bnob hill\b|\bnw\s*23(?:rd)?\b|\bslabtown\b/, ["nob_hill", "northwest"]],
    [/\bpearl(?:\s+district)?\b/, ["pearl"]],
    [/\bdowntown\b|\bdt\b/, ["downtown", "pearl"]],
    [/\bhawthorne\b/, ["hawthorne"]],
    [/\balberta\b/, ["alberta"]],
    [/\bmississippi\b/, ["mississippi"]],
    [/\bse\s*division\b|\bdivision st\b/, ["division", "richmond"]],
    [/\bsellwood\b|\bmoreland\b/, ["sellwood"]],
    [/\bbelmont\b/, ["belmont", "buckman"]],
    [/\bst\.?\s*johns\b/, ["st_johns"]],
    [/\bmt\.?\s*tabor\b/, ["mt_tabor"]],
    [/\blaurelhurst\b/, ["laurelhurst"]],
    [/\bbuckman\b/, ["buckman"]],
    [/\brichmond\b/, ["richmond"]],
    [/\bkerns\b/, ["kerns"]],
    [/\bhollywood\b/, ["hollywood"]],
    [/\bne\s+portland\b|\bnortheast\b/, ["alberta", "hollywood", "kerns"]],
    [/\bse\s+portland\b|\bsoutheast\b/, ["hawthorne", "division", "buckman"]],
    [/\bnw\s+portland\b/, ["nob_hill", "northwest", "pearl"]],
    [
      /\bn\s+portland\b|\bnorth\s+portland\b/,
      ["mississippi", "north_portland"],
    ],
  ];
  for (const [re, tags] of MAP) {
    if (re.test(lc)) {
      for (const t of tags) if (!hits.includes(t)) hits.push(t);
    }
  }
  return hits;
}

// Detect party type from free-form user text. Maps common phrasings to the
// sp_pois party_types vocabulary.
export function detectPartyType(text: string): PoiPartyType | undefined {
  const lc = text.toLowerCase();
  if (/\bkids?\b|\bfamily\b|\bchildren\b|\btoddler\b/.test(lc)) return "family";
  if (/\bsolo\b|\balone\b|\bby myself\b/.test(lc)) return "solo";
  if (/\bwife\b|\bhusband\b|\bpartner\b|\bromantic\b|\banniversary\b/.test(lc))
    return "couple";
  if (/\bfriends\b|\bbuddies\b|\bgroup\b|\bbachelor/.test(lc)) return "friends";
  return undefined;
}

export async function preloadPoiCandidates(
  input: PreloadInput
): Promise<PreloadedCandidate[]> {
  const quotas = quotasFor(input.vibe);
  const anchors = input.anchorNeighborhoods ?? [];
  const supabase = getSupabaseAdmin();

  const entries = Object.entries(quotas) as Array<[PoiCategory, number]>;

  // Fetch all categories in parallel. For each, cast a wider net than the
  // quota so we can rank favorites + anchor-matches before slicing.
  const results = await Promise.all(
    entries.map(async ([category, quota]) => {
      if (!quota) return { category, rows: [] };
      let query = supabase
        .from("sp_pois")
        .select("*")
        .eq("status", "active")
        .eq("category", category);
      if (input.partyType) {
        query = query.overlaps("party_types", [input.partyType]);
      }
      const budget = Math.max(quota * 4, 16);
      const { data, error } = await query.limit(budget);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[preload] ${category} query failed:`, error.message);
        return { category, rows: [] };
      }
      return { category, rows: (data ?? []) as PoiRow[] };
    })
  );

  const candidates: PreloadedCandidate[] = [];
  for (const { category, rows } of results) {
    const quota = quotas[category] ?? 0;
    if (!quota) continue;
    type Tagged = { row: PoiRow; favorite?: Favorite };
    const tagged: Tagged[] = rows.map((row) => ({
      row,
      favorite: findFavoriteForPoi({ id: row.id, name: row.name }),
    }));
    const anchorSet = anchors.length > 0;
    tagged.sort((a, b) => {
      const aAnchor = anchors.includes(a.row.neighborhood) ? 0 : 1;
      const bAnchor = anchors.includes(b.row.neighborhood) ? 0 : 1;
      const aFav = a.favorite ? 0 : 1;
      const bFav = b.favorite ? 0 : 1;
      if (anchorSet) {
        // When the user names a neighborhood, geography beats favorites. An
        // anchored plan that scatters picks across the city defeats the
        // purpose of naming Nob Hill / Pearl / Alberta. Favorites still win
        // the tiebreak within the anchor neighborhood and among non-anchor
        // leftovers.
        if (aAnchor !== bAnchor) return aAnchor - bAnchor;
        if (aFav !== bFav) return aFav - bFav;
      } else {
        if (aFav !== bFav) return aFav - bFav;
        if (aAnchor !== bAnchor) return aAnchor - bAnchor;
      }
      // Random tiebreak — prevents every visitor from seeing the same 60 picks
      return Math.random() - 0.5;
    });
    for (const { row, favorite } of tagged.slice(0, quota)) {
      candidates.push({
        id: row.id,
        name: row.name,
        category: row.category,
        neighborhood: row.neighborhood,
        description: row.description,
        address: row.address,
        tags: row.tags,
        timeSlots: row.time_slots,
        partyTypes: row.party_types,
        priceLevel: row.price_level,
        ...(favorite && {
          favorite: {
            orderThis: favorite.orderThis,
            note: favorite.note,
          },
        }),
      });
    }
  }

  return candidates;
}

// Format candidates as a compact system-prompt block. Grouped by category so
// the agent can scan for coverage. Descriptions truncated to keep the block
// around ~3000 tokens for 60 POIs.
export function renderCandidatesForPrompt(
  candidates: PreloadedCandidate[]
): string {
  if (candidates.length === 0) return "(no candidates available)";

  const byCategory = new Map<string, PreloadedCandidate[]>();
  for (const c of candidates) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  const sections: string[] = [];
  for (const [cat, list] of byCategory) {
    const lines = list.map((c) => {
      const favBit = c.favorite?.orderThis
        ? ` [FAV — order: ${c.favorite.orderThis}]`
        : c.favorite
          ? " [FAV]"
          : "";
      const tagsBit = c.tags.length > 0 ? ` | ${c.tags.join(",")}` : "";
      const slotsBit =
        c.timeSlots.length > 0 ? ` | slots:${c.timeSlots.join(",")}` : "";
      const descBit = c.description
        ? `\n    ${c.description.slice(0, 120).trim()}`
        : "";
      return `  - ${c.id} | ${c.name} | ${c.neighborhood}${tagsBit}${slotsBit}${favBit}${descBit}`;
    });
    sections.push(`## ${cat}\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
