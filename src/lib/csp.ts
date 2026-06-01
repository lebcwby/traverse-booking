// src/lib/csp.ts
//
// SINGLE SOURCE OF TRUTH for the Content Security Policy.
//
// Imported by:
//   1. middleware.ts → builds the stricter nonce-based policy applied to
//      "sensitive" paths (login, contact, book, account, password reset).
//   2. next.config.ts → builds the baseline policy applied to everything
//      else via the static `headers()` block.
//
// Both consumers share the SCRIPT_SOURCES / STYLE_SOURCES / IMG_SOURCES /
// CONNECT_SOURCES / FRAME_SOURCES lists below. Drift between the two
// places used to bite us (Conduit removal, places.googleapis.com for
// /plan, Klaviyo wildcard cleanup) — Codex #12 flagged it in the
// 2026-05-27 review and this module is the consolidation.
//
// Add new origins HERE, not in next.config.ts. The latter only knows
// how to assemble strings from these lists.

function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return `https://${new URL(url).hostname}`;
  } catch {
    return null;
  }
}

const SUPABASE_ORIGINS = supabaseOrigin() ? [supabaseOrigin() as string] : [];

export const SCRIPT_SOURCES = [
  "'self'",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://connect.facebook.net",
  "https://static.klaviyo.com",
  "https://static-tracking.klaviyo.com",
  "https://js.stripe.com",
  "https://googleads.g.doubleclick.net",
  "https://beacon.beyondpricing.com",
  "https://pay.guesty.com",
  "https://bat.bing.com",
  "https://js.hsforms.net",
  "https://js-na2.hsforms.net",
  "https://*.hsforms.net",
  "https://*.hsforms.com",
  "https://*.hubspot.com",
  "https://*.hsappstatic.net",
  // Cloudflare Turnstile api.js — spam protection on the
  // /property-management owner-lead form (posts to the team app's
  // /api/leads, which requires a Turnstile token).
  "https://challenges.cloudflare.com",
  // Conduit AI chat widget — widget.min.js + any sub-resources it pulls.
  "https://*.conduit.ai",
];

export const STYLE_SOURCES = [
  "'self'",
  "'unsafe-inline'",
  "https://*.conduit.ai",
  "https://api.mapbox.com",
  "https://fonts.googleapis.com",
  "https://static.klaviyo.com",
  "https://*.hsforms.net",
  "https://*.hsforms.com",
  "https://*.hubspot.com",
];

export const IMG_SOURCES = [
  "'self'",
  "data:",
  "blob:",
  "https://assets.guesty.com",
  // Some BEAPI image URLs still resolve via the S3 bucket directly — kept
  // for compat with older listing pictures synced before Guesty migrated
  // image hosting under assets.guesty.com.
  "https://guesty-listing-images.s3.amazonaws.com",
  "https://images.unsplash.com",
  "https://lh3.googleusercontent.com",
  "https://places.googleapis.com",
  "https://www.google-analytics.com",
  "https://www.facebook.com",
  "https://api.mapbox.com",
  "https://*.mapbox.com",
  "https://www.google.com",
  "https://googleads.g.doubleclick.net",
  "https://www.googletagmanager.com",
  "https://beacon.beyondpricing.com",
  "https://q.stripe.com",
  "https://*.klaviyo.com",
  "https://d3k81ch9hvuctc.cloudfront.net",
  "https://bat.bing.com",
  "https://*.bing.com",
  "https://*.convex.cloud",
  "https://*.hubspot.com",
  "https://*.hsforms.com",
  "https://*.hsforms.net",
  "https://*.hubspotusercontent-na2.net",
  "https://*.conduit.ai",
];

