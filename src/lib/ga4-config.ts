// Single source of truth for the GA4 property used by gtag (layout.tsx) and the
// Measurement Protocol (server-tracking.ts). The GA4 session cookie is named
// `_ga_<measurement id without "G-">`, so the server MUST derive the cookie name
// from the same ID the browser uses. A hardcoded `_ga_PPWFFFPC42` (old property)
// meant the server never found the session cookie for the live property
// (G-8NK72KVMJJ), so every server-side purchase landed with no session_id and
// GA4 reported its source as "(not set)".
export const GA4_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-PPWFFFPC42"
).trim();

export const GA_SESSION_COOKIE = `_ga_${GA4_MEASUREMENT_ID.replace(/^G-/, "")}`;

/** `_ga` cookie "GA1.1.123456789.1700000000" → client_id "123456789.1700000000". */
export function parseGaClientId(gaCookie?: string | null): string | undefined {
  if (!gaCookie) return undefined;
  return gaCookie.split(".").slice(-2).join(".") || undefined;
}
