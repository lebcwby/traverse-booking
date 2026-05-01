import { getSupabaseAdmin } from "./supabase-admin";
import { sendAlert } from "./alerts";

const BEAPI_BASE_URL = "https://booking.guesty.com";
const FULL_SEARCH_LISTING_FIELDS =
  "prices pictures title nickname address bedrooms bathrooms beds accommodates amenities propertyType roomType tags reviews publicDescription nightlyRates allotment";
const CARD_SEARCH_LISTING_FIELDS =
  "prices picture title nickname address bedrooms bathrooms beds accommodates amenities propertyType roomType tags reviews";

// ─── Token Strategy ──────────────────────────────────────────────
// Guesty enforces a HARD limit of 5 OAuth tokens per 24 hours per client.
// Burning all 5 = 24-hour lockout. This is catastrophic for the website.
//
// This file is STRICTLY READ-ONLY against guesty_tokens:
//   1. Reads tokens from Supabase + in-memory cache
//   2. NEVER writes, updates, or expires tokens in Supabase
//   3. On 401, clears in-memory cache only — does NOT touch Supabase
//   4. Token refresh is handled EXCLUSIVELY by refresh-tokens edge function (pg_cron)
//   5. No OAuth calls, no token persistence, no token expiration writes

const TOKEN_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours — token is "fresh" if > 2h remaining

// In-memory cache — survives within same Vercel serverless instance.
let memoryToken: { token: string; expiresAt: number } | null = null;

// ─── Token Management ─────────────────────────────────────────────

function isTokenFresh(expiresAt: number): boolean {
  return expiresAt > Date.now() + TOKEN_BUFFER_MS;
}

function isTokenUsable(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

/**
 * Read the cached token from Supabase. Returns the token if it exists and hasn't expired.
 * Sets a flag if the token is within the buffer window (needs refresh but is still usable).
 */
async function getSupabaseCachedToken(): Promise<{
  token: string;
  expiresAt: number;
  needsRefresh: boolean;
} | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("guesty_tokens")
      .select("access_token, expires_at")
      .eq("token_type", "beapi")
      .single();

    if (error) {
      console.warn("BEAPI token cache lookup failed:", error.message);
      return null;
    }

    if (data && isTokenUsable(data.expires_at)) {
      const needsRefresh = !isTokenFresh(data.expires_at);
      if (needsRefresh) {
        const remaining = Math.round((data.expires_at - Date.now()) / 60000);
        console.log(
          `BEAPI token has ${remaining}min remaining (within buffer) — usable but should refresh`
        );
      }
      return {
        token: data.access_token,
        expiresAt: data.expires_at,
        needsRefresh,
      };
    }

    if (data) {
      console.log("BEAPI token is fully expired in Supabase");
    }
  } catch (err) {
    console.error("Unexpected error checking BEAPI token cache:", err);
  }

  return null;
}

// Token writes removed — refresh-tokens edge function is the SOLE owner of
// guesty_tokens rows. The app is strictly read-only to prevent token-burn
// cycles (401 → expire → cron refresh → 401 → burn all 5 tokens).

// ─── Main Token Retrieval ────────────────────────────────────────
// Strictly read-only. No writes to guesty_tokens. No OAuth calls.

export async function getBEAPIToken(): Promise<string> {
  // Layer 1: In-memory cache (no network)
  if (memoryToken && isTokenUsable(memoryToken.expiresAt)) {
    return memoryToken.token;
  }

  // Layer 2: Supabase persistent cache (survives cold starts)
  const cached = await getSupabaseCachedToken();
  if (cached) {
    memoryToken = { token: cached.token, expiresAt: cached.expiresAt };
    return cached.token;
  }

  // No usable token — alert and fail.
  const msg = "BEAPI token expired — refresh-tokens pg_cron must refresh it";
  await sendAlert("CRITICAL: BEAPI Token Expired", msg, "beapi-token-expired");
  throw new Error(msg);
}

// ─── Authenticated BEAPI Fetch ────────────────────────────────────

