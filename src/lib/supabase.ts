import { getSupabaseAdmin } from "./supabase-admin";

// Listing queries use the shared DB (via supabase-admin) since all
// Guesty data is synced there. Auth stays on the book-traverse project.
function getSupabase() {
  return getSupabaseAdmin();
}

export interface Listing {
  id: number;
  guesty_id: string;
  nickname: string | null;
  title: string | null;
  property_type: string | null;
  room_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  accommodates: number | null;
  area_square_feet: number | null;
  address: {
    lat: number;
    lng: number;
    city: string;
    full: string;
    state: string;
    street: string;
    country: string;
    zipcode: string;
  } | null;
  prices: {
    currency: string;
    basePrice: number;
    cleaningFee: number | null;
    extraPersonFee: number | null;
    weeklyPriceFactor: number | null;
    monthlyPriceFactor: number | null;
    securityDepositFee: number | null;
  } | null;
  active: boolean;
  is_listed: boolean;
  picture: string | null;
  pictures?: string[] | null;
  picture_count: number | null;
  amenities: string[] | null;
  tags: string[] | null;
  default_check_in_time: string | null;
  default_check_out_time: string | null;
  terms: Record<string, unknown> | null;
  totalPrice?: number | null;
  nightCount?: number | null;
  cachedCheckIn?: string | null;
  cachedCheckOut?: string | null;
  reviewAvg?: number | null;
  reviewTotal?: number | null;
  review_summary?: string | null;
  occupancy_stats?: {
    occupancy_pct: number;
    booked_nights: number;
    days_active: number;
    computed_at: string;
    is_rare_find: boolean;
  } | null;
  guesty_updated_at?: string | null;
}

