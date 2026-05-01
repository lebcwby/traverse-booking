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

const SCRIPT_SOURCES = [
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
  "https://base.conduit.ai",
  "https://bat.bing.com",
];

const STYLE_SOURCES = [
  "'self'",
  "'unsafe-inline'",
  "https://api.mapbox.com",
  "https://fonts.googleapis.com",
  "https://static.klaviyo.com",
  "https://base.conduit.ai",
];

const IMG_SOURCES = [
  "'self'",
  "data:",
  "blob:",
  "https://assets.guesty.com",
  "https://images.unsplash.com",
  "https://lh3.googleusercontent.com",
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
  "https://*.conduit.ai",
  "https://*.convex.cloud",
];

const CONNECT_SOURCES = [
  "'self'",
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
  "https://api.stripe.com",
  "https://q.stripe.com",
  "https://r.stripe.com",
  "https://m.stripe.network",
  "https://www.googletagmanager.com",
  "https://beacon.beyondpricing.com",
  "https://api.beacon.beyondpricing.com",
  "https://pay.guesty.com",
  "https://stats.g.doubleclick.net",
  "https://googleads.g.doubleclick.net",
  "https://base.conduit.ai",
  "https://*.conduit.ai",
  "wss://*.convex.cloud",
  "https://bat.bing.com",
  "https://*.bing.com",
  "https://*.msn.com",
  "https://api64.ipify.org",
];

const FRAME_SOURCES = [
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://www.googletagmanager.com",
  "https://pay.guesty.com",
  "https://beacon.beyondpricing.com",
  "https://base.conduit.ai",
  "https://*.conduit.ai",
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
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    ...(isProduction ? { "upgrade-insecure-requests": [] } : {}),
  });
}
