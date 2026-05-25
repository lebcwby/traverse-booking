import { hasAnalyticsConsent, hasMarketingConsent } from "./consent";
import { trackBehavior } from "./behavior-tracking";
import { getDiscoveredClientIp } from "./client-ip-discovery";
import {
  getGoogleAdsCheckoutSendTo,
  getGoogleAdsPurchaseSendTo,
} from "./google-ads-public";
import { getKnownGuest, setKnownGuest } from "./known-guest";
import { waitForPixelAndFbp } from "./meta-pixel-wait";
import {
  noteAddToWishlist as qeNoteWishlist,
  noteSearch as qeNoteSearch,
  noteViewItem as qeNoteViewItem,
} from "./qualified-engagement";

declare global {
  interface Window {
    klaviyo?: {
      identify: (properties: Record<string, string>) => Promise<void>;
      track: (
        event: string,
        properties: Record<string, unknown>
      ) => Promise<void>;
    };
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    uetq?: Array<unknown>;
  }
}

// Generate a unique event ID for deduplication between browser and server
function generateEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Read Meta cookies from document.cookie for CAPI fallback.
// Cookies may not be forwarded reliably in in-app browsers or when
// third-party cookie restrictions apply, so we send them in the body too.
function getMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const cookies = document.cookie;
  const fbp = cookies.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1];
  const fbc = cookies.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1];
  return { fbp: fbp || undefined, fbc: fbc || undefined };
}

