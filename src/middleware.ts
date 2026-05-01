import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  rateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from "@/lib/rate-limit";
import {
  buildSensitiveContentSecurityPolicy,
  isSensitiveCspPath,
} from "@/lib/csp";
import {
  META_COOKIE_MAX_AGE_SECONDS,
  META_COOKIE_NAMES,
  formatFbc,
  mintFbp,
} from "@/lib/meta-cookies";

const ATTRIBUTION_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

const COOKIE_NAME = "_sp_attribution";
const FIRST_TOUCH_COOKIE = "_sp_first_touch";
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60;
const VISITOR_ID_COOKIE = "_sp_visitor_id";
const VISITOR_ID_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

interface RateLimitRule extends RateLimitConfig {
  key: string;
  path: RegExp;
  methods: string[];
}

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    key: "payment-intent",
    path: /^\/api\/payment-intent$/,
    methods: ["POST", "PATCH"],
    limit: 10,
    windowMs: 60_000,
  },
  {
    key: "reservations",
    path: /^\/api\/reservations$/,
    methods: ["POST"],
    limit: 5,
    windowMs: 60_000,
  },
  {
    key: "contact",
    path: /^\/api\/contact$/,
    methods: ["POST"],
    limit: 5,
    windowMs: 60_000,
  },
  {
    key: "quotes",
    path: /^\/api\/quotes(?:\/|$)/,
    methods: ["POST"],
    limit: 15,
    windowMs: 60_000,
  },
  {
    key: "account-create",
    path: /^\/api\/account\/create$/,
    methods: ["POST"],
    limit: 3,
    windowMs: 60_000,
  },
  {
    key: "track-viewed-listing",
    path: /^\/api\/track\/viewed-listing$/,
    methods: ["POST"],
    limit: 30,
    windowMs: 60_000,
  },
  {
    key: "track-checkout-started",
    path: /^\/api\/track\/checkout-started$/,
    methods: ["POST"],
    limit: 15,
    windowMs: 60_000,
  },
];

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getRateLimitRule(pathname: string, method: string) {
  return RATE_LIMIT_RULES.find(
    (rule) => rule.methods.includes(method) && rule.path.test(pathname)
  );
}

function buildRateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig
) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );

  return {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Limit": String(config.limit),
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
  };
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (host === "booking.booktraverse.com") {
    let pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/en/") || pathname === "/en") {
      pathname = pathname.replace(/^\/en\/?/, "/") || "/";
    }

    const pathMap: Record<string, string> = {
      "/privacy-policy": "/privacy",
    };
    pathname = pathMap[pathname] ?? pathname;

    if (pathname.startsWith("/property/")) {
      pathname = pathname.replace(/^\/property\//, "/properties/");
    }

    const search = request.nextUrl.searchParams;
    search.delete("pointofsale");
    search.delete("ratePlanId");
    const qs = search.toString();

    const url = new URL(
      pathname + (qs ? `?${qs}` : ""),
      "https://www.booktraverse.com"
    );
    return NextResponse.redirect(url, 301);
  }

  const path = request.nextUrl.pathname;
  const sensitiveCspPath = !path.startsWith("/api") && isSensitiveCspPath(path);
  const nonce = sensitiveCspPath ? btoa(crypto.randomUUID()) : null;
  const sensitiveCsp = nonce
    ? buildSensitiveContentSecurityPolicy({
        isProduction: process.env.NODE_ENV === "production",
        nonce,
      })
    : null;
  const rateLimitRule = getRateLimitRule(path, request.method);
  let rateLimitResult: RateLimitResult | null = null;

  if (rateLimitRule) {
    const ip = getClientIp(request);
    const key = `${rateLimitRule.key}:${ip}`;
    rateLimitResult = await rateLimit(key, rateLimitRule);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimitResult, rateLimitRule),
        }
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (nonce && sensitiveCsp) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", sensitiveCsp);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/account") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /login — no flash of login form
  if (request.nextUrl.pathname === "/login" && user) {
    const redirect = request.nextUrl.searchParams.get("redirect");
    const dest = request.nextUrl.clone();
    dest.pathname =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/account/reservations";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  const url = request.nextUrl;
  const params = url.searchParams;

  const attribution: Record<string, string> = {};
  let hasAttribution = false;

  for (const param of ATTRIBUTION_PARAMS) {
    const value = params.get(param);
    if (value) {
      attribution[param] = value;
      hasAttribution = true;
    }
  }

  if (hasAttribution) {
    // fbclid_ts is the click time in epoch ms — server-tracking.ts uses it
    // when reconstructing _fbc from attribution, so the attribution window
    // anchors to the click instead of the conversion. Without this the fbc
    // fallback uses Date.now() at conversion time, which silently breaks
    // click-attribution math.
    const payload = {
      ...attribution,
      ...(attribution.fbclid && { fbclid_ts: Date.now() }),
      landingPage: url.pathname + url.search,
      capturedAt: new Date().toISOString(),
    };

    response.cookies.set(COOKIE_NAME, JSON.stringify(payload), {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    if (!request.cookies.get(FIRST_TOUCH_COOKIE)?.value) {
      response.cookies.set(FIRST_TOUCH_COOKIE, JSON.stringify(payload), {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }

  // Stable visitor UUID for Meta CAPI external_id. Gives Meta a longitudinal
  // identity anchor for anonymous visitors (no email/phone) so the same
  // person returning across sessions/devices correlates to the same profile
  // in Meta's graph. Sent as sha256(uuid) in user_data.external_id whenever
  // the guest has not yet provided an email (email takes precedence since
  // it's deterministic).
  if (!request.cookies.get(VISITOR_ID_COOKIE)?.value) {
    const newVisitorId = crypto.randomUUID();
    // Mirror onto the request so downstream SSR (layout.tsx readAnonymousMatching)
    // can read the fresh ID via cookies() on the SAME first-visit request —
    // otherwise the visitor waits a full navigation before external_id lands
    // in the browser pixel's advanced matching config.
    request.cookies.set(VISITOR_ID_COOKIE, newVisitorId);
    response.cookies.set(VISITOR_ID_COOKIE, newVisitorId, {
      maxAge: VISITOR_ID_MAX_AGE,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  // Server-mint Meta identifiers so ad-blocker users land in CAPI events
  // with valid _fbp/_fbc. fbevents.js is blocked by uBlock/Brave/EasyPrivacy
  // by URL pattern (/fbevents.js, /facebook-pixel.js, etc), so for those
  // users the cookies never exist and CAPI events ship without a browser
  // identifier — EMQ collapses below 6 and audience match rates die.
  //
  // Non-httpOnly is intentional: fbevents.js (when it does load for
  // non-blocked users) reads document.cookie and skips minting when _fbp
  // already exists, so our value is preserved without collision.
  const fbclid = params.get("fbclid");
  const metaCookieOptions = {
    maxAge: META_COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  if (fbclid) {
    // Always overwrite — a fresh fbclid means a fresh ad click, which
    // resets Meta's click-attribution window. This matches fbevents.js
    // behavior on users without ad blockers.
    response.cookies.set(
      META_COOKIE_NAMES.fbc,
      formatFbc(fbclid, Date.now()),
      metaCookieOptions
    );
  }

  if (!request.cookies.get(META_COOKIE_NAMES.fbp)?.value) {
    response.cookies.set(META_COOKIE_NAMES.fbp, mintFbp(), metaCookieOptions);
  }

  if (nonce && sensitiveCsp) {
    response.headers.set("Content-Security-Policy", sensitiveCsp);
  }

  if (rateLimitRule && rateLimitResult) {
    for (const [header, value] of Object.entries(
      buildRateLimitHeaders(rateLimitResult, rateLimitRule)
    )) {
      response.headers.set(header, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml)$).*)",
  ],
};
