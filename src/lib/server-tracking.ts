import crypto from "crypto";
import type { ConsentState } from "./consent";
import { uploadGoogleAdsPurchaseConversion } from "./google-ads-server";
import { upsertMetaVisitor } from "./meta-visitor-store";
import { parseFbcTimestamp } from "./meta-cookies";

// ─── TYPES ───────────────────────────────────────────────────────

interface Attribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  fbclid_ts?: string | number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface ServerEventContext {
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  gaSessionId?: string;
  // Stable SP-controlled visitor UUID — passed to Meta as external_id when
  // the guest has not yet provided an email, so Meta can build longitudinal
  // identity across sessions and eventually correlate with its user graph.
  externalId?: string;
  // Vercel edge geo (MaxMind-grade). Fills ct/st/zp/country in user_data for
  // probabilistic Meta matching on anonymous visitors. Guest-provided values
  // always win (form fills are more accurate than IP geo).
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface TrackingOptions {
  consent?: ConsentState;
}

interface BookingEventData {
  reservationId: string;
  /** Human-readable Guesty confirmation code (e.g. "GY-rNZRDKkN").
   *  Used as transaction_id when available so GA4 + Google Ads reports show
   *  the friendly code instead of the long hex `_id`. Falls back to
   *  reservationId. Added 2026-05-17. */
  confirmationCode?: string | null;
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  currency?: string;
  eventId: string;
  guest: TrackingGuest & { email: string };
  attribution?: Attribution;
  gaClientId?: string;
  context?: ServerEventContext;
}

interface TrackingGuest {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

interface ViewedListingData {
  listingId: string;
  listingTitle: string;
  propertyType?: string;
  city?: string;
  basePrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  gaClientId?: string;
  context?: ServerEventContext;
}

interface CheckoutStartedData {
  listingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  currency?: string;
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  gaClientId?: string;
  context?: ServerEventContext;
}

interface WishlistEventData {
  listingId: string;
  listingTitle?: string;
  price?: number;
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  context?: ServerEventContext;
}

interface AddPaymentInfoData {
  listingId: string;
  listingTitle: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  total: number;
  currency?: string;
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  context?: ServerEventContext;
}

interface PageViewData {
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  context?: ServerEventContext;
}

interface SearchData {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  city?: string;
  resultCount: number;
  resultIds: string[];
  url: string;
  eventId: string;
  attribution?: Attribution;
  guest?: TrackingGuest;
  context?: ServerEventContext;
}

interface RefundEventData {
  reservationId: string;
  listingId?: string;
  listingTitle?: string;
  refundAmount: number;
  currency?: string;
  guest?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  };
  attribution?: Attribution;
  gaClientId?: string;
  context?: ServerEventContext;
}

// ─── HELPERS ─────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

// Meta normalization rules before SHA-256. See
// shared/meta-capi-best-practices.md for the full spec.
function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
function normalizeState(state: string): string {
  return state.trim().toLowerCase();
}
function normalizeZip(zip: string): string {
  const digits = zip.trim().replace(/\D/g, "");
  return digits.slice(0, 5);
}
function normalizeCountry(country: string): string {
  return country.trim().toLowerCase();
}

// ─── META CONVERSIONS API ────────────────────────────────────────

async function sendMetaEvent(
  eventName: string,
  eventId: string,
  sourceUrl: string,
  customData: Record<string, unknown>,
  attribution?: Attribution,
  guest?: TrackingGuest,
  context?: ServerEventContext
) {
  const pixelId = (process.env.META_PIXEL_ID || "").trim();
  const token = (process.env.META_CAPI_TOKEN || "").trim();
  if (!pixelId || !token) return;

  const userData: Record<string, unknown> = {};
  if (guest?.email) {
    userData.em = [sha256(guest.email)];
    // Email-based external_id is deterministic — Meta can match exactly when
    // the same user's email is seen again. Always prefer over the visitor
    // UUID fallback below.
    userData.external_id = [sha256(guest.email)];
  } else if (context?.externalId) {
    // Fall back to the stable SP-controlled visitor UUID (set in middleware,
    // 1yr first-party cookie). Meta treats this as a business-provided ID and
    // uses it as a cross-session anchor to build longitudinal identity until
    // the user eventually provides an email.
    userData.external_id = [sha256(context.externalId)];
  }
  if (guest?.phone) userData.ph = [sha256(normalizePhone(guest.phone))];
  if (guest?.firstName) userData.fn = [sha256(guest.firstName)];
  if (guest?.lastName) userData.ln = [sha256(guest.lastName)];

  // Geo params: prefer guest-provided values (form fills are more accurate
  // than IP geo), fall back to Vercel edge geo headers from context. Every
  // field is normalized per Meta spec before hashing.
  const rawCity = guest?.city || context?.city;
  const rawState = guest?.state || context?.state;
  const rawZip = guest?.zip || context?.zip;
  const rawCountry = guest?.country || context?.country || "us";
  if (rawCity) {
    const normalized = normalizeCity(rawCity);
    if (normalized) userData.ct = [sha256(normalized)];
  }
  if (rawState) {
    const normalized = normalizeState(rawState);
    if (normalized) userData.st = [sha256(normalized)];
  }
  if (rawZip) {
    const normalized = normalizeZip(rawZip);
    if (normalized) userData.zp = [sha256(normalized)];
  }
  userData.country = [sha256(normalizeCountry(rawCountry))];

  // Client IP and User-Agent improve Event Match Quality
  if (context?.clientIp) userData.client_ip_address = context.clientIp;
  if (context?.clientUserAgent)
    userData.client_user_agent = context.clientUserAgent;

  // Facebook browser ID cookie (_fbp) — prefer cookie, fall back to client-sent value
  if (context?.fbp) userData.fbp = context.fbp;

  // Facebook click ID (_fbc cookie) — prefer the cookie set by Meta's pixel,
  // fall back to constructing from attribution.fbclid
  if (context?.fbc) {
    userData.fbc = context.fbc;
  } else if (attribution?.fbclid) {
    const clickTs = attribution.fbclid_ts || Date.now();
    userData.fbc = `fb.1.${clickTs}.${attribution.fbclid}`;
  }

  const eventData: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    event_source_url: sourceUrl,
    user_data: userData,
    custom_data: customData,
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v24.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [eventData],
          access_token: token,
          ...(process.env.META_TEST_EVENT_CODE && {
            test_event_code: process.env.META_TEST_EVENT_CODE,
          }),
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Meta CAPI] ${eventName} failed:`, err);
    }
  } catch (error) {
    console.error(`[Meta CAPI] ${eventName} error:`, error);
  }

  // Fire-and-forget cross-session persistence. Upsert keyed by visitor_id
  // (the SP-controlled UUID) so a returning visitor whose _fbp/_fbc cookies
  // were cleared still has their identifiers recoverable on the next CAPI
  // fire. Email hash is included once the guest provides one — that's the
  // join key Meta's user graph uses for cross-device stitching.
  if (context?.externalId) {
    const fbcStr = typeof userData.fbc === "string" ? userData.fbc : undefined;
    const fbpStr = typeof userData.fbp === "string" ? userData.fbp : undefined;
    upsertMetaVisitor({
      visitorId: context.externalId,
      fbp: fbpStr,
      fbc: fbcStr,
      fbclid: attribution?.fbclid,
      fbclidTs: fbcStr
        ? parseFbcTimestamp(fbcStr)
        : attribution?.fbclid_ts
          ? Number(attribution.fbclid_ts)
          : undefined,
      emailHash: guest?.email ? sha256(guest.email) : undefined,
    }).catch(() => {
      /* already logged in upsertMetaVisitor */
    });
  }
}

// ─── GA4 MEASUREMENT PROTOCOL ────────────────────────────────────

/**
 * Hash email to a consistent user ID for GA4 cross-device stitching.
 * Must match the client-side hash in tracking.ts.
 */
function hashEmailForUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `sp_${hash.toString(36)}`;
}

async function sendGA4Event(
  eventName: string,
  eventParams: Record<string, unknown>,
  attribution?: Attribution,
  gaClientId?: string,
  gaSessionId?: string,
  guestEmail?: string
) {
  const measurementId =
    process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-PPWFFFPC42";
  const apiSecret = (process.env.GA4_MP_API_SECRET || "").trim();
  if (!apiSecret) return;

  // Prefer browser's GA client_id for session stitching, fall back to generated ID
  const clientId =
    gaClientId ||
    `server.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;

