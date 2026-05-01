export const CONSENT_COOKIE_NAME = "_sp_consent";
export const LEGACY_CCPA_COOKIE = "_sp_ccpa_optout";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

export const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  marketing: false,
};

export const IMPLIED_US_CONSENT: ConsentState = {
  analytics: true,
  marketing: true,
};

function getLegacyConsent(
  legacyOptOutValue?: string | null
): ConsentState | null {
  if (legacyOptOutValue === "1") {
    return { analytics: true, marketing: false };
  }

  return null;
}

function normalizeBoolean(value: string | undefined): boolean {
  return (
    value === "1" || value === "true" || value === "yes" || value === "granted"
  );
}

export function serializeConsent(consent: ConsentState): string {
  return `a=${consent.analytics ? 1 : 0}&m=${consent.marketing ? 1 : 0}`;
}

export function parseConsentCookieValue(
  value?: string | null
): ConsentState | null {
  if (!value) return null;

  const params = new URLSearchParams(value);
  if (params.has("a") || params.has("m")) {
    return {
      analytics: normalizeBoolean(params.get("a") || undefined),
      marketing: normalizeBoolean(params.get("m") || undefined),
    };
  }

  try {
    const parsed = JSON.parse(
      decodeURIComponent(value)
    ) as Partial<ConsentState>;
    if (
      typeof parsed.analytics === "boolean" ||
      typeof parsed.marketing === "boolean"
    ) {
      return {
        analytics: parsed.analytics === true,
        marketing: parsed.marketing === true,
      };
    }
  } catch {
    // ignore malformed legacy payloads
  }

  return null;
}

export function getClientConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;

  const cookies = Object.fromEntries(
    document.cookie
      .split("; ")
      .filter(Boolean)
      .map((entry) => {
        const idx = entry.indexOf("=");
        return idx === -1
          ? [entry, ""]
          : [entry.slice(0, idx), entry.slice(idx + 1)];
      })
  );

  const consent = parseConsentCookieValue(cookies[CONSENT_COOKIE_NAME]);
  if (consent) return consent;

  const legacyConsent = getLegacyConsent(cookies[LEGACY_CCPA_COOKIE]);
  if (legacyConsent) return legacyConsent;

  return null;
}

export function getEffectiveServerConsent(args?: {
  consentCookieValue?: string | null;
  legacyOptOutValue?: string | null;
  fallback?: ConsentState | null;
}): ConsentState {
  // NOTE: Sec-GPC (Global Privacy Control) is intentionally NOT honored.
  // SP is below the revenue/consumer thresholds for CCPA/CPA/CTDPA/TDPSA/OCPA
  // mandatory compliance, and GPC adoption suppresses ~2-5% of traffic at
  // essentially zero legal upside. Explicit user opt-outs via `_sp_consent`
  // or the legacy `_sp_ccpa_optout` cookie ARE still respected — those are
  // direct choices made on SP, not browser-level preference signals.
  const stored =
    parseConsentCookieValue(args?.consentCookieValue) ||
    getLegacyConsent(args?.legacyOptOutValue);
  const base = stored || args?.fallback || IMPLIED_US_CONSENT;

  return {
    analytics: base.analytics,
    marketing: base.marketing,
  };
}

export function getEffectiveClientConsent(): ConsentState {
  return getEffectiveServerConsent({
    fallback: getClientConsent(),
  });
}

export function setClientConsent(consent: ConsentState) {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE_NAME}=${serializeConsent(consent)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  if (!consent.marketing) {
    document.cookie = `${LEGACY_CCPA_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } else {
    document.cookie = `${LEGACY_CCPA_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getEffectiveClientConsent().analytics === true;
}

export function hasMarketingConsent(): boolean {
  return getEffectiveClientConsent().marketing === true;
}

export function applyConsentMode(consent: ConsentState) {
  if (typeof window === "undefined" || typeof window.gtag !== "function")
    return;

  window.gtag("consent", "update", {
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    analytics_storage: consent.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    personalization_storage: consent.marketing ? "granted" : "denied",
    security_storage: "granted",
  });
}
