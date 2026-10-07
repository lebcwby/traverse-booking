import { getListings, type Listing } from "@/lib/supabase";

/**
 * What /properties renders when BEAPI is unreachable.
 *
 * Both BEAPI branches in /properties used to do this on failure:
 *
 *     } catch (err) {
 *       console.error("BEAPI browse failed:", err);
 *       listings = [];
 *     }
 *
 * — a dependency outage rendered as "0 properties / No properties found" with
 * **HTTP 200**. Google crawled it during one of those windows, photographed
 * the empty state, and filed /properties as a **Soft 404**; the page has been
 * flagged since July and cannot be submitted for indexing while that stands.
 * BEAPI is intermittently flaky (`guesty-429-burst`, `beapi-403-forbidden` in
 * the alert history), so this recurs.
 *
 * An empty catalogue and "no results for your filters" are different things
 * and must not render identically. So: serve the Supabase `listings` mirror
 * instead — it already holds the full catalogue, feeds the sitemap, and is
 * refreshed nightly by /api/cron/sync-listings. The page keeps its content and
 * its internal links for both guests and crawlers.
 *
 * Deliberately NOT availability-aware. With BEAPI down there is no way to know
 * whether a given stay is bookable, and inventing that would be worse than
 * showing the catalogue. Dates are ignored here; booking is broken anyway
 * while the upstream is down.
 */

/** Thrown when neither BEAPI nor the mirror can produce a catalogue. */
export class CatalogUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "Listing catalogue is unavailable: BEAPI failed and the Supabase mirror " +
        "returned nothing. Refusing to render an empty 200 — see " +
        "src/lib/catalog-fallback.ts." +
        (cause instanceof Error ? ` Upstream: ${cause.message}` : "")
    );
    this.name = "CatalogUnavailableError";
  }
}

export interface CatalogFilters {
  city?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  guests?: number;
  propertyType?: string;
}

export interface CatalogFallbackResult {
  /** Everything the mirror holds, before this request's filters. */
  total: number;
  /** What this request should render. May legitimately be empty. */
  listings: Listing[];
}

/**
 * City match, mirroring the dated branch in /properties: accept when either
 * side contains the other, so "Crested Butte" matches "Mt. Crested Butte",
 * and fall back to tags for listings whose address city is blank or unusual.
 */
function matchesCity(listing: Listing, wanted: string): boolean {
  const lcCity = (listing.address?.city || "").trim().toLowerCase();
  if (lcCity && (lcCity.includes(wanted) || wanted.includes(lcCity))) {
    return true;
  }
  const tags = Array.isArray(listing.tags) ? listing.tags : [];
  return tags.some(
    (t) =>
      typeof t === "string" &&
      (t.toLowerCase().includes(wanted) || wanted.includes(t.toLowerCase()))
  );
}

export function applyCatalogFilters(
  listings: Listing[],
  filters: CatalogFilters
): Listing[] {
  let out = listings;

  if (filters.city) {
    const wanted = filters.city.trim().toLowerCase();
    if (wanted) out = out.filter((l) => matchesCity(l, wanted));
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    out = out.filter(
      (l) =>
        l.title?.toLowerCase().includes(q) ||
        l.nickname?.toLowerCase().includes(q) ||
        l.address?.city?.toLowerCase().includes(q)
    );
  }

  if (typeof filters.bedrooms === "number" && filters.bedrooms > 0) {
    out = out.filter((l) => (l.bedrooms ?? 0) >= filters.bedrooms!);
  }

  if (typeof filters.guests === "number" && filters.guests > 0) {
    out = out.filter((l) => (l.accommodates ?? 0) >= filters.guests!);
  }

  if (filters.propertyType) {
    const wanted = filters.propertyType.toLowerCase();
    // The mirror exposes snake_case `property_type`, unlike the BEAPI-mapped
    // shape used elsewhere in this file.
    out = out.filter((l) => (l.property_type || "").toLowerCase() === wanted);
  }

  const min = filters.minPrice ?? 0;
  const max = filters.maxPrice ?? Infinity;
  if (min > 0 || max < Infinity) {
    out = out.filter((l) => {
      const price = l.prices?.basePrice || 0;
      return price >= min && price <= max;
    });
  }

  return out;
}

/**
 * Load the catalogue from the mirror and apply this request's filters.
 * Throws CatalogUnavailableError when the mirror itself has nothing — at that
 * point we genuinely cannot describe the catalogue, and a 5xx (which crawlers
 * retry) is the honest answer rather than a 200 that looks like "sold out".
 */
export async function loadCatalogFallback(
  filters: CatalogFilters,
  cause?: unknown
): Promise<CatalogFallbackResult> {
  let all: Listing[] = [];
  try {
    // 500 is comfortably above the ~208-row catalogue and bounded.
    const rows = await getListings({ limit: 500 });
    // Guard the shape as well as the call: a malformed response would
    // otherwise escape this function as a TypeError on `.length`, which the
    // caller has no reason to expect and would surface as a different bug.
    if (!Array.isArray(rows)) {
      throw new Error(`mirror returned ${typeof rows}, expected an array`);
    }
    all = rows;
  } catch (err) {
    console.error("[catalog-fallback] mirror read failed:", err);
    throw new CatalogUnavailableError(cause ?? err);
  }

  if (all.length === 0) throw new CatalogUnavailableError(cause);

  return { total: all.length, listings: applyCatalogFilters(all, filters) };
}
