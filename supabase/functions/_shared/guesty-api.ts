import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CONSTANTS
// ============================================

const GUESTY_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const GUESTY_API_BASE = "https://open-api.guesty.com/v1";

// Token buffer: refresh when less than 8 hours remain.
// Guesty tokens last 24 hours. Uses ~1.5 tokens/day (limit is 5).
const TOKEN_REFRESH_BUFFER_MS = 30 * 60 * 1000;

// Rate limiting constants — target 60 requests/min (half the limit)
const REQUEST_DELAY_MS = 1000;
const PAGE_DELAY_MS = 1000;
const PAGE_SIZE = 100;
const INCREMENTAL_MAX_PAGES = 5;
const ENRICH_BATCH_SIZE = 100;
const ENRICH_DELAY_MS = 500;

// Sync buffer — look back 5 minutes to avoid gaps
const SYNC_BUFFER_MS = 5 * 60 * 1000;

// Staleness timeout — if a sync is "in_progress" for longer than this, treat it as stale
const STALE_SYNC_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Calendar sync — max listings per Edge Function invocation (~120s of work)
const CALENDAR_BATCH_SIZE = 100;

export {
  GUESTY_API_BASE,
  REQUEST_DELAY_MS,
  PAGE_DELAY_MS,
  PAGE_SIZE,
  INCREMENTAL_MAX_PAGES,
  ENRICH_BATCH_SIZE,
  ENRICH_DELAY_MS,
  SYNC_BUFFER_MS,
  CALENDAR_BATCH_SIZE,
  STALE_SYNC_TIMEOUT_MS,
};

// ============================================
// SUPABASE CLIENT
// ============================================

export function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key);
}

// ============================================
// TOKEN MANAGEMENT
// ============================================
// Guesty enforces a hard limit of 5 OAuth tokens per 24 hours.
// Strategy:
//   1. Always check Supabase for a cached token first (token_type = 'openapi')
//   2. Only fetch a new token if the cached one is expired or within the buffer window
//   3. Use upsert on token_type to ensure exactly one row per type
//   4. On 401/403 from Guesty API, invalidate the cached token and retry once

export async function getValidToken(supabase: SupabaseClient): Promise<string> {
  // Read-only — NEVER refresh tokens here. Token refresh is handled
  // exclusively by the /api/guesty/token Vercel cron.
  // Guesty has a hard limit of 5 OAuth tokens per 24 hours.
  const { data, error } = await supabase
    .from("guesty_tokens")
    .select("access_token, expires_at")
    .eq("token_type", "openapi")
    .single();

  if (error || !data) {
    throw new Error(
      "No OpenAPI token in cache — /api/guesty/token cron must refresh it"
    );
  }

  if (data.expires_at <= Date.now()) {
    throw new Error(
      "OpenAPI token expired — /api/guesty/token cron must refresh it"
    );
  }

  return data.access_token;
}

// ============================================
// GUESTY API FETCH WITH AUTH
// ============================================

/**
 * Make an authenticated request to the Guesty OpenAPI.
 * On 401/403: logs the error and returns the response — does NOT
 * invalidate or refresh the token. The cron handles refresh.
 */
