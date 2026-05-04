import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildCsp() {
  const supabaseOrigin = (() => {
    const host = supabaseHostname();
    return host ? `https://${host}` : null;
  })();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isProduction ? [] : ["'unsafe-eval'"]),
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
    ],
    "script-src-attr": ["'none'"],
    "style-src": [
      "'self'",
      "'unsafe-inline'",
      "https://api.mapbox.com",
      "https://fonts.googleapis.com",
      "https://static.klaviyo.com",
      "https://base.conduit.ai",
    ],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://assets.guesty.com",
      "https://guesty-listing-images.s3.amazonaws.com",
      "https://images.unsplash.com",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      "https://lh3.googleusercontent.com",
      "https://www.google-analytics.com",
      "https://www.facebook.com",
      "https://api.mapbox.com",
      "https://*.mapbox.com",
      "https://www.google.com",
      "https://googleads.g.doubleclick.net",
      "https://beacon.beyondpricing.com",
      "https://q.stripe.com",
      "https://static.klaviyo.com",
      "https://static-forms.klaviyo.com",
      "https://*.klaviyo.com",
      "https://d3k81ch9hvuctc.cloudfront.net",
      "https://bat.bing.com",
      "https://*.bing.com",
      "https://*.conduit.ai",
      "https://*.convex.cloud",
    ],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "connect-src": [
      "'self'",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
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
    ],
    "frame-src": [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://www.googletagmanager.com",
      "https://pay.guesty.com",
      "https://beacon.beyondpricing.com",
      "https://base.conduit.ai",
      "https://*.conduit.ai",
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([directive, values]) =>
      values.length > 0
        ? `${directive} ${Array.from(new Set(values)).join(" ")}`
        : directive
    )
    .join("; ");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["10.1.10.10", "10.128.82.25"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: isProduction
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: buildCsp(),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.guesty.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      ...(supabaseHostname()
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname() as string,
            },
          ]
        : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/plan/chat",
        destination: "/portland-recommendations",
        permanent: true,
      },
      {
        source: "/plan/portland-food-weekend",
        destination: "/plan/portland-food-itinerary",
        permanent: true,
      },
      {
        source: "/plan/portland-outdoors-weekend",
        destination: "/plan/portland-outdoors-itinerary",
        permanent: true,
      },
      {
        source: "/plan/portland-classic-weekend",
        destination: "/plan/portland-weekend-itinerary",
        permanent: true,
      },
      {
        source: "/where-to-stay",
        destination: "/guide/where-to-stay-in-portland",
        permanent: true,
      },
      {
        source: "/visit-portland-travel-guide",
        destination: "/guide",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/the-best-local-breweries-to-visit-in-portland-oregon",
        destination: "/guide/best-breweries-portland",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/the-best-parks-to-visit-in-portland-oregon",
        destination: "/guide/best-parks-portland",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/top-5-best-day-trips-from-portland",
        destination: "/guide/day-trips-from-portland",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/exploring-portlands-unique-neighborhoods",
        destination: "/guide/where-to-stay-in-portland",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/annual-events-and-festivals-in-portland-you-cant-miss",
        destination: "/guide/portland-events-festivals",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/a-foodies-guide-to-portland-best-places-to-eat-and-drink",
        destination: "/guide/best-restaurants-portland",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/supporting-local-spotlight-on-portlands-best-small-businesses",
        destination: "/guide/portland-small-businesses",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/providence-park-summer-concerts-2024",
        destination: "/guide/portland-concerts-2026",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/pdx-unveils-215-billion-terminal-renovation-with-oregon-inspired-design",
        destination: "/guide",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/wnba-expansion-to-portland-a-slam-dunk-for-the-city",
        destination: "/guide",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/top-things-to-do-in-portland-this-october",
        destination: "/guide/portland-events-festivals",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/project-pabst-festival-returns-to-portlands-waterfront-park",
        destination: "/guide/portland-events-festivals",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/the-portland-pickles-baseball-fun-events-and-a-new-pub",
        destination: "/guide/portland-events-festivals",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/top-things-to-do-in-portland-this-september",
        destination: "/guide/portland-events-festivals",
        permanent: true,
      },
      {
        source:
          "/visit-portland-travel-guide/the-best-day-ever-amine-music-festival-portland",
        destination: "/guide/portland-concerts-2026",
        permanent: true,
      },
      {
        source: "/visit-portland-travel-guide/:path*",
        destination: "/guide",
        permanent: true,
      },
      {
        source: "/s/near-airport",
        destination: "/s/near-portland-airport",
        permanent: true,
      },
      { source: "/contact-us", destination: "/contact", permanent: true },
      {
        source: "/business-travel-vacation-rentals-portland-1",
        destination: "/s/corporate-housing",
        permanent: true,
      },
      {
        source: "/family-friendly-vacation-rentals-portland",
        destination: "/s/family-friendly",
        permanent: true,
      },
      {
        source: "/furnished-rentals",
        destination: "/s/furnished-apartments",
        permanent: true,
      },
      { source: "/general-1-2", destination: "/", permanent: true },
      { source: "/join-guest-club", destination: "/", permanent: true },
      { source: "/no-fees", destination: "/", permanent: true },
    ];
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/googled24fbb127c11e5a0.html",
          destination: "/api/google-verify",
        },
      ],
    };
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