export const CONNECT_SOURCES = [
  "'self'",
  // Conduit AI chat widget — REST API + chat websocket.
  "https://*.conduit.ai",
  "wss://*.conduit.ai",
  "https://booking.guesty.com",
  "https://open-api.guesty.com",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://analytics.google.com",
  "https://www.google.com",
  "https://api.mapbox.com",
  "https://*.mapbox.com",
  "https://graph.facebook.com",
  "https://a.klaviyo.com",
  "https://fast.a.klaviyo.com",
  "https://static-forms.klaviyo.com",
  // Stripe — full set required for PaymentElement + ExpressCheckout in live mode
  "https://api.stripe.com",
  "https://q.stripe.com",
  "https://r.stripe.com",
  "https://m.stripe.com",
  "https://m.stripe.network",
  "https://*.stripe.com",
  "https://errors.stripe.com",
  "wss://ppm.stripe.com",
  "https://ppm.stripe.com",
  "https://www.googletagmanager.com",
  "https://beacon.beyondpricing.com",
  "https://api.beacon.beyondpricing.com",
  "https://pay.guesty.com",
  "https://stats.g.doubleclick.net",
  "https://googleads.g.doubleclick.net",
  "wss://*.convex.cloud",
  "https://bat.bing.com",
  "https://*.bing.com",
  "https://*.msn.com",
  "https://api64.ipify.org",
  "https://www.googleadservices.com",
  "https://forms.hubspot.com",
  "https://api.hubapi.com",
  "https://*.hubspot.com",
  "https://*.hubapi.com",
  "https://*.hsforms.com",
  "https://*.hsforms.net",
  // Lead form POSTs from /property-management to the Traverse team app.
  "https://team.traversehospitality.com",
  // Cloudflare Turnstile widget telemetry/challenge XHRs.
  "https://challenges.cloudflare.com",
];

export const FRAME_SOURCES = [
  // Conduit AI chat widget renders its panel in an iframe.
  "https://*.conduit.ai",
  // Stripe — PaymentElement and ExpressCheckout create iframes from these origins
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://m.stripe.com",
  "https://*.stripe.com",
  // Google Pay iframe loaded by Stripe's ExpressCheckoutElement
  "https://pay.google.com",
  "https://www.googletagmanager.com",
  "https://pay.guesty.com",
  "https://beacon.beyondpricing.com",
  "https://*.hsforms.com",
  "https://*.hsforms.net",
  "https://*.hubspot.com",
  // Referral form iframe on /referrals-form — Traverse internal team app.
  "https://team.traversehospitality.com",
  // Cloudflare Turnstile renders its challenge in an iframe.
  "https://challenges.cloudflare.com",
  // Google Maps embed (building hub pages — Grand Lodge, The Plaza, Lodge at
  // Mountaineer Square).
  "https://www.google.com",
  "https://maps.google.com",
  // Facebook pixel iframe injected by GTM on conversion pages
  "https://www.facebook.com",
];

const SENSITIVE_CSP_PATH_PREFIXES = [
  "/login",
  "/contact",
  "/book",
  "/account",
  "/auth/reset-password",
];

function joinDirectiveValues(values: string[]) {
  return Array.from(new Set(values)).join(" ");
}

function buildCspString(directives: Record<string, string[]>) {
  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0
        ? `${directive} ${joinDirectiveValues(values)}`
        : directive
    )
    .join("; ");
}

export function isSensitiveCspPath(pathname: string) {
  return SENSITIVE_CSP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Baseline CSP applied to everything via next.config.ts `headers()`.
 * Allows 'unsafe-inline' in script-src because non-sensitive pages don't
 * carry a per-request nonce. Sensitive paths get the stricter nonce-based
 * policy below via middleware.
 */
export function buildBaseContentSecurityPolicy({
  isProduction,
}: {
  isProduction: boolean;
}) {
  return buildCspString({
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isProduction ? [] : ["'unsafe-eval'"]),
      ...SCRIPT_SOURCES,
    ],
    "script-src-attr": ["'none'"],
    "style-src": STYLE_SOURCES,
    "img-src": [...IMG_SOURCES, ...SUPABASE_ORIGINS],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "connect-src": [...CONNECT_SOURCES, ...SUPABASE_ORIGINS],
    "frame-src": FRAME_SOURCES,
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://www.facebook.com"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    ...(isProduction ? { "upgrade-insecure-requests": [] } : {}),
  });
}

/**
 * Stricter CSP for "sensitive" paths (login, contact, book, account,
 * password reset). Replaces 'unsafe-inline' in script-src with a
 * per-request nonce so injected inline scripts can't execute.
 */
export function buildSensitiveContentSecurityPolicy({
  isProduction,
  nonce,
}: {
  isProduction: boolean;
  nonce: string;
}) {
  return buildCspString({
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      ...(isProduction ? [] : ["'unsafe-eval'"]),
      ...SCRIPT_SOURCES,
    ],
    "script-src-attr": ["'none'"],
    "style-src": STYLE_SOURCES,
    "img-src": [...IMG_SOURCES, ...SUPABASE_ORIGINS],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "connect-src": [...CONNECT_SOURCES, ...SUPABASE_ORIGINS],
    "frame-src": FRAME_SOURCES,
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://www.facebook.com"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    ...(isProduction ? { "upgrade-insecure-requests": [] } : {}),
  });
}