async function beapiFetch(
  path: string,
  options?: RequestInit & { next?: { revalidate?: number } },
  retries = 4
) {
  const { next: nextOpts, ...restOptions } = options || {};

  for (let attempt = 1; attempt <= retries; attempt++) {
    const token = await getBEAPIToken();
    const response = await fetch(`${BEAPI_BASE_URL}${path}`, {
      ...restOptions,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...restOptions?.headers,
      },
      ...(nextOpts ? { next: nextOpts } : {}),
    });

    // 403 Forbidden: listing not accessible via BEAPI (not in booking engine).
    if (response.status === 403) {
      const text = await response.text();
      console.error(
        `BEAPI 403 (forbidden) on ${path} — listing may not be in booking engine`
      );
      await sendAlert(
        "BEAPI 403 Forbidden",
        `Guesty BEAPI returned 403 on <code>${path}</code>. This listing is likely not enabled in the Guesty Booking Engine.`,
        "beapi-403-forbidden"
      );
      throw new Error(`BEAPI ${path} forbidden: 403 ${text}`);
    }

    // 401 Unauthorized: token may be revoked or temporarily invalid.
    // Clear in-memory cache only — NEVER write to guesty_tokens.
    // The refresh-tokens edge function (pg_cron) owns all token lifecycle.
    if (response.status === 401) {
      console.error(
        `BEAPI auth failure (401) on ${path} — attempt ${attempt}/${retries}`
      );
      memoryToken = null;
      if (attempt < retries) continue;

      await sendAlert(
        "BEAPI Auth Failure — Retries Exhausted",
        `Guesty BEAPI returned 401 on <code>${path}</code> after ${retries} attempts. Memory cache cleared — refresh-tokens pg_cron will handle token renewal.`,
        "beapi-auth-exhausted"
      );
    }

    // Rate limit: exponential backoff
    if (response.status === 429) {
      if (attempt < retries) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BEAPI ${path} failed: ${response.status} ${text}`);
    }

    return response.json();
  }
}

// ─── 1. SEARCH LISTINGS ────────────────────────────────────────────

export interface SearchListingsParams {
  checkIn?: string;
  checkOut?: string;
  minOccupancy?: number;
  numberOfBedrooms?: number;
  numberOfBathrooms?: number;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  includeAmenities?: string;
  petsAllowed?: boolean;
  city?: string;
  country?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  tags?: string[];
  limit?: number;
  cursor?: string;
}

export async function searchListings(params: SearchListingsParams) {
  return searchListingsWithCacheMode(params, { cache: "no-store" });
}

export async function searchListingsCached(
  params: SearchListingsParams,
  revalidate = 300
) {
  return searchListingsWithCacheMode(
    params,
    { next: { revalidate } },
    FULL_SEARCH_LISTING_FIELDS
  );
}

export async function searchCardListingsCached(
  params: SearchListingsParams,
  revalidate = 300
) {
  return searchListingsWithCacheMode(
    params,
    { next: { revalidate } },
    CARD_SEARCH_LISTING_FIELDS
  );
}

async function searchListingsWithCacheMode(
  params: SearchListingsParams,
  options: RequestInit & { next?: { revalidate?: number } },
  fields = FULL_SEARCH_LISTING_FIELDS
) {
  const sp = new URLSearchParams();

  if (params.checkIn) sp.set("checkIn", params.checkIn);
  if (params.checkOut) sp.set("checkOut", params.checkOut);
  if (params.minOccupancy) sp.set("minOccupancy", String(params.minOccupancy));
  if (params.numberOfBedrooms)
    sp.set("numberOfBedrooms", String(params.numberOfBedrooms));
  if (params.numberOfBathrooms)
    sp.set("numberOfBathrooms", String(params.numberOfBathrooms));
  if (params.propertyType) sp.set("propertyType", params.propertyType);
  if (params.minPrice) sp.set("minPrice", String(params.minPrice));
  if (params.maxPrice) sp.set("maxPrice", String(params.maxPrice));
  if (params.currency) sp.set("currency", params.currency);
  if (params.includeAmenities)
    sp.set("includeAmenities", params.includeAmenities);
  if (params.petsAllowed) sp.set("petsAllowed", "true");
  if (params.city) sp.set("city", params.city);
  if (params.country) sp.set("country", params.country);
  if (params.minLat != null) sp.set("minLat", String(params.minLat));
  if (params.maxLat != null) sp.set("maxLat", String(params.maxLat));
  if (params.minLng != null) sp.set("minLng", String(params.minLng));
  if (params.maxLng != null) sp.set("maxLng", String(params.maxLng));
  if (params.tags) params.tags.forEach((t) => sp.append("tags", t));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.cursor) sp.set("cursor", params.cursor);

  sp.set("fields", fields);

  return beapiFetch(`/api/listings?${sp.toString()}`, options);
}

// ─── 2. PROPERTY INFO ──────────────────────────────────────────────

export async function getListingDetail(listingId: string) {
  const fields = [
    "prices",
    "pictures",
    "title",
    "nickname",
    "address",
    "bedrooms",
    "bathrooms",
    "beds",
    "accommodates",
    "amenities",
    "propertyType",
    "roomType",
    "tags",
    "reviews",
    "publicDescription",
    "terms",
    "calendarRules",
    "taxes",
    "defaultCheckInTime",
    "defaultCheckOutTime",
    "bedArrangements",
    "unitTypeHouseRules",
    "autoPayments",
  ].join(" ");

  return beapiFetch(
    `/api/listings/${listingId}?fields=${encodeURIComponent(fields)}`,
    {
      next: { revalidate: 300 },
    }
  );
}

// ─── 3. CALENDAR / AVAILABILITY ────────────────────────────────────

export interface CalendarDay {
  date: string;
  status: "available" | "unavailable" | "reserved" | "booked";
  minNights: number;
  isBaseMinNights: boolean;
  cta: boolean;
  ctd: boolean;
}

export async function getListingCalendar(
  listingId: string,
  from: string,
  to: string
): Promise<CalendarDay[]> {
  return beapiFetch(
    `/api/listings/${listingId}/calendar?from=${from}&to=${to}`
  );
}

// ─── 4. PRICE QUOTES ───────────────────────────────────────────────

export async function createQuote(params: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  coupons?: string;
  pointofsale?: string;
}) {
  return beapiFetch("/api/reservations/quotes", {
    method: "POST",
    body: JSON.stringify({
      listingId: params.listingId,
      checkInDateLocalized: params.checkIn,
      checkOutDateLocalized: params.checkOut,
      guestsCount: params.guestsCount,
      ...(params.coupons ? { coupons: params.coupons } : {}),
      ...(params.pointofsale ? { pointofsale: params.pointofsale } : {}),
    }),
  });
}

export async function getQuote(quoteId: string) {
  return beapiFetch(`/api/reservations/quotes/${quoteId}`);
}

export async function addCouponToQuote(quoteId: string, coupon: string) {
  return beapiFetch(`/api/reservations/quotes/${quoteId}/coupons`, {
    method: "POST",
    body: JSON.stringify({ coupons: [coupon] }),
  });
}

// ─── 5. PAYMENT PROVIDER ──────────────────────────────────────────

export async function getListingPaymentProvider(listingId: string) {
  return beapiFetch(`/api/listings/${listingId}/payment-provider`);
}

// ─── 6. PAYOUT SCHEDULE ───────────────────────────────────────────

export async function getPayoutSchedule(params: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  total: number;
  bookingType?: "INSTANT" | "INQUIRY";
}) {
  const sp = new URLSearchParams({
    listingId: params.listingId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    total: String(params.total),
    bookingType: params.bookingType || "INSTANT",
  });
  return beapiFetch(`/api/reservations/payouts/list?${sp.toString()}`);
}

// ─── 7. CREATE RESERVATION ────────────────────────────────────────

export async function createReservationInstant(params: {
  quoteId: string;
  ratePlanId: string;
  ccToken: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  policy: {
    privacy: { version: number; dateOfAcceptance: string; isAccepted: boolean };
    termsAndConditions: { dateOfAcceptance: string; isAccepted: boolean };
    marketing?: { isAccepted: boolean };
  };
}) {
  return beapiFetch(`/api/reservations/quotes/${params.quoteId}/instant`, {
    method: "POST",
    body: JSON.stringify({
      ratePlanId: params.ratePlanId,
      ccToken: params.ccToken,
      guest: params.guest,
      policy: params.policy,
    }),
  });
}

export async function createInstantChargeReservation(params: {
  quoteId: string;
  ratePlanId: string;
  confirmationToken?: string;
  initialPaymentMethodId?: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      countryCode: string;
    };
  };
  policy: {
    privacy: { version: number; dateOfAcceptance: string; isAccepted: boolean };
    termsAndConditions: { dateOfAcceptance: string; isAccepted: boolean };
    marketing?: { isAccepted: boolean };
  };
}) {
  return beapiFetch(
    `/api/reservations/quotes/${params.quoteId}/instant-charge`,
    {
      method: "POST",
      body: JSON.stringify({
        ratePlanId: params.ratePlanId,
        ...(params.confirmationToken
          ? { confirmationToken: params.confirmationToken }
          : {}),
        ...(params.initialPaymentMethodId
          ? { initialPaymentMethodId: params.initialPaymentMethodId }
          : {}),
        guest: params.guest,
        policy: params.policy,
      }),
    }
  );
}

export async function verifyPayment(quoteId: string, reservationId: string) {
  return beapiFetch(
    `/api/reservations/quotes/${quoteId}/instant-charge/${reservationId}/verify-payment`,
    {
      method: "POST",
    }
  );
}

export async function createInquiryReservation(params: {
  quoteId: string;
  ratePlanId: string;
  ccToken?: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  reservedUntil?: number;
  policy: {
    privacy: { version: number; dateOfAcceptance: string; isAccepted: boolean };
    termsAndConditions: { dateOfAcceptance: string; isAccepted: boolean };
  };
}) {
  return beapiFetch(`/api/reservations/quotes/${params.quoteId}/inquiry`, {
    method: "POST",
    body: JSON.stringify({
      ratePlanId: params.ratePlanId,
      ...(params.ccToken ? { ccToken: params.ccToken } : {}),
      guest: params.guest,
      reservedUntil: params.reservedUntil ?? -1,
      policy: params.policy,
    }),
  });
}

// ─── 8. RETRIEVE RESERVATION ──────────────────────────────────────

export async function getReservation(reservationId: string) {
  return beapiFetch(`/api/reservations/${reservationId}/details`);
}

// ─── 9. CITIES ────────────────────────────────────────────────────

export async function getListingCities() {
  return beapiFetch("/api/listings/cities");
}
