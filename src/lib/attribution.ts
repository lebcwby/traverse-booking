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