function normalizeGoogleAdsValue(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function normalizePhoneE164(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

function buildGoogleAdsUserData(data: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  country?: string;
}) {
  const userData: {
    email?: string;
    phone_number?: string;
    address?: {
      first_name: string;
      last_name: string;
      postal_code: string;
      country: string;
    };
  } = {};

  const email = normalizeGoogleAdsValue(data.email);
  const phoneNumber = normalizePhoneE164(data.phone);
  const firstName = normalizeGoogleAdsValue(data.firstName);
  const lastName = normalizeGoogleAdsValue(data.lastName);
  const postalCode = normalizeGoogleAdsValue(data.postalCode);
  const country = normalizeGoogleAdsValue(data.country);

  if (email) userData.email = email;
  if (phoneNumber) userData.phone_number = phoneNumber;

  // Google requires postal_code and country whenever address data is sent.
  if (firstName && lastName && postalCode && country) {
    userData.address = {
      first_name: firstName,
      last_name: lastName,
      postal_code: postalCode,
      country,
    };
  }

  return Object.keys(userData).length > 0 ? userData : undefined;
}

/**
 * Hash email to a consistent user ID for GA4 cross-device stitching.
 * Uses a simple FNV-1a-like hash (deterministic, fast, no crypto dependency).
 * The value only needs to be consistent and non-PII — not cryptographically secure.
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

export function identifyUser(
  email: string,
  phone?: string,
  firstName?: string,
  lastName?: string
) {
  // GA4 User-ID — enables cross-device session stitching.
  // Set regardless of marketing consent since it's analytics-only (hashed, non-PII).
  if (hasAnalyticsConsent() && window.gtag) {
    const userId = hashEmailForUserId(email);
    window.gtag("set", { user_id: userId });
    window.gtag("config", process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID!, {
      user_id: userId,
    });
  }

  if (!hasMarketingConsent()) return;

  // Meta Advanced Matching + CAPI enrichment — feeds every subsequent
  // tracking fire for this session. Dispatches sp:known-guest-updated which
  // ConsentManager listens for to re-init the browser pixel.
  setKnownGuest({ email, phone, firstName, lastName });

  // Microsoft UET enhanced conversions — `set { pid }` attaches identity to
  // every subsequent uetq event in this session, parallel to Google's
  // `gtag('set', 'user_data', …)`. UET hashes raw values client-side, so
  // we don't pre-hash here. Phone normalized to E.164 to match Bing's spec.
  if (window.uetq) {
    const e164Phone = normalizePhoneE164(phone);
    const pid: { em: string; ph?: string } = {
      em: email.trim().toLowerCase(),
    };
    if (e164Phone) pid.ph = e164Phone;
    window.uetq.push("set", { pid });
  }

  if (!window.klaviyo) return;
  const props: Record<string, string> = { email };
  if (phone) props.phone_number = phone;
  if (firstName) props.first_name = firstName;
  if (lastName) props.last_name = lastName;
  window.klaviyo.identify(props);
}

export interface RecentlyViewedListing {
  id: string;
  title: string;
  imageUrl?: string;
  bedrooms?: number;
  bathrooms?: number;
  viewedAt: number;
}

const RECENTLY_VIEWED_KEY = "recently_viewed_listings";
const MAX_RECENTLY_VIEWED = 20;

export function getRecentlyViewed(): RecentlyViewedListing[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToRecentlyViewed(data: {
  id: string;
  title: string;
  imageUrl?: string;
  bedrooms?: number;
  bathrooms?: number;
}) {
  try {
    const existing = getRecentlyViewed().filter((item) => item.id !== data.id);
    const updated = [{ ...data, viewedAt: Date.now() }, ...existing].slice(
      0,
      MAX_RECENTLY_VIEWED
    );
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable
  }
}

export function trackViewedListing(data: {
  id: string;
  title: string;
  /** Internal short name (e.g. "Slopeside Escape 314"). Surfaces in GA4
   *  Ecommerce reports as Item variant — useful for ops since the
   *  marketing title is often long and similar across rooms in a building. */
  nickname?: string | null;
  propertyType?: string;
  city?: string;
  basePrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  imageUrl?: string;
}) {
  saveToRecentlyViewed(data);

  const url = window.location.href;
  const eventId = generateEventId("view");
  const marketingConsent = hasMarketingConsent();
  const analyticsConsent = hasAnalyticsConsent();

  // Platform nightly rate estimates
  const price = data.basePrice ? Math.round(data.basePrice) : undefined;
  const airbnbNightly = price ? Math.round(price * 1.05) : undefined;
  const bookingNightly = price ? Math.round(price * 1.08) : undefined;
  const vrboNightly = price ? Math.round(price * 1.16) : undefined;

  if (marketingConsent && window.klaviyo) {
    window.klaviyo.track("Viewed Listing", {
      Title: data.title,
      ID: data.id,
      "Property Type": data.propertyType || "",
      URL: url,
      ListingCity: data.city || "",
      Price: price,
      ImageURL: data.imageUrl
        ? data.imageUrl.replace(
            /\/t_[a-z_]+\//,
            "/w_1200,h_480,c_fill,g_auto,q_80,f_jpg/"
          )
        : "",
      Bedrooms: data.bedrooms,
      Bathrooms: data.bathrooms,
      AirbnbPrice: airbnbNightly,
      BookingPrice: bookingNightly,
      VrboPrice: vrboNightly,
    });
  }

  if (analyticsConsent && window.gtag) {
    window.gtag("event", "view_item", {
      currency: "USD",
      // Omit value/price entirely when basePrice is missing instead of sending 0 —
      // GA4 includes 0 in AOV calcs and pollutes Conversion Value reporting.
      ...(typeof data.basePrice === "number" &&
        data.basePrice > 0 && { value: data.basePrice }),
      items: [
        {
          item_id: data.id,
          item_name: data.title,
          ...(data.nickname && { item_variant: data.nickname }),
          item_brand: "Book Traverse",
          item_category: data.propertyType || "Vacation Rental",
          ...(typeof data.basePrice === "number" &&
            data.basePrice > 0 && { price: data.basePrice }),
        },
      ],
    });
    qeNoteViewItem();
  }

  // GTM custom event for Microsoft Ads UET (gtag calls are invisible to GTM triggers)
  if (marketingConsent && window.dataLayer) {
    window.dataLayer.push({ event: "view_item" });
  }

  // Direct UET push (bypasses GTM — works regardless of CSP or GTM load timing)
  if (marketingConsent && window.uetq) {
    window.uetq.push("event", "view_item", {});
  }

  if (marketingConsent) {
    // Kick off IP discovery early so it overlaps with waitForPixelAndFbp.
    // The discovered IP is the one graph.facebook.com sees from this browser
    // (api64.ipify.org is dual-stack, so happy eyeballs picks the same family
    // the pixel uses), which the server's IPv4-only x-forwarded-for cannot
    // produce. Required to fix Meta's "client IPs don't match dataset" error.
    const ipPromise = getDiscoveredClientIp();

    // Wait for pixel + _fbp cookie before firing Meta events. On initial page
    // loads, TrackViewedListing's useEffect runs before ConsentManager's, so
    // window.fbq is undefined and _fbp is unset at T+0ms. Without this wait
    // every initial ViewContent goes to Meta with no fbp, and the Listing
    // Viewers Website Custom Audience never populates above the 20-user floor.
    waitForPixelAndFbp().then(() => {
      if (window.fbq) {
        window.fbq(
          "track",
          "ViewContent",
          {
            content_type: "hotel",
            content_ids: [data.id],
            content_name: data.title,
            ...(typeof data.basePrice === "number" &&
              data.basePrice > 0 && { value: data.basePrice }),
            currency: "USD",
            // Hotel/travel vertical params — Meta uses these for catalog
            // matching and hotel-specific bidding. Book Traverse is OR-only,
            // so region and country are constants per fire.
            region: "Oregon",
            country: "US",
            ...(data.city && {
              city: data.city,
              destination: `${data.city}, Oregon, USA`,
            }),
          },
          { eventID: eventId }
        );
      }

      ipPromise.then((clientIp) => {
        fetch("/api/track/viewed-listing", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: data.id,
            listingTitle: data.title,
            propertyType: data.propertyType,
            city: data.city,
            basePrice: data.basePrice,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms,
            url,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }

  trackBehavior("listing_view", {
    listing_id: data.id,
    listing_title: data.title,
    bedrooms: data.bedrooms,
    base_price: data.basePrice,
  });
}

const IC_EVENT_ID_KEY_PREFIX = "_sp_ic_event_id_";

function getOrCreateIcEventId(listingId: string): string {
  if (typeof window === "undefined") return generateEventId("checkout");
  const key = `${IC_EVENT_ID_KEY_PREFIX}${listingId}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = generateEventId("checkout");
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return generateEventId("checkout");
  }
}

export function trackStartedCheckout(data: {
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  imageUrl?: string;
  propertyType?: string;
}) {
  const url = window.location.href;
  const eventId = getOrCreateIcEventId(data.listingId);
  const marketingConsent = hasMarketingConsent();
  const analyticsConsent = hasAnalyticsConsent();

  // Platform price estimates (same multipliers as booking sidebar channel commissions)
  const spPrice = Math.round(data.total);
  const airbnbEst = Math.round(data.total * 1.05);
  const bookingEst = Math.round(data.total * 1.08);
  const vrboEst = Math.round(data.total * 1.16);

  // Format dates for Klaviyo email display (Klaviyo date filter fails on YYYY-MM-DD strings)
  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (marketingConsent && window.klaviyo) {
    window.klaviyo.track("Started Checkout", {
      Title: data.listingTitle,
      ID: data.listingId,
      URL: url,
      ImageURL: data.imageUrl
        ? data.imageUrl.replace(
            /\/t_[a-z_]+\//,
            "/w_1200,h_480,c_fill,g_auto,q_80,f_jpg/"
          )
        : "",
      CheckIn: data.checkIn,
      CheckOut: data.checkOut,
      CheckInDisplay: formatDateDisplay(data.checkIn),
      CheckOutDisplay: formatDateDisplay(data.checkOut),
      "Number of Guests": data.guests,
      $value: spPrice,
      BookTraversePrice: spPrice,
      AirbnbPrice: airbnbEst,
      BookingPrice: bookingEst,
      VrboPrice: vrboEst,
      AirbnbMore: airbnbEst - spPrice,
      BookingMore: bookingEst - spPrice,
      VrboMore: vrboEst - spPrice,
      MaxSavings: vrboEst - spPrice,
    });
  }

  if (analyticsConsent && window.gtag) {
    window.gtag("event", "begin_checkout", {
      currency: "USD",
      value: data.total,
      check_in: data.checkIn,
      check_out: data.checkOut,
      items: [
        {
          item_id: data.listingId,
          item_name: data.listingTitle,
          ...(data.listingNickname && { item_variant: data.listingNickname }),
          item_brand: "Book Traverse",
          item_category: data.propertyType || "Vacation Rental",
          price: data.total,
          quantity: 1,
        },
      ],
    });
  }

  // Google Ads checkout conversion — direct gtag call.
  // eventId is shared with the GTM backup payload for transaction-based dedup.
  // Set user_data from the known-guest store first so enhanced conversions get
  // matched on returning/identified visitors. Anonymous first-fires will emit
  // empty user_data — structural for begin_checkout because the form isn't yet
  // filled. trackInitiateCheckoutEnriched re-fires this conversion with the
  // same transaction_id once email/phone land, and Google dedupes on
  // transaction_id so user_data attaches to the original conversion record.
  const knownGuestAtCheckout = marketingConsent ? getKnownGuest() : {};
  const checkoutEnhancedData = marketingConsent
    ? buildGoogleAdsUserData({
        email: knownGuestAtCheckout.email,
        phone: knownGuestAtCheckout.phone,
        firstName: knownGuestAtCheckout.firstName,
        lastName: knownGuestAtCheckout.lastName,
        postalCode: knownGuestAtCheckout.zip,
        country: knownGuestAtCheckout.country,
      })
    : undefined;

  if (marketingConsent && window.gtag) {
    if (checkoutEnhancedData) {
      window.gtag("set", "user_data", checkoutEnhancedData);
    }
    window.gtag("event", "conversion", {
      send_to: getGoogleAdsCheckoutSendTo(),
      value: data.total,
      currency: "USD",
      transaction_id: eventId,
    });
  }

  // GTM dataLayer push as backup. Include both top-level and ecommerce fields so
  // the container can map transaction_id/value without relying on one schema.
  if (marketingConsent && window.dataLayer) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "checkout_started",
      transaction_id: eventId,
      value: data.total,
      currency: "USD",
      ecommerce: {
        transaction_id: eventId,
        value: data.total,
        currency: "USD",
        items: [
          {
            item_id: data.listingId,
            item_name: data.listingTitle,
            ...(data.listingNickname && { item_variant: data.listingNickname }),
            price: data.total,
            quantity: 1,
          },
        ],
      },
      ...(checkoutEnhancedData && {
        enhanced_conversion_data: {
          ...(checkoutEnhancedData.email && {
            email: checkoutEnhancedData.email,
          }),
          ...(checkoutEnhancedData.phone_number && {
            phone_number: checkoutEnhancedData.phone_number,
          }),
          ...(checkoutEnhancedData.address && {
            first_name: checkoutEnhancedData.address.first_name,
            last_name: checkoutEnhancedData.address.last_name,
            postal_code: checkoutEnhancedData.address.postal_code,
            country: checkoutEnhancedData.address.country,
          }),
        },
      }),
    });
  }

  // Direct UET push (bypasses GTM — works on /book pages where CSP blocks GTM Custom HTML)
  if (marketingConsent && window.uetq) {
    window.uetq.push("event", "begin_checkout", {});
  }

  if (marketingConsent) {
    const ipPromise = getDiscoveredClientIp();

    // Wait for pixel + _fbp before firing Meta events (see trackViewedListing
    // comment above). Also fires the browser fbq InitiateCheckout inside the
    // same wait so it queues correctly instead of being dropped when fbq is
    // undefined at T+0ms.
    waitForPixelAndFbp().then(() => {
      if (window.fbq) {
        window.fbq(
          "track",
          "InitiateCheckout",
          {
            value: data.total,
            currency: "USD",
            content_type: "hotel",
            content_ids: [data.listingId],
            content_name: data.listingTitle,
            checkin_date: data.checkIn,
            checkout_date: data.checkOut,
            num_adults: data.guests,
            region: "Oregon",
            country: "US",
          },
          { eventID: eventId }
        );
      }

      ipPromise.then((clientIp) => {
        fetch("/api/track/checkout-started", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: data.listingId,
            listingTitle: data.listingTitle,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            guests: data.guests,
            total: data.total,
            url,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }

  trackBehavior("checkout_started", {
    listing_id: data.listingId,
    listing_title: data.listingTitle,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    total: data.total,
  });
}

/**
 * Re-fires the Meta InitiateCheckout AND Google Ads "Checkout Started"
 * conversions using the SAME eventId / transaction_id as the initial fire,
 * so each platform merges the two into a single enriched event carrying the
 * user_data the guest has now typed into the checkout form.
 *
 * Meta dedupes by eventID; Google Ads dedupes by transaction_id. The initial
 * page-load fires emit empty user_data (form not filled), and this re-fire
 * attaches email/phone/name to those original conversion records.
 *
 * Called from checkout-form.tsx in two places:
 *   - email-blur (`handleEmailBlur`) — fires with whatever identity is captured
 *     at email-blur time (typically just email)
 *   - all-four-fields-valid (`useEffect`) — fires with full identity once
 *     firstName, lastName, email, and phone are all populated
 *
 * Both call sites have per-component ref guards (`klaviyoIdentifiedRef` /
 * `klaviyoFullIdentifyRef`) so each fires AT MOST ONCE per session+listing.
 * Per-platform dedup (Meta eventID, Google transaction_id) merges the two
 * fires server-side, so progressive enrichment doesn't double-count — and
 * the second fire delivers the richer identity (phone+name+postal) that the
 * first fire was missing.
 */
export function trackInitiateCheckoutEnriched(data: {
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
}) {
  if (!hasMarketingConsent()) return;

  const eventId = getOrCreateIcEventId(data.listingId);
  const ipPromise = getDiscoveredClientIp();

  // Google Ads enriched re-fire — runs synchronously since gtag is loaded at
  // page boot, no waitForPixelAndFbp needed. Skips entirely if known-guest is
  // still empty (no email/phone yet) — nothing to enrich with.
  const knownGuest = getKnownGuest();
  const googleEnhancedData = buildGoogleAdsUserData({
    email: knownGuest.email,
    phone: knownGuest.phone,
    firstName: knownGuest.firstName,
    lastName: knownGuest.lastName,
    postalCode: knownGuest.zip,
    country: knownGuest.country,
  });
  if (googleEnhancedData && window.gtag) {
    window.gtag("set", "user_data", googleEnhancedData);
    window.gtag("event", "conversion", {
      send_to: getGoogleAdsCheckoutSendTo(),
      value: data.total,
      currency: "USD",
      transaction_id: eventId,
    });
  }
  if (googleEnhancedData && window.dataLayer) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "checkout_started",
      transaction_id: eventId,
      value: data.total,
      currency: "USD",
      ecommerce: {
        transaction_id: eventId,
        value: data.total,
        currency: "USD",
        items: [
          {
            item_id: data.listingId,
            item_name: data.listingTitle,
            ...(data.listingNickname && { item_variant: data.listingNickname }),
            price: data.total,
            quantity: 1,
          },
        ],
      },
      enhanced_conversion_data: {
        ...(googleEnhancedData.email && { email: googleEnhancedData.email }),
        ...(googleEnhancedData.phone_number && {
          phone_number: googleEnhancedData.phone_number,
        }),
        ...(googleEnhancedData.address && {
          first_name: googleEnhancedData.address.first_name,
          last_name: googleEnhancedData.address.last_name,
          postal_code: googleEnhancedData.address.postal_code,
          country: googleEnhancedData.address.country,
        }),
      },
    });
  }

  waitForPixelAndFbp().then(() => {
    if (window.fbq) {
      window.fbq(
        "track",
        "InitiateCheckout",
        {
          value: data.total,
          currency: "USD",
          content_type: "hotel",
          content_ids: [data.listingId],
          content_name: data.listingTitle,
          checkin_date: data.checkIn,
          checkout_date: data.checkOut,
          num_adults: data.guests,
          region: "Oregon",
          country: "US",
        },
        { eventID: eventId }
      );
    }

    ipPromise.then((clientIp) => {
      fetch("/api/track/checkout-started", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: data.listingId,
          listingTitle: data.listingTitle,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          guests: data.guests,
          total: data.total,
          url: window.location.href,
          eventId,
          guest: knownGuest,
          ...getMetaCookies(),
          clientIp,
        }),
      }).catch(() => {});
    });
  });
}

/**
 * Clears all IC-related client state. Called from revokeMetaPixel() so
 * that an opt-out → opt-in cycle (or identity change) generates fresh
 * eventIds. Wipes sessionStorage keys related to checkout event tracking.
 */
export function resetCheckoutTrackingState() {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith(IC_EVENT_ID_KEY_PREFIX) ||
        key.startsWith("_sp_checkout_tracked_")
      ) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function trackCheckoutError(data: {
  listingId?: string;
  listingTitle?: string;
  total?: number;
  step: string; // "quote_load" | "payment_init" | "payment_submit" | "form_validation" | "3ds_callback" | "unknown"
  errorMessage: string;
  errorCode?: string;
}) {
  trackBehavior("checkout_error", {
    listing_id: data.listingId || null,
    listing_title: data.listingTitle || null,
    total: data.total || null,
    step: data.step,
    error_message: data.errorMessage.slice(0, 500),
    error_code: data.errorCode || null,
  });
}

export function trackBookingCompleted(data: {
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  reservationId: string;
  /** Human-readable Guesty confirmation code (e.g. "GY-rNZRDKkN").
   *  Used as transaction_id when available so GA4 / Google Ads reports show
   *  the friendly code instead of the long hex `_id`. Falls back to
   *  reservationId. Added 2026-05-17. */
  confirmationCode?: string | null;
  guestEmail?: string;
  guestPhone?: string;
  guestFirstName?: string;
  guestLastName?: string;
  // Billing zip + country from Stripe billing_details. Required for Google EC
  // to attach name as a match key — spec rejects address.{first_name,
  // last_name} unless postal_code + country are also present.
  guestPostalCode?: string;
  guestCountry?: string;
  eventId?: string;
  propertyType?: string;
  ctaVariant?: string;
}) {
  const url = window.location.href;
  const eventId = data.eventId || generateEventId("purchase");
  // Prefer the human-readable confirmation code (e.g. "GY-rNZRDKkN") as the
  // transaction_id sent to GA4 / Google Ads. Falls back to the Guesty Mongo
  // _id when the confirmation code isn't available (in-flight checkouts).
  const transactionId = data.confirmationCode || data.reservationId;
  const marketingConsent = hasMarketingConsent();
  const enhancedConversionData = buildGoogleAdsUserData({
    email: data.guestEmail,
    phone: data.guestPhone,
    firstName: data.guestFirstName,
    lastName: data.guestLastName,
    postalCode: data.guestPostalCode,
    country: data.guestCountry,
  });

  if (marketingConsent && window.klaviyo) {
    window.klaviyo.track("Booked Reservation", {
      Title: data.listingTitle,
      ID: data.listingId,
      URL: url,
      CheckIn: data.checkIn,
      CheckOut: data.checkOut,
      "Number of Guests": data.guests,
      $value: data.total,
      "Confirmation Code": data.reservationId,
      "Guest Email": data.guestEmail || "",
      unique_id: data.reservationId,
      "CTA Variant": data.ctaVariant || "unknown",
    });
  }

  if (marketingConsent && window.fbq) {
    window.fbq(
      "track",
      "Purchase",
      {
        value: data.total,
        currency: "USD",
        content_type: "hotel",
        content_ids: [data.listingId],
        content_name: data.listingTitle,
        order_id: data.reservationId,
        checkin_date: data.checkIn,
        checkout_date: data.checkOut,
        num_adults: data.guests,
        // Hotel/travel vertical params — improves catalog matching and
        // travel-vertical EMQ. SP is Oregon-only.
        region: "Oregon",
        country: "US",
      },
      { eventID: eventId }
    );
  }

  // GA4 purchase is handled server-side only (Measurement Protocol) — no gtag call here
  // to avoid double-counting. GA4 doesn't deduplicate between gtag and MP.

  // Google Ads conversion — direct gtag call (reliable, no GTM dependency).
  // Always fires client-side; server-side upload also fires when GCLID is present.
  // Google Ads deduplicates on transaction_id/orderId so both can safely coexist.
  if (marketingConsent && window.gtag) {
    if (enhancedConversionData) {
      window.gtag("set", "user_data", enhancedConversionData);
    }

    // Direct Google Ads conversion event — beacon transport ensures delivery
    // survives the router.push() navigation that follows immediately after.
    window.gtag("event", "conversion", {
      send_to: getGoogleAdsPurchaseSendTo(),
      value: data.total,
      currency: "USD",
      transaction_id: transactionId,
      transport_type: "beacon",
    });
  }

  // GTM dataLayer push as backup (also always fires — same dedup via transaction_id).
  if (marketingConsent && window.dataLayer) {
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "booking_completed",
      transaction_id: transactionId,
      value: data.total,
      currency: "USD",
      ecommerce: {
        transaction_id: transactionId,
        value: data.total,
        currency: "USD",
        items: [
          {
            item_id: data.listingId,
            item_name: data.listingTitle,
            ...(data.listingNickname && { item_variant: data.listingNickname }),
            price: data.total,
            quantity: 1,
          },
        ],
      },
      ...(enhancedConversionData && {
        enhanced_conversion_data: {
          ...(enhancedConversionData.email && {
            email: enhancedConversionData.email,
          }),
          ...(enhancedConversionData.phone_number && {
            phone_number: enhancedConversionData.phone_number,
          }),
          ...(enhancedConversionData.address && {
            first_name: enhancedConversionData.address.first_name,
            last_name: enhancedConversionData.address.last_name,
            postal_code: enhancedConversionData.address.postal_code,
            country: enhancedConversionData.address.country,
          }),
        },
      }),
    });
  }

  // Direct UET push (bypasses GTM — works on /book pages where CSP blocks GTM Custom HTML)
  if (marketingConsent && window.uetq) {
    window.uetq.push("event", "purchase", {
      revenue_value: data.total,
      currency: "USD",
    });
  }

  trackBehavior("booking_completed", {
    listing_id: data.listingId,
    listing_title: data.listingTitle,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    total: data.total,
    reservation_id: data.reservationId,
  });
}

export function trackSearch(data: {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  city?: string;
  resultCount: number;
  resultIds: string[];
  filters?: {
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
    minPrice?: number;
    maxPrice?: number;
    pets?: boolean;
    propertyType?: string;
    amenities?: string;
    filterTag?: string;
  };
}) {
  const eventId = generateEventId("search");
  const marketingConsent = hasMarketingConsent();

  if (hasAnalyticsConsent() && window.gtag) {
    window.gtag("event", "search", {
      search_term: [
        data.city,
        data.checkIn,
        data.checkOut,
        data.guests ? `${data.guests} guests` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      check_in: data.checkIn || undefined,
      check_out: data.checkOut || undefined,
      guests: data.guests || undefined,
      result_count: data.resultCount,
      bedrooms: data.filters?.bedrooms || undefined,
      beds: data.filters?.beds || undefined,
      bathrooms: data.filters?.bathrooms || undefined,
      min_price: data.filters?.minPrice || undefined,
      max_price: data.filters?.maxPrice || undefined,
      pets: data.filters?.pets || undefined,
      property_type: data.filters?.propertyType || undefined,
      amenities: data.filters?.amenities || undefined,
      filter_tag: data.filters?.filterTag || undefined,
      location_tag: data.city || undefined,
    });
    qeNoteSearch();
  }

  if (marketingConsent) {
    const ipPromise = getDiscoveredClientIp();

    // Default dates per Meta best practice: +14/+21 days when user hasn't selected
    const now = new Date();
    const defaultCheckIn = new Date(now.getTime() + 14 * 86400000)
      .toISOString()
      .split("T")[0];
    const defaultCheckOut = new Date(now.getTime() + 21 * 86400000)
      .toISOString()
      .split("T")[0];

    // Wait for pixel + _fbp before firing Meta events (see trackViewedListing
    // comment above).
    waitForPixelAndFbp().then(() => {
      if (window.fbq) {
        window.fbq(
          "track",
          "Search",
          {
            content_type: "hotel",
            content_ids: data.resultIds.slice(0, 20),
            checkin_date: data.checkIn || defaultCheckIn,
            checkout_date: data.checkOut || defaultCheckOut,
            destination: data.city
              ? `${data.city}, Oregon, USA`
              : "Portland, Oregon, USA",
            city: data.city || "Portland",
            region: "Oregon",
            country: "US",
            num_adults: data.guests || 2,
            currency: "USD",
          },
          { eventID: eventId }
        );
      }

      ipPromise.then((clientIp) => {
        fetch("/api/track/search", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            guests: data.guests,
            city: data.city,
            resultCount: data.resultCount,
            resultIds: data.resultIds,
            url: window.location.href,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }

  trackBehavior("search", {
    check_in: data.checkIn || null,
    check_out: data.checkOut || null,
    guests: data.guests || null,
    result_count: data.resultCount,
    filters: data.filters || null,
  });
}

export function trackSelectListing(data: {
  id: string;
  title: string;
  position?: number;
  price?: number;
  propertyType?: string;
}) {
  if (hasAnalyticsConsent() && window.gtag) {
    window.gtag("event", "select_item", {
      item_list_id: "properties",
      item_list_name: "Property Listings",
      items: [
        {
          item_id: data.id,
          item_name: data.title,
          item_brand: "Book Traverse",
          item_category: data.propertyType || "Vacation Rental",
          price: data.price || 0,
          index: data.position,
        },
      ],
    });
  }

  trackBehavior("listing_click", {
    listing_id: data.id,
    listing_title: data.title,
    position: data.position,
    price: data.price,
  });
}

export function trackViewedListingList(
  listings: Array<{
    id: string;
    title: string;
    /** Internal short name — populates GA4 Item variant column. */
    nickname?: string | null;
    price?: number;
    propertyType?: string;
    position: number;
  }>
) {
  if (!hasAnalyticsConsent() || !window.gtag || listings.length === 0) return;

  window.gtag("event", "view_item_list", {
    item_list_id: "properties",
    item_list_name: "Property Listings",
    items: listings.map((l) => ({
      item_id: l.id,
      item_name: l.title,
      ...(l.nickname && { item_variant: l.nickname }),
      item_brand: "Book Traverse",
      item_category: l.propertyType || "Vacation Rental",
      price: l.price || 0,
      index: l.position,
    })),
  });
}

export function trackAddToWishlist(
  listingId: string,
  data?: { listingTitle?: string; price?: number }
) {
  const eventId = generateEventId("wish");
  const marketingConsent = hasMarketingConsent();

  if (marketingConsent && window.fbq) {
    window.fbq(
      "track",
      "AddToWishlist",
      {
        content_type: "hotel",
        content_ids: [listingId],
        currency: "USD",
        ...(data?.listingTitle && { content_name: data.listingTitle }),
        ...(typeof data?.price === "number" &&
          data.price > 0 && {
            value: data.price,
          }),
      },
      { eventID: eventId }
    );
  }

  // Meta CAPI mirror — same eventId so Meta dedupes the two fires. Adds
  // ad-blocker resilience and lets the server attach IP/UA/external_id that
  // the browser pixel can't reach.
  if (marketingConsent) {
    const ipPromise = getDiscoveredClientIp();
    waitForPixelAndFbp().then(() => {
      ipPromise.then((clientIp) => {
        fetch("/api/track/add-to-wishlist", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            listingTitle: data?.listingTitle,
            price: data?.price,
            url: window.location.href,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }

  if (hasAnalyticsConsent() && window.gtag) {
    window.gtag("event", "add_to_wishlist", {
      currency: "USD",
      ...(typeof data?.price === "number" &&
        data.price > 0 && {
          value: data.price,
        }),
      items: [
        {
          item_id: listingId,
          item_brand: "Book Traverse",
          ...(data?.listingTitle && { item_name: data.listingTitle }),
          ...(typeof data?.price === "number" &&
            data.price > 0 && {
              price: data.price,
              quantity: 1,
            }),
        },
      ],
    });
    qeNoteWishlist();
  }
}

/** Per-line item shape for the cart funnel events. */
export interface CartFunnelLineItem {
  listingId: string;
  listingTitle: string;
  /** Best-known per-line total at the moment of the event. */
  hostPayout?: number;
}

/**
 * Cart funnel event helper — fires `begin_checkout` / `add_shipping_info` /
 * `add_payment_info` (and the matching Meta + Klaviyo events) with
 * multi-line item arrays. Single-flow checkout continues to use the
 * per-listing trackStartedCheckout / trackAddShippingInfo / trackAddPaymentInfo
 * helpers. This one's cart-shape-aware and aggregates value across lines.
 */
export function trackCartCheckoutStage(
  stage: "begin_checkout" | "add_shipping_info" | "add_payment_info",
  data: {
    cartId?: string | null;
    paymentIntentId?: string | null;
    lines: CartFunnelLineItem[];
    total: number;
    currency?: string;
  }
) {
  const marketingConsent = hasMarketingConsent();
  const analyticsConsent = hasAnalyticsConsent();
  const currency = data.currency || "USD";

  // GA4 — preserves item array, lets you build a multi-item funnel report.
  if (analyticsConsent && window.gtag) {
    window.gtag("event", stage, {
      currency,
      value: data.total,
      ...(data.cartId && { cart_id: data.cartId }),
      ...(data.paymentIntentId && { transaction_id: data.paymentIntentId }),
      items: data.lines.map((l) => ({
        item_id: l.listingId,
        item_name: l.listingTitle,
        item_brand: "Book Traverse",
        item_category: "Vacation Rental",
        ...(typeof l.hostPayout === "number" && { price: l.hostPayout }),
        quantity: 1,
      })),
    });
  }

  // Meta browser pixel — InitiateCheckout / AddPaymentInfo (no native event
  // for shipping; we map add_shipping_info to a custom InitiateCheckout
  // re-fire to keep the funnel intact).
  if (marketingConsent && window.fbq) {
    const metaEventName =
      stage === "add_payment_info" ? "AddPaymentInfo" : "InitiateCheckout";
    window.fbq("track", metaEventName, {
      content_type: "hotel",
      content_ids: data.lines.map((l) => l.listingId),
      contents: data.lines.map((l) => ({
        id: l.listingId,
        quantity: 1,
        ...(typeof l.hostPayout === "number" && { item_price: l.hostPayout }),
      })),
      num_items: data.lines.length,
      value: data.total,
      currency,
    });
  }

  // Klaviyo — single "Started Cart Checkout" event with line summary
  // (used by abandoned-cart flows). The shipping + payment stages don't
  // need their own Klaviyo events; cart-flow attribution happens at
  // checkout-started (this event) and at "Booked Reservation" (server).
  if (
    marketingConsent &&
    window.klaviyo &&
    stage === "begin_checkout"
  ) {
    window.klaviyo.track("Started Cart Checkout", {
      "Cart ID": data.cartId || "",
      "Line Count": data.lines.length,
      $value: data.total,
      Lines: data.lines.map((l) => ({
        Title: l.listingTitle,
        ID: l.listingId,
        ...(typeof l.hostPayout === "number" && { Total: l.hostPayout }),
      })),
    });
  }
}

/**
 * Multi-listing cart "Add to Cart" event. Mirrors the wishlist pattern:
 * Meta browser fbq + Meta CAPI (deduped via shared eventId) + GA4
 * `add_to_cart` + Klaviyo "Added to Cart" (Klaviyo flow trigger). Called
 * from AddToCartButton when the user adds a listing to the group-booking
 * cart.
 */
export function trackAddToCart(data: {
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets?: number;
  /** Per-night snapshot price; the cart value is computed from this × nights.
   * Total at checkout is fetched live via /api/quotes/batch — this is the best
   * client-side estimate at the moment of add. */
  nightlyPrice?: number | null;
  imageUrl?: string | null;
  city?: string | null;
}) {
  const eventId = generateEventId("atc");
  const marketingConsent = hasMarketingConsent();
  const analyticsConsent = hasAnalyticsConsent();

  const nights = (() => {
    if (!data.checkIn || !data.checkOut) return 0;
    const a = new Date(`${data.checkIn}T12:00:00Z`).getTime();
    const b = new Date(`${data.checkOut}T12:00:00Z`).getTime();
    return Math.max(0, Math.round((b - a) / 86_400_000));
  })();
  const estimatedTotal =
    typeof data.nightlyPrice === "number" && nights > 0
      ? data.nightlyPrice * nights
      : 0;

  if (marketingConsent && window.fbq) {
    window.fbq(
      "track",
      "AddToCart",
      {
        content_type: "hotel",
        content_ids: [data.listingId],
        content_name: data.listingTitle,
        currency: "USD",
        ...(estimatedTotal > 0 && { value: estimatedTotal }),
        checkin_date: data.checkIn,
        checkout_date: data.checkOut,
        num_adults: data.guests,
      },
      { eventID: eventId }
    );
  }

  // Meta CAPI mirror — same eventId so Meta dedupes the two fires.
  if (marketingConsent) {
    const ipPromise = getDiscoveredClientIp();
    waitForPixelAndFbp().then(() => {
      ipPromise.then((clientIp) => {
        fetch("/api/track/add-to-cart", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: data.listingId,
            listingTitle: data.listingTitle,
            total: estimatedTotal,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            guests: data.guests,
            url: window.location.href,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }

  if (analyticsConsent && window.gtag) {
    window.gtag("event", "add_to_cart", {
      currency: "USD",
      ...(estimatedTotal > 0 && { value: estimatedTotal }),
      items: [
        {
          item_id: data.listingId,
          item_name: data.listingTitle,
          ...(data.listingNickname && { item_variant: data.listingNickname }),
          item_brand: "Book Traverse",
          item_category: "Vacation Rental",
          ...(data.city && { item_category2: data.city }),
          ...(typeof data.nightlyPrice === "number" && {
            price: data.nightlyPrice,
          }),
          quantity: 1,
        },
      ],
      check_in: data.checkIn,
      check_out: data.checkOut,
      num_nights: nights,
    });
  }

  // Klaviyo "Added to Cart" — drives cart abandonment flows. Fires for any
  // marketing-consented visitor; if they later supply email at checkout,
  // Klaviyo backfills the profile and can target via the abandoned cart
  // segment.
  if (marketingConsent && window.klaviyo) {
    window.klaviyo.track("Added to Cart", {
      Title: data.listingTitle,
      ID: data.listingId,
      URL: window.location.href,
      ImageURL: data.imageUrl || "",
      CheckIn: data.checkIn,
      CheckOut: data.checkOut,
      "Number of Guests": data.guests,
      Pets: data.pets || 0,
      Nights: nights,
      ...(estimatedTotal > 0 && { $value: estimatedTotal }),
      ...(typeof data.nightlyPrice === "number" && {
        NightlyPrice: data.nightlyPrice,
      }),
    });
  }
}

export function trackAddPaymentInfo(data: {
  listingId: string;
  listingTitle: string;
  total: number;
  propertyType?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}) {
  const analyticsConsent = hasAnalyticsConsent();
  const marketingConsent = hasMarketingConsent();
  // Both Meta browser pixel and CAPI share this eventID so dedup works once
  // we add /api/track/add-payment-info — until then it's just a Meta-side
  // event identifier.
  const eventId = generateEventId("apinfo");

  if (analyticsConsent && window.gtag) {
    window.gtag("event", "add_payment_info", {
      currency: "USD",
      value: data.total,
      payment_type: "card",
      items: [
        {
          item_id: data.listingId,
          item_name: data.listingTitle,
          item_brand: "Book Traverse",
          item_category: data.propertyType || "Vacation Rental",
          price: data.total,
          quantity: 1,
        },
      ],
    });
  }

  if (marketingConsent) {
    const ipPromise = getDiscoveredClientIp();
    waitForPixelAndFbp().then(() => {
      if (window.fbq) {
        window.fbq(
          "track",
          "AddPaymentInfo",
          {
            value: data.total,
            currency: "USD",
            content_type: "hotel",
            content_ids: [data.listingId],
            content_name: data.listingTitle,
            ...(data.checkIn && { checkin_date: data.checkIn }),
            ...(data.checkOut && { checkout_date: data.checkOut }),
            ...(typeof data.guests === "number" && { num_adults: data.guests }),
          },
          { eventID: eventId }
        );
      }

      ipPromise.then((clientIp) => {
        fetch("/api/track/add-payment-info", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: data.listingId,
            listingTitle: data.listingTitle,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            guests: data.guests,
            total: data.total,
            url: window.location.href,
            eventId,
            guest: getKnownGuest(),
            ...getMetaCookies(),
            clientIp,
          }),
        }).catch(() => {});
      });
    });
  }
}

export function trackCheckAvailability(data: {
  listingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}) {
  // GTM custom event for Microsoft Ads UET (gtag calls are invisible to GTM triggers)
  if (hasMarketingConsent() && window.dataLayer) {
    window.dataLayer.push({ event: "check_availability" });
  }

  // Direct UET push (bypasses GTM — works regardless of CSP or GTM load timing)
  if (hasMarketingConsent() && window.uetq) {
    window.uetq.push("event", "check_availability", {});
  }

  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "check_availability", {
    listing_id: data.listingId,
    listing_title: data.listingTitle,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
  });
}

export function trackClickBookNow(data: {
  listingId: string;
  listingTitle: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  value?: number;
}) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "click_book_now", {
    listing_id: data.listingId,
    listing_title: data.listingTitle,
    check_in: data.checkIn,
    check_out: data.checkOut,
    guests: data.guests,
    value: data.value,
    currency: data.value ? "USD" : undefined,
  });
}

/**
 * Renamed 2026-04-25 from `trackAddGuestInfo` (custom event) to align with the
 * GA4 canonical recommended ecommerce event `add_shipping_info`. Renaming
 * populates the standard Checkout Funnel report (`begin_checkout` →
 * `add_shipping_info` → `add_payment_info` → `purchase`) instead of leaving
 * an orphan custom event in the events list. Historical `add_guest_info`
 * reporting is preserved by default in GA4's 14-month retention.
 */
export function trackAddShippingInfo(data: {
  listingId: string;
  listingTitle: string;
  guests: number;
  total: number;
}) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "add_shipping_info", {
    currency: "USD",
    value: data.total,
    items: [
      {
        item_id: data.listingId,
        item_name: data.listingTitle,
        item_brand: "Book Traverse",
        price: data.total,
        quantity: 1,
      },
    ],
    // Retain SP-specific dimensions for legacy explorations.
    listing_id: data.listingId,
    listing_title: data.listingTitle,
    guests: data.guests,
  });
}

export function trackContactSubmit(subject?: string) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "contact_submit", {
    subject: subject || "contact_form",
  });
}

export function trackPhoneClick(label?: string) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "phone_click", {
    label: label || "primary_phone",
  });
}

export function trackEmailClick(label?: string) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "email_click", {
    label: label || "primary_email",
  });
}

export function trackChatOpened(context?: {
  page_type?: string;
  listing_id?: string;
  trigger?: string;
}) {
  if (!hasAnalyticsConsent() || !window.gtag) return;

  window.gtag("event", "chat_opened", {
    page_type: context?.page_type || undefined,
    listing_id: context?.listing_id || undefined,
    trigger: context?.trigger || undefined,
  });
}