export async function guestyFetch(
  supabase: SupabaseClient,
  path: string,
  options?: RequestInit
): Promise<Response> {
  const token = await getValidToken(supabase);
  const url = path.startsWith("http") ? path : `${GUESTY_API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    console.error(
      `Guesty API auth failure (${response.status}) on ${path} — token may be expired, cron will refresh`
    );
  }

  return response;

  // Unreachable, but TypeScript needs it
  throw new Error("Unexpected: exhausted retry loop");
}

// ============================================
// HELPERS
// ============================================

// Convert null/undefined to null for Postgres
function n<T>(val: T | null | undefined): T | null {
  return val === null || val === undefined ? null : val;
}

// ============================================
// RESERVATION TRANSFORM
// ============================================

export function transformReservation(res: any): Record<string, unknown> {
  const now = Date.now();

  // Extract money summary
  const money = res.money
    ? {
        fare_accommodation: n(res.money.fareAccommodation),
        fare_cleaning: n(res.money.fareCleaning),
        total_fees: n(res.money.totalFees),
        total_taxes: n(res.money.totalTaxes),
        total_paid: n(res.money.totalPaid),
        balance_due: n(res.money.balanceDue),
        host_payout: n(res.money.hostPayout),
        net_income: n(res.money.netIncome),
        owner_revenue: n(res.money.ownerRevenue),
        commission: n(res.money.commission),
        currency: n(res.money.currency),
        invoice_items_count: n(res.money.invoiceItems?.length),
      }
    : null;

  return {
    guesty_id: res._id,
    confirmation_code: n(res.confirmationCode),
    listing_id: n(res.listingId),
    guest_id: n(res.guestId),
    status: n(res.status),
    source: n(res.source),
    secondary_source: n(res.secondarySource),
    check_in: res.checkIn,
    check_out: res.checkOut,
    check_in_date_localized: n(res.checkInDateLocalized),
    check_out_date_localized: n(res.checkOutDateLocalized),
    nights_count: n(res.nightsCount),
    guest: res.guest
      ? {
          _id: n(res.guest._id),
          firstName: n(res.guest.firstName),
          lastName: n(res.guest.lastName),
          fullName: n(res.guest.fullName),
          email: n(res.guest.email),
          phone: n(res.guest.phone),
        }
      : null,
    listing: res.listing
      ? {
          _id: n(res.listing._id),
          title: n(res.listing.title),
          nickname: n(res.listing.nickname),
        }
      : null,
    guests_count: n(res.guestsCount),
    number_of_guests: res.numberOfGuests
      ? typeof res.numberOfGuests === "number"
        ? res.numberOfGuests
        : {
            numberOfAdults: n(res.numberOfGuests.numberOfAdults),
            numberOfChildren: n(res.numberOfGuests.numberOfChildren),
            numberOfInfants: n(res.numberOfGuests.numberOfInfants),
            numberOfPets: n(res.numberOfGuests.numberOfPets),
          }
      : null,
    money,
    money_full: n(res.money),
    integration: res.integration
      ? {
          platform: n(res.integration.platform),
          externalId: n(res.integration.externalId || res.integration._id),
        }
      : null,
    notes: res.notes
      ? typeof res.notes === "string"
        ? res.notes
        : {
            guest: n(res.notes.guest),
            other: n(res.notes.other),
            cleaning: n(res.notes.cleaning),
            collection: n(res.notes.collection),
            houseManual: n(res.notes.houseManual),
            private: n(res.notes.private),
          }
      : null,
    special_requests: n(res.specialRequests),
    planned_arrival: n(res.plannedArrival),
    planned_departure: n(res.plannedDeparture),
    key_code: n(res.keyCode),
    is_returning_guest: n(res.isReturningGuest),
    manually_created: n(res.manuallyCreated),
    review: res.review
      ? {
          rating: n(res.review.rating),
          publicReview: n(res.review.publicReview),
          privateReview: n(res.review.privateReview),
        }
      : null,
    confirmed_at: n(res.confirmedAt),
    guesty_created_at: n(res.createdAt),
    guesty_updated_at: n(res.updatedAt),
    last_synced_at: now,
    // Mark as enriched if full money data (with invoiceItems) is present
    ...(res.money?.invoiceItems ? { enriched_at: now } : {}),
  };
}

// ============================================
// LISTING TRANSFORM
// ============================================

export function transformListing(listing: any): Record<string, unknown> {
  const now = Date.now();

  return {
    guesty_id: listing._id,
    nickname: n(listing.nickname),
    title: n(listing.title),
    property_type: n(listing.propertyType),
    room_type: n(listing.roomType),
    bedrooms: n(listing.bedrooms),
    bathrooms: n(listing.bathrooms),
    beds: n(listing.beds),
    accommodates: n(listing.accommodates),
    area_square_feet: n(listing.areaSquareFeet),
    address: listing.address
      ? {
          full: n(listing.address.full),
          street: n(listing.address.street),
          city: n(listing.address.city),
          state: n(listing.address.state),
          country: n(listing.address.country),
          zipcode: n(listing.address.zipcode),
          lat: n(listing.address.lat),
          lng: n(listing.address.lng),
        }
      : null,
    prices: listing.prices
      ? {
          basePrice: n(listing.prices.basePrice),
          cleaningFee: n(listing.prices.cleaningFee),
          currency: n(listing.prices.currency),
          weeklyPriceFactor: n(listing.prices.weeklyPriceFactor),
          monthlyPriceFactor: n(listing.prices.monthlyPriceFactor),
          extraPersonFee: n(listing.prices.extraPersonFee),
          guestsIncludedInRegularFee: n(
            listing.prices.guestsIncludedInRegularFee
          ),
          securityDepositFee: n(listing.prices.securityDepositFee),
        }
      : null,
    active: n(listing.active),
    is_listed: n(listing.isListed),
    cleaning_status: n(listing.cleaningStatus),
    terms: listing.terms
      ? {
          minNights: n(listing.terms.minNights),
          maxNights: n(listing.terms.maxNights),
        }
      : null,
    default_check_in_time: n(listing.defaultCheckInTime),
    default_check_out_time: n(listing.defaultCheckOutTime),
    timezone: n(listing.timezone),
    picture: n(listing.picture?.thumbnail || listing.picture?.regular),
    picture_count: n(listing.pictures?.length),
    host_name: n(listing.hostName),
    contact_phone: n(listing.contactPhone),
    amenities: n(listing.amenities),
    tags: n(listing.tags),
    owners:
      listing.owners?.map((o: any) => ({
        _id: n(o._id),
        firstName: n(o.firstName),
        lastName: n(o.lastName),
        email: n(o.email),
      })) ?? null,
    integrations:
      listing.integrations?.map((i: any) => ({
        platform: n(i.platform),
        externalId: n(i.externalId || i._id),
      })) ?? null,
    // occupancy_stats: computed by /api/cron/refresh-occupancy (rare find badge)
    financials: n(listing.financials),
    custom_fields: n(listing.customFields),
    guesty_created_at: n(listing.createdAt),
    guesty_updated_at: n(listing.lastUpdatedAt),
    last_synced_at: now,
  };
}

// ============================================
// CALENDAR STATUS DERIVATION
// ============================================

export function deriveCalendarStatus(
  rawStatus: string | undefined,
  blocks: Record<string, boolean | undefined> | undefined,
  allotment: number | undefined
): "available" | "booked" | "blocked" {
  if (rawStatus === "booked") return "booked";
  if (blocks?.b || blocks?.r) return "booked";

  if (blocks) {
    const blockKeys = [
      "m",
      "bd",
      "sr",
      "abl",
      "a",
      "bw",
      "o",
      "pt",
      "ic",
      "an",
    ] as const;
    for (const key of blockKeys) {
      if (blocks[key]) return "blocked";
    }
  }

  if (allotment !== undefined && allotment <= 0) return "blocked";

  return "available";
}

// ============================================
// CALENDAR DAY TRANSFORM
// ============================================

export function transformCalendarDay(
  listingId: string,
  day: any
): Record<string, unknown> {
  const now = Date.now();
  const blocks = day.blocks ?? {};
  const status = deriveCalendarStatus(day.status, blocks, day.allotment);

  return {
    listing_id: listingId,
    date: day.date,
    price: n(day.price),
    currency: n(day.currency),
    is_base_price: n(day.isBasePrice),
    min_nights: n(day.minNights),
    is_base_min_nights: n(day.isBaseMinNights),
    status,
    raw_status: n(day.status),
    blocks: blocks
      ? {
          m: n(blocks.m),
          r: n(blocks.r),
          b: n(blocks.b),
          bd: n(blocks.bd),
          sr: n(blocks.sr),
          abl: n(blocks.abl),
          a: n(blocks.a),
          bw: n(blocks.bw),
          o: n(blocks.o),
          pt: n(blocks.pt),
          ic: n(blocks.ic),
          an: n(blocks.an),
        }
      : null,
    cta: n(day.cta),
    ctd: n(day.ctd),
    allotment: n(day.allotment),
    last_synced_at: now,
  };
}

// ============================================
// STALE SYNC RECOVERY
// ============================================

export async function recoverStaleSync(
  supabase: SupabaseClient,
  syncType: string,
  meta: { last_sync_status?: string; last_sync_at?: number } | null
): Promise<boolean> {
  if (meta?.last_sync_status === "in_progress" && meta?.last_sync_at) {
    const age = Date.now() - meta.last_sync_at;
    if (age > STALE_SYNC_TIMEOUT_MS) {
      console.warn(
        `Recovering stale "${syncType}" sync — stuck in_progress for ${Math.round(age / 60000)} min`
      );
      const { error } = await supabase.from("sync_metadata").upsert(
        {
          sync_type: syncType,
          last_sync_status: "stale_recovered",
          error_message: `Auto-recovered from stale in_progress after ${Math.round(age / 60000)} min`,
        },
        { onConflict: "sync_type" }
      );
      if (error) {
        console.error(`Failed to recover stale sync for ${syncType}:`, error);
      }
      return true;
    }
  }
  return false;
}

// ============================================
// RESPONSE HELPER
// ============================================

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
