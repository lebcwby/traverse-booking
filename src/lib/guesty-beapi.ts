import { getSupabaseAdmin } from "./supabase-admin";
import { sendAlert } from "./alerts";
import { rateLimit } from "./rate-limit";

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

// ─── Self-heal state ─────────────────────────────────────────────
// Last time this serverless instance asked the cron route to refresh the
// token. Throttle to once per SELF_HEAL_COOLDOWN_MS so a stampede of 401s
// or expired-token reads can't burn through Guesty's 5-tokens-per-24h cap.
let lastSelfHealAttemptAt = 0;
const SELF_HEAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fire-and-forget call to /api/cron/refresh-tokens via internal HTTPS,
 * using the CRON_SECRET to authenticate as the cron itself. This is the
 * SAFE way to trigger a refresh from runtime code — we never touch the
 * guesty_tokens table directly (see "Token Strategy" header). The cron
 * route already has its own dedup-by-expiry-buffer logic, so calling it
 * repeatedly within a few seconds doesn't actually fire multiple OAuth
 * requests.
 *
 * Throttled to once per SELF_HEAL_COOLDOWN_MS per serverless instance.
 * Returns true if a refresh was attempted, false if throttled.
 */
async function attemptTokenSelfHeal(reason: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastSelfHealAttemptAt < SELF_HEAL_COOLDOWN_MS) {
    return false;
  }
  lastSelfHealAttemptAt = now;

  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.booktraverse.com";
  if (!cronSecret) {
    console.warn(
      "[BEAPI self-heal] CRON_SECRET not set — can't trigger refresh"
    );
    return false;
  }

  console.warn(`[BEAPI self-heal] Triggering refresh — reason: ${reason}`);
  try {
    // Use a short timeout so we don't block the user's request waiting on
    // the refresh — fire it, wait briefly for it to complete in the
    // common case, then proceed. AbortController gives us the timeout.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${siteUrl}/api/cron/refresh-tokens`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!resp.ok) {
      console.warn(
        `[BEAPI self-heal] Refresh route returned ${resp.status} — continuing anyway`
      );
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[BEAPI self-heal] Refresh trigger failed: ${msg}`);
    return false;
  }
}

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

  // Layer 3: Self-heal. No usable token in either cache — the Vercel cron
  // probably dropped its fire. Trigger the refresh-tokens route once
  // (throttled), wait for it, then re-poll Supabase. If still expired
  // after that, alert and fail. The throttle keeps a stampede of expired-
  // token requests from burning through Guesty's 5 OAuth tokens / 24h.
  const healed = await attemptTokenSelfHeal("getBEAPIToken found no usable token");
  if (healed) {
    // After the cron route returns, the new token row is in Supabase.
    // Re-poll once.
    const retried = await getSupabaseCachedToken();
    if (retried) {
      memoryToken = { token: retried.token, expiresAt: retried.expiresAt };
      console.log("[BEAPI self-heal] Recovery succeeded");
      return retried.token;
    }
    console.warn(
      "[BEAPI self-heal] Refresh route ran but Supabase still has no usable token"
    );
  }

  // Either self-heal was throttled (already attempted recently) or the
  // refresh route itself failed. Alert and surface the error.
  const msg = "BEAPI token expired — self-heal exhausted, manual refresh needed";
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
      // Retries exhausted on a 429 — Guesty is actively rejecting us. A few
      // of these are normal under load; a burst is the signature of a
      // scraper/traffic spike eating our API quota (and breaking calendar
      // loads for real guests). Use the shared limiter purely as a
      // cross-instance counter: the 6th terminal 429 inside 5 min flips
      // allowed→false, which is our trigger. sendAlert dedups to 1/hour.
      // Awaited (not fire-and-forget) because this is an error path that's
      // about to throw — a detached promise can be dropped when the lambda
      // freezes after the response. The extra latency only hits failing
      // requests, which are already rare.
      try {
        const burst = await rateLimit("guesty-429-burst", {
          limit: 5,
          windowMs: 5 * 60 * 1000,
        });
        if (!burst.allowed) {
          await sendAlert(
            "Guesty API rate-limiting spike",
            `Guesty returned <strong>6+ rate-limit (429) errors within 5 minutes</strong> ` +
              `on BEAPI calls (most recent path: <code>${path}</code>).<br/><br/>` +
              `This usually means a traffic spike or scraper is exhausting our Guesty ` +
              `API quota — availability/calendar loads can start failing for real guests.<br/><br/>` +
              `<strong>Check:</strong> Vercel Firewall (traffic by IP / user-agent) and ` +
              `<a href="https://www.booktraverse.com/api/health/beapi">/api/health/beapi</a> token status. ` +
              `If it's an active flood, toggle Attack Challenge Mode in the Vercel Firewall.`,
            "guesty-429-burst"
          );
        }
      } catch {
        // best-effort — never let alerting break the BEAPI error path
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

// `_id` on the response = the `paymentProviderId` the GuestyPay tokenization
// SDK render needs; `processor` reveals GuestyPay vs Stripe. Cached 1h — a
// listing's provider rarely changes, and this is hit on every checkout load.
export async function getListingPaymentProvider(listingId: string) {
  return beapiFetch(`/api/listings/${listingId}/payment-provider`, {
    next: { revalidate: 3600 },
  });
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
