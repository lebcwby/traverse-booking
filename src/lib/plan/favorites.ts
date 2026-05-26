// Traverse team favorites — curated POI picks that layer human-supplied
// detail on top of sp_pois rows. When search_pois returns a row whose name
// matches a favorite, the tool attaches a `favorite` field so the agent can
// mention the specific recommendation with explicit human attribution.
//
// HISTORY (2026-05-26): this file previously held 793 lines of Portland-era
// favorites inherited from Stay Portland. The poiIds and nameMatches
// targeted Portland sp_pois rows that don't exist in Traverse's Colorado
// dataset, so every lookup returned undefined and the agent never surfaced
// favorite-anchored recommendations. The Portland entries have been
// stripped; the data structure, helpers, and consumer-facing exports
// (findFavoriteForPoi, getFavoritePill, renderFavoritesForPrompt) are
// preserved. Add Colorado entries to FAVORITES below as local picks are
// curated.

export type Favorite = {
  // Stable sp_pois id. Optional — if omitted, matching falls back to
  // normalized-name lookup against each POI's `name` field.
  poiId?: string;
  // The name we match against sp_pois rows (normalized, accent-insensitive,
  // word-boundary substring match). Always required so matching works even
  // without a pinned poiId.
  nameMatch: string;
  // Display-only hints for the system prompt render, used by the agent as
  // steering signal when choosing which neighborhoods to search_pois. Not
  // used for POI matching. Array so multi-location places can be surfaced
  // when planning in any of their neighborhoods.
  neighborhoods?: string[];
  category?: string;
  // The specific thing the human recommends ordering or doing. This is the
  // whole point of the list.
  orderThis?: string;
  // Extra colour — "pro tip", timing, caveat, whatever. Optional.
  note?: string;
};

// Empty until Colorado picks are curated. With this empty,
// findFavoriteForPoi always returns undefined (agent skips favorite-
// anchoring), and renderFavoritesForPrompt returns "(none yet)".
export const FAVORITES: Favorite[] = [];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[‘’‛`']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAsWords(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const startsCleanly = idx === 0 || haystack[idx - 1] === " ";
  const endsCleanly =
    idx + needle.length === haystack.length ||
    haystack[idx + needle.length] === " ";
  return startsCleanly && endsCleanly;
}

export function findFavoriteForPoi(poi: {
  id: string;
  name: string;
}): Favorite | undefined {
  const poiNameNorm = normalize(poi.name);
  return FAVORITES.find((f) => {
    if (f.poiId && f.poiId === poi.id) return true;
    const favNorm = normalize(f.nameMatch);
    return poiNameNorm === favNorm || containsAsWords(poiNameNorm, favNorm);
  });
}

const ROTATION_POOL = [
  "Local favorite",
  "Team pick",
  "Our go-to",
  "We love",
] as const;

function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(hash);
}

// Pill text shown on the itinerary card. Rules run in priority order; first
// match wins. Notes trigger overrides via literal phrases ("James Beard",
// "off-menu", "long line", "since YYYY"), so how you phrase a favorite's note
// decides its pill. Everything without a signal falls to deterministic
// rotation hashed by nameMatch, so the same favorite always reads the same.
export function getFavoritePill(favorite: Favorite): string {
  const rawNote = favorite.note ?? "";
  const note = rawNote.toLowerCase().replace(/[‘’‛`]/g, "'");
  const orderThis = (favorite.orderThis ?? "")
    .toLowerCase()
    .replace(/[‘’‛`]/g, "'");
  const category = (favorite.category ?? "").toLowerCase();
  const neighborhoods = favorite.neighborhoods ?? [];

  if (neighborhoods.some((n) => n.toLowerCase().includes("(day trip)"))) {
    return "Day trip";
  }
  if (note.includes("james beard")) return "James Beard";
  if (note.includes("chef's table")) return "Chef's Table";
  if (note.includes("honest take")) return "Honest take";
  if (note.includes("off-menu") || orderThis.includes("off-menu")) {
    return "Off-menu";
  }
  if (category === "music venue" || category === "jazz club") {
    return "Live music";
  }
  if (category === "basketball" || category === "soccer") {
    return "Live sports";
  }
  if (category === "speakeasy" || note.includes("no signage")) {
    return "Hidden gem";
  }
  if (note.includes("long line") || note.includes("worth the wait")) {
    return "Worth the wait";
  }
  if (note.includes("late-night") || note.includes("late night")) {
    return "Late night";
  }
  if (note.includes("walk-in only")) return "Walk-in only";
  if (note.includes("prix fixe")) return "Chef's pick";
  const yearMatch = note.match(/(?:since|founded|opened)\s+(\d{4})/);
  if (yearMatch) return `Since ${yearMatch[1]}`;

  return ROTATION_POOL[djb2(favorite.nameMatch) % ROTATION_POOL.length];
}

export function renderFavoritesForPrompt(): string {
  if (FAVORITES.length === 0) return "(none yet)";
  return FAVORITES.map((f) => {
    const meta: string[] = [];
    if (f.neighborhoods && f.neighborhoods.length > 0) {
      meta.push(f.neighborhoods.join(" / "));
    }
    if (f.category) meta.push(f.category);
    const metaBit = meta.length > 0 ? ` (${meta.join(", ")})` : "";
    const order = f.orderThis ? ` — order: ${f.orderThis}` : "";
    const note = f.note ? ` — ${f.note}` : "";
    return `- ${f.nameMatch}${metaBit}${order}${note}`;
  }).join("\n");
}