export async function getListings(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  bedrooms?: number;
  guests?: number;
  propertyType?: string;
  city?: string;
}) {
  let query = getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true)
    .order("title", { ascending: true });

  if (params?.search) {
    // Sanitize search input to prevent PostgREST filter injection
    const sanitized = params.search.replace(/[%,{}()."\\]/g, "");
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,nickname.ilike.%${sanitized}%,tags.cs.{${sanitized}}`
      );
    }
  }
  if (params?.bedrooms) {
    query = query.gte("bedrooms", params.bedrooms);
  }
  if (params?.guests) {
    query = query.gte("accommodates", params.guests);
  }
  if (params?.propertyType) {
    query = query.eq("property_type", params.propertyType);
  }
  if (params?.city) {
    query = query.eq("address->>city", params.city);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  if (params?.offset) {
    query = query.range(
      params.offset,
      params.offset + (params?.limit || 24) - 1
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  // Cast via unknown — Supabase-js's PostgREST type inference can't narrow
  // dynamic column lists back to Listing, so an explicit two-step cast is
  // required. Same pattern is used in getListingsForBrowseRender().
  return data as unknown as Listing[];
}

export async function getListing(guestyId: string) {
  const { data, error } = await getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("guesty_id", guestyId)
    .single();

  if (error) throw error;
  return data as unknown as Listing;
}

export async function getListingByTitleSlug(
  slug: string
): Promise<Listing | null> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("active", true);

  if (error || !data) return null;

  const { slugify } = await import("@/lib/utils");
  return (
    (data as unknown as Listing[]).find(
      (l) =>
        (l.title && slugify(l.title) === slug) ||
        (l.nickname && slugify(l.nickname) === slug)
    ) ?? null
  );
}

export async function getSimilarListings(
  guestyId: string,
  neighborhoodTag: string | null,
  bedrooms: number | null,
  limit = 4
): Promise<Listing[]> {
  let query = getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true)
    .neq("guesty_id", guestyId);

  if (neighborhoodTag) {
    query = query.contains("tags", [neighborhoodTag]);
  }

  if (bedrooms) {
    query = query
      .gte("bedrooms", Math.max(1, bedrooms - 1))
      .lte("bedrooms", bedrooms + 1);
  }

  const { data, error } = await query.limit(limit);
  if (error) return [];
  return (data as unknown as Listing[]) || [];
}

export async function getListingsByTag(
  tag: string,
  limit = 4
): Promise<Listing[]> {
  const { data, error } = await getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true)
    .contains("tags", [tag])
    // No numeric review column on this table (review data is BEAPI-side);
    // order by recency of the Guesty sync as a stable fallback.
    .order("guesty_updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as unknown as Listing[]) || [];
}

// Listing column lists for explicit SELECTs (Codex #10, 2026-05-27).
// The `listings` table is wide (~50 cols including JSONB blobs `raw`
// ~35KB/row, `wheelhouse_data` ~8.5KB/row, plus financials, owners,
// integrations, cleaning_status, custom_fields). SELECT * pulls all of
// that for every row, bloating Vercel egress and parsing cost on hot
// paths that show dozens of listings.
//
// BROWSE_RENDER_FIELDS — strict subset used by card grids + ranking.
// Skips `terms` (only needed on /properties/[id]). Cut avg row size
// from ~47KB → ~2KB.
//
// ⚠️ Every column named here MUST exist on the `listings` table. Postgres
// rejects a SELECT that names an unknown column with 42703 — unlike the
// old `select("*")`, which silently tolerated drift. The earlier version
// of this list named `review_count`, `computed_review_avg`,
// `computed_review_count`, `city`, `state`, `listing_category` and
// `pictures`, none of which exist on this table, so EVERY getListings*
// call 42703-errored and returned []. `city`/`state` live inside the
// `address` JSONB (queried via address->>city); review counts/category
// were never columns here. Verified against information_schema 2026-06-07.
const BROWSE_RENDER_FIELDS =
  "id,guesty_id,nickname,title,property_type,room_type," +
  "bedrooms,bathrooms,beds,accommodates,area_square_feet," +
  "address,prices,active,is_listed,beapi_enabled," +
  "picture,picture_count,amenities,tags," +
  "default_check_in_time,default_check_out_time,timezone," +
  "occupancy_stats,guesty_updated_at,review_summary";

// LISTING_FIELDS — superset adding `terms` for /properties/[id] +
// /api/payment-intent flows that need the terms blob. (There is no
// `pictures[]` column on this table — only `picture` + `picture_count` —
// so full photo arrays come from BEAPI, not here.) Still skips the wide
// JSONB extras (`wheelhouse_data`, financials, owners, integrations,
// cleaning_status, custom_fields) which no production consumer reads.
const LISTING_FIELDS = BROWSE_RENDER_FIELDS + ",terms";

export async function getListingsForBrowseRender(params: {
  tag?: string;
  limit?: number;
}): Promise<Listing[]> {
  let query = getSupabase()
    .from("listings")
    .select(BROWSE_RENDER_FIELDS)
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true);
  if (params.tag) query = query.contains("tags", [params.tag]);
  query = query.order("title", { ascending: true }).limit(params.limit ?? 100);
  const { data, error } = await query;
  if (error) {
    console.error("getListingsForBrowseRender failed:", error.message);
    return [];
  }
  return (data as unknown as Listing[]) ?? [];
}

export async function getAllListingPrices() {
  const { data, error } = await getSupabase()
    .from("listings")
    .select("prices")
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true)
    .not("prices", "is", null);

  if (error) throw error;
  return (data as { prices: { basePrice: number } }[])
    .map((l) => l.prices.basePrice)
    .filter((p) => p > 0);
}

export interface PricingCacheEntry {
  guesty_id: string;
  checkIn: string;
  checkOut: string;
  nightCount: number;
  estimatedTotal: number;
  basePrice: number;
  // Real quoted accommodation-only nightly rate for the sampled window — used as
  // the property page's "starting from" price (Guesty's static prices.basePrice
  // is a placeholder for ~40% of listings). Optional: absent until the pricing
  // cache is refreshed after this field shipped.
  nightlyFrom?: number;
}

export async function getListingPricingCache(): Promise<
  Map<string, PricingCacheEntry>
> {
  try {
    const { data } = await getSupabase()
      .from("kv_store")
      .select("value")
      .eq("key", "listing_pricing_cache")
      .single();

    if (data?.value && Array.isArray(data.value)) {
      const map = new Map<string, PricingCacheEntry>();
      for (const entry of data.value as PricingCacheEntry[]) {
        map.set(entry.guesty_id, entry);
      }
      return map;
    }
  } catch {
    // Cache miss is fine — return empty map
  }
  return new Map();
}

export async function getFeaturedListings(limit = 6) {
  const { data, error } = await getSupabase()
    .from("listings")
    .select(LISTING_FIELDS)
    .eq("active", true)
    .eq("is_listed", true)
    .eq("beapi_enabled", true)
    .not("picture", "is", null)
    .gte("bedrooms", 2)
    .order("guesty_updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Listing[];
}
