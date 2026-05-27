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
      "https://bat.bing.com",
      "https://js.hsforms.net",
      "https://js-na2.hsforms.net",
      "https://*.hsforms.net",
      "https://*.hsforms.com",
      "https://*.hubspot.com",
      "https://*.hsappstatic.net",
    ],
    "script-src-attr": ["'none'"],
    "style-src": [
      "'self'",
      "'unsafe-inline'",
      "https://api.mapbox.com",
      "https://fonts.googleapis.com",
      "https://static.klaviyo.com",
      "https://*.hsforms.net",
      "https://*.hsforms.com",
      "https://*.hubspot.com",
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
      "https://places.googleapis.com",
      "https://www.google-analytics.com",
      "https://www.googletagmanager.com",
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
      "https://*.convex.cloud",
      "https://*.hubspot.com",
      "https://*.hsforms.com",
      "https://*.hsforms.net",
      "https://*.hubspotusercontent-na2.net",
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
      // Stripe — full set for PaymentElement + ExpressCheckout in live mode
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
    ],
    "frame-src": [
      // Stripe — PaymentElement and ExpressCheckout iframes
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://m.stripe.com",
      "https://*.stripe.com",
      // Google Pay iframe via Stripe's ExpressCheckoutElement
      "https://pay.google.com",
      "https://www.googletagmanager.com",
      "https://pay.guesty.com",
      "https://beacon.beyondpricing.com",
      "https://*.hsforms.com",
      "https://*.hsforms.net",
      "https://*.hubspot.com",
      // Referral form iframe on /referrals-form — Traverse internal team app.
      "https://team.traversehospitality.com",
      // Google Maps embed (used on building hub pages: /crested-butte/grand-lodge,
      // /crested-butte/the-plaza, /crested-butte/lodge-at-mountaineer-square).
      "https://www.google.com",
      "https://maps.google.com",
      // Facebook pixel iframe injected by GTM on conversion pages
      "https://www.facebook.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://www.facebook.com"],
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
      { protocol: "https", hostname: "guesty-listing-images.s3.amazonaws.com" },
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
      // ─── reservations.booktraverse.com — old Guesty Booking Engine ──────
      // Subdomain was added as a custom domain to this Vercel project on
      // 2026-05-20 specifically so we can 301 these legacy URLs from search
      // index (10 of them surfaced as Soft 404 in Google Search Console).
      // Both rules preserve any query string automatically (Next.js default).
      //
      // Order matters: the /en/* rule strips the locale prefix before the
      // generic catch-all forwards everything else.
      {
        source: "/en/:path*",
        has: [
          { type: "host", value: "reservations.booktraverse.com" },
        ],
        destination: "https://www.booktraverse.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [
          { type: "host", value: "reservations.booktraverse.com" },
        ],
        destination: "https://www.booktraverse.com/:path*",
        permanent: true,
      },

      // ─── 301 redirects from legacy WordPress URLs (booktraverse.com) ────
      // Map old WP page paths to their Next.js equivalents so backlinks and
      // cached search results continue to work after DNS cutover.
      { source: "/homepage", destination: "/", permanent: true },
      { source: "/s/backyard", destination: "/properties", permanent: true },
      { source: "/about", destination: "/contact", permanent: true },

      // ─── Legacy Portland-era pages — retired 2026-05-06. 301 → /properties
      // so any Google-indexed link or stale bookmark lands somewhere useful
      // and the search engine drops the URL from its index.
      { source: "/portland-vacation-apartments", destination: "/properties", permanent: true },
      { source: "/portland-vacation-homes", destination: "/properties", permanent: true },
      { source: "/portland-recommendations", destination: "/properties", permanent: true },
      { source: "/portland-recommendations/:id*", destination: "/properties", permanent: true },
      { source: "/portland-accommodations", destination: "/properties", permanent: true },
      { source: "/portland-homes-vs-hotels", destination: "/properties", permanent: true },
      { source: "/portland-apartments-vs-hotels", destination: "/properties", permanent: true },
      { source: "/portland-neighborhoods", destination: "/properties", permanent: true },
      { source: "/best-places-to-stay-portland", destination: "/properties", permanent: true },
      { source: "/downtown-portland-stays", destination: "/properties", permanent: true },
      { source: "/where-to-stay-in-portland", destination: "/properties", permanent: true },
      { source: "/the-pomeroy", destination: "/properties", permanent: true },
      { source: "/neighborhoods", destination: "/properties", permanent: true },
      { source: "/neighborhoods/:slug*", destination: "/properties", permanent: true },
      { source: "/stays/:slug*", destination: "/properties", permanent: true },

      // /s/* Portland-themed landing slugs — same retirement.
      { source: "/s/luxury", destination: "/properties", permanent: true },
      { source: "/s/budget-friendly", destination: "/properties", permanent: true },
      { source: "/s/short-term-rentals", destination: "/properties", permanent: true },
      { source: "/s/airbnb-alternative", destination: "/properties", permanent: true },
      { source: "/s/top-rated", destination: "/properties", permanent: true },
      { source: "/s/monthly-rentals", destination: "/properties", permanent: true },
      { source: "/s/northeast-portland", destination: "/properties", permanent: true },
      { source: "/s/southeast-portland", destination: "/properties", permanent: true },
      { source: "/s/northwest-portland", destination: "/properties", permanent: true },
      { source: "/s/north-portland", destination: "/properties", permanent: true },
      { source: "/s/mt-hood", destination: "/properties", permanent: true },
      { source: "/s/alberta", destination: "/properties", permanent: true },
      { source: "/s/hawthorne-belmont", destination: "/properties", permanent: true },
      { source: "/s/pearl-district", destination: "/properties", permanent: true },
      { source: "/s/mississippi", destination: "/properties", permanent: true },
      { source: "/s/nw-23rd", destination: "/properties", permanent: true },
      { source: "/s/sellwood-moreland", destination: "/properties", permanent: true },
      { source: "/s/1-bedroom", destination: "/properties", permanent: true },
      { source: "/s/2-bedroom", destination: "/properties", permanent: true },
      { source: "/s/3-bedroom", destination: "/properties", permanent: true },
      { source: "/s/4-bedroom-plus", destination: "/properties", permanent: true },
      { source: "/s/near-ohsu", destination: "/properties", permanent: true },
      { source: "/s/near-moda-center", destination: "/properties", permanent: true },
      { source: "/s/near-portland-airport", destination: "/properties", permanent: true },
      { source: "/s/near-providence-park", destination: "/properties", permanent: true },
      { source: "/s/near-convention-center", destination: "/properties", permanent: true },
      { source: "/s/near-lloyd-center", destination: "/properties", permanent: true },
      { source: "/s/downtown-portland", destination: "/properties", permanent: true },
      { source: "/s/corporate-housing", destination: "/properties", permanent: true },
      { source: "/s/furnished-apartments", destination: "/properties", permanent: true },
      { source: "/s/travel-nurse-housing", destination: "/properties", permanent: true },
      { source: "/s/relocation-housing", destination: "/properties", permanent: true },
      { source: "/s/walkable", destination: "/properties", permanent: true },
      { source: "/s/free-parking", destination: "/properties", permanent: true },
      { source: "/s/portland-accommodations", destination: "/properties", permanent: true },
      { source: "/s/downtown-portland-stays", destination: "/properties", permanent: true },
      { source: "/s/best-portland-stays", destination: "/properties", permanent: true },
      // /reviews stays — kept as a Colorado-rebrand-friendly page. The
      // following three were Portland-template content pages that we couldn't
      // cheaply rewrite for Colorado. Redirect to better Colorado equivalents.
      { source: "/where-to-stay", destination: "/properties", permanent: true },
      { source: "/book-direct", destination: "/", permanent: true },
      { source: "/guide", destination: "/plan", permanent: true },
      // Portland-styled "extended-stay" landing-page body retired 2026-05-27;
      // dedicated Colorado long-stay landing page TBD.
      { source: "/s/extended-stay", destination: "/properties", permanent: true },
      // ─── End Portland retirement ───────────────────────────────────────

      // ─── /guide/portland-* — Stay Portland template leftovers (2026-05-14) ─
      // These slugs are still served live by src/app/guide/[slug]/page.tsx via
      // entries in src/lib/guide-content.ts (full Portland tourism articles).
      // Google indexed them and real users land here from search — confusing
      // for a Colorado vacation-rental site. 301 each to /guide so the pages
      // de-index. Long-term: delete the Portland entries from guide-content.ts
      // (Layer 2) — these redirects can stay or be removed once the slugs no
      // longer resolve. Note: the WordPress redirects above point at these
      // same slugs, so traffic chains WP-URL → /guide/portland-X → /guide
      // (Google handles redirect chains fine).
      { source: "/guide/where-to-stay-in-portland", destination: "/crested-butte/guides/where-to-stay", permanent: true },
      { source: "/guide/best-restaurants-portland", destination: "/guide", permanent: true },
      { source: "/guide/best-breweries-portland", destination: "/guide", permanent: true },
      { source: "/guide/best-parks-portland", destination: "/guide", permanent: true },
      { source: "/guide/day-trips-from-portland", destination: "/guide", permanent: true },
      { source: "/guide/portland-events-festivals", destination: "/guide", permanent: true },
      { source: "/guide/portland-small-businesses", destination: "/guide", permanent: true },
      { source: "/guide/ncaa-march-madness-portland-2026", destination: "/guide", permanent: true },
      { source: "/guide/portland-concerts-2026", destination: "/guide", permanent: true },
      { source: "/guide/portland-summer-events-2026", destination: "/guide", permanent: true },
      // ─── End /guide/portland-* ──────────────────────────────────────────

      { source: "/about-old", destination: "/", permanent: true },
      { source: "/blog-old", destination: "/blog", permanent: true },
      { source: "/recent-news", destination: "/blog", permanent: true },
      { source: "/traversehospitality/blog", destination: "/blog", permanent: true },
      { source: "/traversehospitality", destination: "/", permanent: true },
      { source: "/vacation-rentals", destination: "/properties", permanent: true },
      { source: "/list-your-property", destination: "/property-management", permanent: true },
      {
        source: "/traverse-vail-modern-property-management",
        destination: "/property-management",
        permanent: true,
      },
      {
        source: "/traverse-crested-butte-modern-property-management",
        destination: "/property-management",
        permanent: true,
      },
      {
        source: "/crested-butte/crested-butte-property-management",
        destination: "/property-management",
        permanent: true,
      },
      {
        source: "/crested-butte/guides",
        destination: "/crested-butte/guides/where-to-stay",
        permanent: true,
      },
      {
        source: "/things-to-do-leadville",
        destination: "/leadville",
        permanent: true,
      },
      {
        source: "/things-to-do-leadville/:path*",
        destination: "/leadville",
        permanent: true,
      },
      { source: "/weather-leadville", destination: "/leadville", permanent: true },
      {
        source: "/driving-directions-leadville",
        destination: "/leadville",
        permanent: true,
      },
      // /leadville sub-pages that don't exist as standalone pages — fold into hub
      { source: "/leadville/weather", destination: "/leadville", permanent: true },
      { source: "/leadville/getting-here", destination: "/leadville", permanent: true },
      { source: "/driving-directions", destination: "/contact", permanent: true },
      { source: "/weather", destination: "/", permanent: true },
      { source: "/terms-conditions", destination: "/terms", permanent: true },
      { source: "/press-room", destination: "/contact", permanent: true },
      { source: "/press-room-2", destination: "/contact", permanent: true },
      { source: "/environment", destination: "/", permanent: true },
      { source: "/environment-2", destination: "/", permanent: true },
      { source: "/job-opportunities", destination: "/contact", permanent: true },
      { source: "/owners-portal", destination: "/contact", permanent: true },
      { source: "/myai-account", destination: "/", permanent: true },
      { source: "/evergreen", destination: "/", permanent: true },
      // ─── End of WordPress legacy redirects ──────────────────────────
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
        destination: "/crested-butte/guides/where-to-stay",
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
