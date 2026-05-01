// src/lib/pois/normalize.ts

/**
 * Slugify a place name into a stable POI ID.
 * Optional neighborhood suffix disambiguates places with the same name.
 */
export function slugify(name: string, neighborhood?: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!neighborhood) return base;
  const suffix = neighborhood
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${suffix}`;
}

/**
 * Normalize a name into a fuzzy-match key for deduping extraction results.
 * Strips punctuation, lowercases, collapses whitespace.
 */
export function normalizeNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dedupe an array, keeping the first occurrence by key.
 */
export function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
