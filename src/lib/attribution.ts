/**
 * Client-side attribution data for email capture events.
 * Reads the _sp_attribution cookie (set by middleware on ad clicks / UTM visits)
 * and enriches with page context + device info.
 */

export interface EmailCaptureAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing_page: string;
  page_type: string;
  form_type: string;
  offer_type: string;
  listing_id?: string;
  device_type: string;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getPageType(pathname: string): string {
  if (pathname === "/") return "homepage";
  if (/^\/properties\/[^/]+/.test(pathname)) return "listing";
  if (pathname === "/properties") return "search";
  if (/^\/guide\/[^/]+/.test(pathname)) return "guide_article";
  if (pathname === "/guide") return "guide_index";
  if (pathname.startsWith("/portland-")) return "advertorial";
  if (pathname.startsWith("/book/confirmation")) return "confirmation";
  if (pathname.startsWith("/book/")) return "checkout";
  if (pathname === "/contact") return "contact";
  return "other";
}

function getDeviceType(): string {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop";
}

/**
 * Build attribution data for an email capture event.
 * Call from client components before POSTing to email capture endpoints.
 */
export function getEmailCaptureAttribution(
  formType: string,
  offerType: string,
  listingId?: string
): EmailCaptureAttribution {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";

  let cookie: Record<string, string> = {};
  const raw = getCookie("_sp_attribution");
  if (raw) {
    try {
      cookie = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }

  return {
    utm_source: cookie.utm_source || undefined,
    utm_medium: cookie.utm_medium || undefined,
    utm_campaign: cookie.utm_campaign || undefined,
    landing_page: pathname,
    page_type: getPageType(pathname),
    form_type: formType,
    offer_type: offerType,
    listing_id: listingId || undefined,
    device_type: getDeviceType(),
  };
}

/**
 * Attribution for an OWNER lead (the /property-management inquiry form).
 *
 * Owner acquisition is the highest-value thing the site produces, and it was
 * the one funnel capturing nothing: the form POSTs to the CRM's /api/leads
 * with a hardcoded `source: "booktraverse.com"` and no UTMs, referrer, or
 * landing page. So when a lead arrives, "how did they find us" is
 * unanswerable — that string looks like attribution but is a constant.
 *
 * Two things this deliberately does beyond getEmailCaptureAttribution():
 *
 *  1. **First touch as well as last touch.** Owners research for weeks before
 *     enquiring. The visit that converts is rarely the visit that found us.
 *  2. **`document.referrer`.** Middleware only writes `_sp_attribution` when a
 *     UTM/click param is present, so an ORGANIC search visitor — the most
 *     likely way an owner finds a property manager — leaves no cookie at all.
 *     The referrer is the only signal available in that case.
 */
export interface LeadAttribution {
  /** Last-touch campaign params, if the visit carried any. */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  /** First-touch equivalents — the visit that originally found us. */
  firstTouchSource?: string;
  firstTouchMedium?: string;
  firstTouchCampaign?: string;
  firstTouchLandingPage?: string;
  firstTouchAt?: string;
  /** Landing page of the attributed visit (cookie), if any. */
  landingPage?: string;
  /** Where the form was actually submitted from. */
  submittedFrom?: string;
  /** External referrer — the fallback signal when no UTMs exist. */
  referrer?: string;
  deviceType?: string;
}

function parseAttributionCookie(name: string): Record<string, string> {
  const raw = getCookie(name);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getLeadAttribution(): LeadAttribution {
  const last = parseAttributionCookie("_sp_attribution");
  const first = parseAttributionCookie("_sp_first_touch");

  // Same-origin referrers say nothing about acquisition — the interesting
  // case is arriving from Google, a directory, or another site.
  let referrer: string | undefined;
  if (typeof document !== "undefined" && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.hostname !== window.location.hostname) referrer = document.referrer;
    } catch {
      /* malformed referrer — ignore */
    }
  }

  const attribution: LeadAttribution = {
    utmSource: last.utm_source || undefined,
    utmMedium: last.utm_medium || undefined,
    utmCampaign: last.utm_campaign || undefined,
    utmContent: last.utm_content || undefined,
    utmTerm: last.utm_term || undefined,
    gclid: last.gclid || undefined,
    firstTouchSource: first.utm_source || undefined,
    firstTouchMedium: first.utm_medium || undefined,
    firstTouchCampaign: first.utm_campaign || undefined,
    firstTouchLandingPage: first.landingPage || undefined,
    firstTouchAt: first.capturedAt || undefined,
    landingPage: last.landingPage || first.landingPage || undefined,
    submittedFrom:
      typeof window !== "undefined" ? window.location.pathname : undefined,
    referrer,
    deviceType: getDeviceType(),
  };

  // Drop empty keys so the CRM payload stays readable in logs and Slack.
  return Object.fromEntries(
    Object.entries(attribution).filter(([, v]) => v !== undefined && v !== "")
  ) as LeadAttribution;
}
