/**
 * Guesty (BEAPI) → Supabase `listings` mirror sync.
 *
 * Built 2026-06-07. The `listings` table is read by the site's SEO/feed
 * surfaces (/s/[slug] landing pages, sitemap property URLs, the Microsoft/Bing
 * travel + price feeds, search-suggestions, featured listings) but nothing
 * populated it — it was empty, so all those surfaces rendered blank. This sync
 * fills it from the same BEAPI catalog the booking flow already uses.
 *
 * Source = BEAPI search (booking.guesty.com) rather than the Open API, because
 * BEAPI creds are configured in prod and it returns exactly the bookable
 * inventory the public site cares about. That means the BEAPI-derived columns
 * are populated (title, address, prices, amenities, tags, photos, terms, …);
 * the Open-API-only columns (owners, financials, custom_fields, wheelhouse_data,
 * host_name, contact_phone, timezone) are left untouched — upsert only writes
 * the keys it provides, so any other job that fills those stays intact.
 *
 * Idempotent: upsert on the `guesty_id` unique key. Listings that drop out of
 * the BEAPI catalog (delisted) are soft-deactivated via the last_synced_at
 * watermark — but only on a clean, near-complete run, so a partial fetch can
 * never mass-deactivate the catalog.
 */
import { searchListings } from "./guesty-beapi";
import { mapBeapiToListing, type BeapiListingResult } from "./listing-utils";
import { getSupabaseAdmin } from "./supabase-admin";

interface BeapiSearchResponse {
  results?: BeapiListingResult[];
  pagination?: { total?: number; cursor?: { next?: string | null } | null };
}

export interface ListingsSyncResult {
  pagesFetched: number;
  reportedTotal: number | null;
  totalFetched: number;
  totalUpserted: number;
  deactivated: number;
  errors: string[];
}

// Keys that mapBeapiToListing emits for the in-memory `Listing` shape but which
// are NOT real columns on the `listings` table. They must be stripped before
// upsert or Postgres rejects the whole write (42703 / PGRST204).
const NON_COLUMN_KEYS = [
  "id",
  "pictures",
  "totalPrice",
  "nightCount",
  "reviewAvg",
  "reviewTotal",
] as const;

async function fetchAllBeapiListings(): Promise<{
  results: BeapiListingResult[];
  reportedTotal: number | null;
  pages: number;
}> {
  const results: BeapiListingResult[] = [];
  let cursor: string | undefined;
  let reportedTotal: number | null = null;
  let pages = 0;

  // Hard page cap as a runaway guard (186 listings / 100 per page ≈ 2 pages).
  for (let page = 0; page < 50; page++) {
    const resp = (await searchListings({
      limit: 100,
      ...(cursor ? { cursor } : {}),
    })) as BeapiSearchResponse;
    pages += 1;

    const batch = resp.results ?? [];
    results.push(...batch);

    if (reportedTotal == null && typeof resp.pagination?.total === "number") {
      reportedTotal = resp.pagination.total;
    }

    const next = resp.pagination?.cursor?.next;
    if (!next || batch.length === 0) break;
    cursor = next;
  }

  return { results, reportedTotal, pages };
}

function toListingRow(
  r: BeapiListingResult,
  syncedAt: number
): Record<string, unknown> {
  const mapped = mapBeapiToListing(r) as unknown as Record<string, unknown>;
  for (const k of NON_COLUMN_KEYS) delete mapped[k];
  return {
    ...mapped,
    beapi_enabled: true, // BEAPI search results are, by definition, bookable
    last_synced_at: syncedAt, // bigint epoch ms (NOT NULL) + delisting watermark
    // No `guesty_updated_at` from BEAPI; stamp the sync time so the column has a
    // stable, sortable value (getListingsByTag orders by it).
    guesty_updated_at: new Date(syncedAt).toISOString(),
  };
}

export async function syncAllListings(): Promise<ListingsSyncResult> {
  const errors: string[] = [];
  const syncedAt = Date.now();

  const { results, reportedTotal, pages } = await fetchAllBeapiListings();

  // De-dupe by guesty_id (defensive against any cursor-page overlap).
  const byId = new Map<string, BeapiListingResult>();
  for (const r of results) if (r?._id) byId.set(r._id, r);
  const rows = [...byId.values()].map((r) => toListingRow(r, syncedAt));

  const supabase = getSupabaseAdmin();

  let totalUpserted = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("listings")
      .upsert(chunk, { onConflict: "guesty_id", count: "exact" });
    if (error) {
      errors.push(`upsert chunk ${Math.floor(i / CHUNK)}: ${error.message}`);
    } else {
      totalUpserted += count ?? chunk.length;
    }
  }

  // Soft-deactivate listings that dropped out of the BEAPI catalog. Guarded so
  // a partial/failed fetch can't wipe the catalog: only run when the fetch was
  // clean AND returned ≥80% of the reported total (or, if no total reported,
  // at least one row). Anything not touched this run has an older
  // last_synced_at and gets flipped inactive.
  let deactivated = 0;
  const nearComplete =
    reportedTotal == null ? rows.length > 0 : rows.length >= reportedTotal * 0.8;
  if (errors.length === 0 && rows.length > 0 && nearComplete) {
    const { error, count } = await supabase
      .from("listings")
      .update(
        { active: false, is_listed: false },
        { count: "exact" }
      )
      .lt("last_synced_at", syncedAt)
      .or("active.eq.true,is_listed.eq.true");
    if (error) {
      errors.push(`deactivate stale: ${error.message}`);
    } else {
      deactivated = count ?? 0;
    }
  }

  return {
    pagesFetched: pages,
    reportedTotal,
    totalFetched: rows.length,
    totalUpserted,
    deactivated,
    errors,
  };
}
