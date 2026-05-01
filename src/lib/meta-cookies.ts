// Server-side Meta identifier minting. Recovers _fbp/_fbc for users whose
// ad blockers prevent fbevents.js from ever running. Without this, blocked
// users have no browser ID in CAPI events and EMQ collapses below 6, which
// kills audience match rates for retargeting and lookalikes.
//
// fbevents.js (when it does load) checks document.cookie before minting its
// own _fbp, so a server-set value is preserved — no double-write collision.
//
// Format spec:
// https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/fbp-and-fbc

export const META_COOKIE_NAMES = {
  fbp: "_fbp",
  fbc: "_fbc",
} as const;

// Meta's documented retention for _fbp/_fbc is 90 days.
export const META_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * Mint a Meta browser ID cookie value: `fb.1.<creation_ts_ms>.<random>`
 *
 * Uniqueness is what matters for the random component — Meta treats it as
 * an opaque visitor anchor. Uses Web Crypto getRandomValues so this works in
 * both the Edge runtime (middleware) and Node runtime (route handlers).
 */
export function mintFbp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return `fb.1.${Date.now()}.${buf[0]}`;
}

/**
 * Format a Meta click ID cookie value from a raw fbclid URL parameter:
 * `fb.1.<click_ts_ms>.<fbclid>`
 *
 * The timestamp must be the click time (when the user landed via the ad),
 * NOT the conversion time. Meta uses this for click-attribution windows.
 * Always pass the current time when capturing fbclid in middleware on the
 * landing request — that IS the click time.
 */
export function formatFbc(fbclid: string, clickTimeMs: number): string {
  return `fb.1.${clickTimeMs}.${fbclid}`;
}

/**
 * Extract the click timestamp (epoch ms) from an `_fbc` cookie value.
 * Returns undefined if the cookie is malformed.
 */
export function parseFbcTimestamp(fbc: string): number | undefined {
  const match = /^fb\.1\.(\d+)\./.exec(fbc);
  if (!match) return undefined;
  const ts = Number(match[1]);
  return Number.isFinite(ts) ? ts : undefined;
}