  const payload = {
    client_id: clientId,
    // user_id enables GA4 cross-device stitching — links this server event
    // to the user's browser sessions on other devices
    ...(guestEmail && { user_id: hashEmailForUserId(guestEmail) }),
    events: [
      {
        name: eventName,
        params: {
          ...eventParams,
          // session_id stitches this event into the user's existing browser session
          // instead of creating an orphan session with "(not set)" attribution
          ...(gaSessionId && { session_id: gaSessionId }),
          // engagement_time_msec=1 is the minimum value GA4 accepts to count
          // an MP event as "engaged" — without it, server-side purchase/refund
          // events are flagged as unengaged hits and excluded from session
          // engagement metrics. Per GA4 MP docs.
          engagement_time_msec: 1,
          ...(attribution?.utm_source && {
            campaign_source: attribution.utm_source,
          }),
          ...(attribution?.utm_medium && {
            campaign_medium: attribution.utm_medium,
          }),
          ...(attribution?.utm_campaign && {
            campaign_name: attribution.utm_campaign,
          }),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok && res.status !== 204) {
      console.error(`[GA4 MP] ${eventName} failed: ${res.status}`);
    }
  } catch (error) {
    console.error(`[GA4 MP] ${eventName} error:`, error);
  }
}

export function parseGA4SessionId(
  cookieValue?: string | null
): string | undefined {
  if (!cookieValue) return undefined;

  const gs2Match = cookieValue.match(/(?:^|[.$])s(\d+)/);
  if (gs2Match?.[1]) return gs2Match[1];

  const gs1Match = cookieValue.match(/^GS1\.\d+\.(\d+)/);
  if (gs1Match?.[1]) return gs1Match[1];

  return undefined;
}

// ─── KLAVIYO SERVER API ──────────────────────────────────────────

export async function sendKlaviyoEvent(
  eventName: string,
  properties: Record<string, unknown>,
  options: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    value?: number;
    uniqueId?: string;
    attribution?: Attribution;
  }
) {
  const apiKey = (process.env.KLAVIYO_PRIVATE_KEY || "").trim();
  if (!apiKey || !options.email) return;

  const profileAttributes: Record<string, unknown> = {
    email: options.email,
  };
  if (options.phone)
    profileAttributes.phone_number = normalizePhone(options.phone);
  if (options.firstName) profileAttributes.first_name = options.firstName;
  if (options.lastName) profileAttributes.last_name = options.lastName;

  const attributes: Record<string, unknown> = {
    metric: { data: { type: "metric", attributes: { name: eventName } } },
    profile: {
      data: {
        type: "profile",
        attributes: profileAttributes,
      },
    },
    properties: {
      ...properties,
      ...(options.attribution?.utm_source && {
        "UTM Source": options.attribution.utm_source,
      }),
      ...(options.attribution?.utm_medium && {
        "UTM Medium": options.attribution.utm_medium,
      }),
      ...(options.attribution?.utm_campaign && {
        "UTM Campaign": options.attribution.utm_campaign,
      }),
    },
    time: new Date().toISOString(),
  };
  if (options.value !== undefined) attributes.value = options.value;
  if (options.uniqueId) attributes.unique_id = options.uniqueId;

  try {
    const res = await fetch("https://a.klaviyo.com/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: "2025-04-15",
      },
      body: JSON.stringify({ data: { type: "event", attributes } }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[Klaviyo] ${eventName} failed:`, err);
    }
  } catch (error) {
    console.error(`[Klaviyo] ${eventName} error:`, error);
  }
}

const KLAVIYO_EMAIL_LIST_ID = "S9Ezba";

export async function subscribeToKlaviyoList(profile: {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}) {
  const apiKey = (process.env.KLAVIYO_PRIVATE_KEY || "").trim();
  if (!apiKey || !profile.email) return;

  const profileAttributes: Record<string, unknown> = {
    email: profile.email,
    subscriptions: {
      email: { marketing: { consent: "SUBSCRIBED" } },
    },
  };
  if (profile.phone) {
    profileAttributes.phone_number = normalizePhone(profile.phone);
    profileAttributes.subscriptions = {
      email: { marketing: { consent: "SUBSCRIBED" } },
      sms: { marketing: { consent: "SUBSCRIBED" } },
    };
  }
  if (profile.firstName) profileAttributes.first_name = profile.firstName;
  if (profile.lastName) profileAttributes.last_name = profile.lastName;

  try {
    const res = await fetch(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: "2025-04-15",
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [{ type: "profile", attributes: profileAttributes }],
              },
            },
            relationships: {
              list: { data: { type: "list", id: KLAVIYO_EMAIL_LIST_ID } },
            },
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("[Klaviyo] Subscribe failed:", err);
    }
  } catch (error) {
    console.error("[Klaviyo] Subscribe error:", error);
  }
}

// ─── PUBLIC API ──────────────────────────────────────────────────

export async function trackViewedListingServerSide(
  data: ViewedListingData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  await Promise.allSettled([
    // Meta CAPI - ViewContent (deduplicates with browser fbq via eventId)
    sendMetaEvent(
      "ViewContent",
      data.eventId,
      data.url,
      {
        content_type: "hotel",
        content_ids: [data.listingId],
        content_name: data.listingTitle,
        ...(typeof data.basePrice === "number" &&
          data.basePrice > 0 && { value: data.basePrice }),
        currency: "USD",
        region: "Colorado",
        country: "US",
        ...(data.city && {
          city: data.city,
          destination: `${data.city}, Colorado, USA`,
        }),
      },
      data.attribution,
      data.guest,
      data.context
    ),

    // GA4 view_item is handled client-side only (gtag) — no MP call here
    // to avoid double-counting. GA4 doesn't deduplicate between gtag and MP.
  ]);
}

export async function trackPageViewServerSide(
  data: PageViewData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  await sendMetaEvent(
    "PageView",
    data.eventId,
    data.url,
    {},
    data.attribution,
    data.guest,
    data.context
  );
}

export async function trackSearchServerSide(
  data: SearchData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  const now = new Date();
  const defaultCheckIn = new Date(now.getTime() + 14 * 86400000)
    .toISOString()
    .split("T")[0];
  const defaultCheckOut = new Date(now.getTime() + 21 * 86400000)
    .toISOString()
    .split("T")[0];

  await sendMetaEvent(
    "Search",
    data.eventId,
    data.url,
    {
      content_type: "hotel",
      content_ids: data.resultIds.slice(0, 20),
      checkin_date: data.checkIn || defaultCheckIn,
      checkout_date: data.checkOut || defaultCheckOut,
      destination: data.city
        ? `${data.city}, Colorado, USA`
        : "Crested Butte, Colorado, USA",
      city: data.city || "Crested Butte",
      region: "Colorado",
      country: "US",
      num_adults: data.guests || 2,
      currency: "USD",
    },
    data.attribution,
    data.guest,
    data.context
  );
}

export async function trackWishlistServerSide(
  data: WishlistEventData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  // Meta CAPI - AddToWishlist (deduplicates with browser fbq via eventId)
  await sendMetaEvent(
    "AddToWishlist",
    data.eventId,
    data.url,
    {
      content_type: "hotel",
      content_ids: [data.listingId],
      ...(data.listingTitle && { content_name: data.listingTitle }),
      ...(typeof data.price === "number" &&
        data.price > 0 && { value: data.price }),
      currency: "USD",
      region: "Colorado",
      country: "US",
    },
    data.attribution,
    data.guest,
    data.context
  );
}

/**
 * Multi-listing cart "Add to Cart" — fired when AddToCartButton click adds a
 * listing to the group-booking cart. Mirrors the wishlist pattern (Meta CAPI
 * deduped via shared eventId; client also fires fbq + GA4 + Klaviyo).
 */
export async function trackAddToCartServerSide(
  data: AddPaymentInfoData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;
  await sendMetaEvent(
    "AddToCart",
    data.eventId,
    data.url,
    {
      content_type: "hotel",
      content_ids: [data.listingId],
      content_name: data.listingTitle,
      ...(typeof data.total === "number" && data.total > 0 && { value: data.total }),
      currency: data.currency || "USD",
      ...(data.checkIn && { checkin_date: data.checkIn }),
      ...(data.checkOut && { checkout_date: data.checkOut }),
      ...(typeof data.guests === "number" && { num_adults: data.guests }),
      region: "Colorado",
      country: "US",
    },
    data.attribution,
    data.guest,
    data.context
  );
}

export async function trackAddPaymentInfoServerSide(
  data: AddPaymentInfoData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  // Meta CAPI - AddPaymentInfo (deduplicates with browser fbq via eventId)
  await sendMetaEvent(
    "AddPaymentInfo",
    data.eventId,
    data.url,
    {
      value: data.total,
      currency: data.currency || "USD",
      content_type: "hotel",
      content_ids: [data.listingId],
      content_name: data.listingTitle,
      ...(data.checkIn && { checkin_date: data.checkIn }),
      ...(data.checkOut && { checkout_date: data.checkOut }),
      ...(typeof data.guests === "number" && { num_adults: data.guests }),
      region: "Colorado",
      country: "US",
    },
    data.attribution,
    data.guest,
    data.context
  );
}

export async function trackCheckoutServerSide(
  data: CheckoutStartedData,
  options?: TrackingOptions
) {
  if (options?.consent?.marketing === false) return;

  await Promise.allSettled([
    // Meta CAPI - InitiateCheckout (deduplicates with browser fbq via eventId)
    sendMetaEvent(
      "InitiateCheckout",
      data.eventId,
      data.url,
      {
        value: data.total,
        currency: data.currency || "USD",
        content_type: "hotel",
        content_ids: [data.listingId],
        content_name: data.listingTitle,
        checkin_date: data.checkIn,
        checkout_date: data.checkOut,
        num_adults: data.guests,
        region: "Colorado",
        country: "US",
      },
      data.attribution,
      data.guest,
      data.context
    ),

    // GA4 begin_checkout is handled client-side only (gtag) — no MP call here
    // to avoid double-counting. GA4 doesn't deduplicate between gtag and MP.
  ]);
}

export async function trackBookingServerSide(
  data: BookingEventData,
  options?: TrackingOptions
) {
  const jobs: Promise<unknown>[] = [];
  // Prefer the human-readable confirmation code (e.g. "GY-rNZRDKkN") as the
  // transaction_id sent to GA4. Falls back to the Guesty Mongo _id.
  const transactionId = data.confirmationCode || data.reservationId;

  if (options?.consent?.marketing !== false) {
    jobs.push(
      sendMetaEvent(
        "Purchase",
        data.eventId,
        `https://www.booktraverse.com/book/confirmation/${data.reservationId}`,
        {
          value: data.total,
          currency: data.currency || "USD",
          content_type: "hotel",
          content_ids: [data.listingId],
          content_name: data.listingTitle,
          order_id: data.reservationId,
          checkin_date: data.checkIn,
          checkout_date: data.checkOut,
          num_adults: data.guests,
          region: "Colorado",
          country: "US",
        },
        data.attribution,
        data.guest,
        data.context
      )
    );

    jobs.push(
      sendKlaviyoEvent(
        "Booked Reservation",
        {
          Title: data.listingTitle,
          ID: data.listingId,
          CheckIn: data.checkIn,
          CheckOut: data.checkOut,
          "Number of Guests": data.guests,
          $value: data.total,
          "Confirmation Code": data.reservationId,
          "Guest Email": data.guest.email,
        },
        {
          email: data.guest.email,
          phone: data.guest.phone,
          firstName: data.guest.firstName,
          lastName: data.guest.lastName,
          value: data.total,
          uniqueId: data.reservationId,
          attribution: data.attribution,
        }
      )
    );

    jobs.push(
      uploadGoogleAdsPurchaseConversion({
        consentGranted: options?.consent?.marketing ?? true,
        currency: data.currency || "USD",
        gclid: data.attribution?.gclid,
        gbraid: data.attribution?.gbraid,
        wbraid: data.attribution?.wbraid,
        reservationId: data.reservationId,
        value: data.total,
        email: data.guest.email,
        phone: data.guest.phone,
        userAgent: data.context?.clientUserAgent,
      })
    );
  }

  if (options?.consent?.analytics !== false) {
    jobs.push(
      sendGA4Event(
        "purchase",
        {
          transaction_id: transactionId,
          value: data.total,
          currency: data.currency || "USD",
          items: [
            {
              item_id: data.listingId,
              item_name: data.listingTitle,
              ...(data.listingNickname && {
                item_variant: data.listingNickname,
              }),
              price: data.total,
              quantity: 1,
            },
          ],
          check_in: data.checkIn,
          check_out: data.checkOut,
          guests: data.guests,
        },
        data.attribution,
        data.gaClientId,
        data.context?.gaSessionId,
        data.guest.email
      )
    );
  }

  await Promise.allSettled(jobs);
}

export async function trackRefundServerSide(
  data: RefundEventData,
  options?: TrackingOptions
) {
  const jobs: Promise<unknown>[] = [];

  if (options?.consent?.marketing !== false && data.listingId) {
    jobs.push(
      sendMetaEvent(
        "Refund",
        `refund_${data.reservationId}`,
        `https://www.booktraverse.com/account/reservations/${data.reservationId}`,
        {
          value: data.refundAmount,
          currency: data.currency || "USD",
          content_type: "hotel",
          content_ids: [data.listingId],
          content_name: data.listingTitle || data.listingId,
          order_id: data.reservationId,
        },
        data.attribution,
        data.guest,
        data.context
      )
    );
  }

  if (options?.consent?.analytics !== false) {
    jobs.push(
      sendGA4Event(
        "refund",
        {
          transaction_id: data.reservationId,
          value: data.refundAmount,
          currency: data.currency || "USD",
          ...(data.listingId
            ? {
                items: [
                  {
                    item_id: data.listingId,
                    item_name: data.listingTitle || data.listingId,
                    price: data.refundAmount,
                    quantity: 1,
                  },
                ],
              }
            : {}),
        },
        data.attribution,
        data.gaClientId,
        data.context?.gaSessionId
      )
    );
  }

  await Promise.allSettled(jobs);
}

export async function trackCancellationServerSide(
  data: RefundEventData & { refunded: boolean },
  options?: TrackingOptions
) {
  const jobs: Promise<unknown>[] = [];

  if (options?.consent?.marketing !== false && data.listingId) {
    jobs.push(
      sendMetaEvent(
        "ReservationCanceled",
        `cancel_${data.reservationId}`,
        `https://www.booktraverse.com/account/reservations/${data.reservationId}`,
        {
          value: data.refundAmount,
          currency: data.currency || "USD",
          content_type: "hotel",
          content_ids: [data.listingId],
          content_name: data.listingTitle || data.listingId,
          order_id: data.reservationId,
          refunded: data.refunded,
        },
        data.attribution,
        data.guest,
        data.context
      )
    );
  }

  if (options?.consent?.analytics !== false) {
    jobs.push(
      sendGA4Event(
        "reservation_canceled",
        {
          transaction_id: data.reservationId,
          value: data.refundAmount,
          currency: data.currency || "USD",
          refunded: data.refunded,
          listing_id: data.listingId,
          listing_title: data.listingTitle,
        },
        data.attribution,
        data.gaClientId,
        data.context?.gaSessionId
      )
    );
  }

  await Promise.allSettled(jobs);
}
