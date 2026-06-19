import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
// Single source of truth for CSP directives — see file header in csp.ts.
// Both this file (baseline policy via headers()) and middleware.ts (stricter
// nonce-based policy for sensitive paths) consume from there so the two
// can't drift. Codex #12 in the 2026-05-27 review.
import { buildBaseContentSecurityPolicy } from "./src/lib/csp";

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
            value: buildBaseContentSecurityPolicy({ isProduction }),
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
    // Host condition for the old traversehospitality.com domain. The regex is
    // anchored by Next.js (full-host match) and matches the apex + www ONLY —
    // it deliberately does NOT match team.traversehospitality.com (its own
    // separate Vercel project), petfriendly.* (Guesty), or any other subdomain.
    const oldDomainHost = [
      { type: "host" as const, value: "(www\\.)?traversehospitality\\.com" },
    ];
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

      // ─── traversehospitality.com → booktraverse.com — full domain migration ─
      // The old WordPress/Guesty site only ever 301'd its homepage; every deep
      // page 404'd or redirected to a dead URL, so booktraverse inherited almost
      // none of the old domain's SEO equity. The single biggest lost asset was
      // /leadville-colorado-vacation-rentals (~half the old domain's organic
      // traffic: 1,084 clicks / 31k impressions over 16 months in GSC).
      //
      // To complete the migration, traversehospitality.com (apex + www) is
      // pointed at THIS Vercel project (GoDaddy apex A → 76.76.21.21, www CNAME
      // → cname.vercel-dns.com, GoDaddy Forwarding OFF) and these host-scoped
      // 301s map each old path to its booktraverse equivalent.
      //
      // ⚠️ SUBDOMAINS ARE UNAFFECTED: `oldDomainHost` matches apex + www only.
      // team.traversehospitality.com has its own separate Vercel deployment and
      // DNS record (its traffic never reaches this app); petfriendly.* (Guesty)
      // and reservations./hottubs.* keep their own records too.
      //
      // Order matters — Next.js redirects are first-match-wins. Specific maps
      // first, the blog catch-all next, the homepage catch-all LAST.
      //
      // High-value pages mapped 1:1.
      { source: "/leadville-colorado-vacation-rentals", has: oldDomainHost, destination: "https://www.booktraverse.com/leadville", permanent: true },
      { source: "/property-management", has: oldDomainHost, destination: "https://www.booktraverse.com/property-management", permanent: true },
      { source: "/traverse-vail-modern-property-management", has: oldDomainHost, destination: "https://www.booktraverse.com/vail", permanent: true },
      { source: "/about", has: oldDomainHost, destination: "https://www.booktraverse.com/property-management", permanent: true },
      { source: "/about-old", has: oldDomainHost, destination: "https://www.booktraverse.com/property-management", permanent: true },
      { source: "/owners-portal", has: oldDomainHost, destination: "https://www.booktraverse.com/property-management", permanent: true },
      { source: "/summer-activities", has: oldDomainHost, destination: "https://www.booktraverse.com/crested-butte/things-to-do/summer-activities", permanent: true },
      { source: "/press-room-2", has: oldDomainHost, destination: "https://www.booktraverse.com/contact", permanent: true },
      { source: "/job-opportunities-2", has: oldDomainHost, destination: "https://www.booktraverse.com/contact", permanent: true },
      { source: "/evergreen", has: oldDomainHost, destination: "https://www.booktraverse.com/properties", permanent: true },
      { source: "/w9-and-payment-authorization-form", has: oldDomainHost, destination: "https://www.booktraverse.com/w9-and-payment-authorization-form", permanent: true },

      // All 22 blog posts: old /traversehospitality/blog/<old-slug> → new /blog/<slug>.
      { source: "/traversehospitality/blog/crested-butte-vacation-rental-income", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/crested-butte-vacation-rental-income", permanent: true },
      { source: "/traversehospitality/blog/best-hiking-near-leadville-colorado", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/best-hiking-near-leadville-colorado", permanent: true },
      { source: "/traversehospitality/blog/what-to-pack-colorado-mountain-trip", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/what-to-pack-colorado-mountain-trip", permanent: true },
      { source: "/traversehospitality/blog/crested-butte-wildflower-season-guide-2026", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/crested-butte-wildflower-season-guide-2026", permanent: true },
      { source: "/traversehospitality/blog/grand-lodge-crested-butte-condos-traverse-vs-vail-resorts-what-s-the-difference", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/grand-lodge-traverse-vs-vail-resorts", permanent: true },
      { source: "/traversehospitality/blog/pet-friendly-crested-butte-condo-grand-lodge-studio-153-walk-to-the-lifts-pool-hot-tub", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/pet-friendly-crested-butte-grand-lodge-153", permanent: true },
      { source: "/traversehospitality/blog/leadville-colorado-the-complete-visitor-s-guide-2026-2", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/leadville-complete-visitors-guide", permanent: true },
      { source: "/traversehospitality/blog/budget-friendly-ski-vacation-affordable-leadville-rentals-near-top-resorts", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/budget-friendly-ski-vacation-leadville", permanent: true },
      { source: "/traversehospitality/blog/10-cozy-vacation-rentals-in-leadville-for-the-ultimate-winter-getaway", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/cozy-winter-rentals-leadville", permanent: true },
      { source: "/traversehospitality/blog/ultimate-guide-to-a-cozy-christmas-2024-getaway-in-leadville-top-vacation-rentals-for-families", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/christmas-getaway-leadville", permanent: true },
      { source: "/traversehospitality/blog/thrilling-fall-adventures-vacation-rentals-near-leadvilles-best-hiking-and-biking-trails", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/fall-adventures-leadville-hiking-biking", permanent: true },
      { source: "/traversehospitality/blog/top-5-cozy-vacation-rentals-in-leadville-for-winter-ski-enthusiasts", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/top-5-winter-ski-rentals-leadville", permanent: true },
      { source: "/traversehospitality/blog/thanksgiving-in-leadville-family-friendly-vacation-rentals-for-a-mountain-holiday-getaway", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/thanksgiving-leadville-family-rentals", permanent: true },
      { source: "/traversehospitality/blog/romantic-getaways-in-leadville-cozy-vacation-rentals-for-two", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/romantic-getaways-leadville", permanent: true },
      { source: "/traversehospitality/blog/10-reasons-to-book-a-leadville-vacation-rental-for-labor-day-weekend", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/labor-day-leadville", permanent: true },
      { source: "/traversehospitality/blog/from-solo-retreats-to-group-getaways-sizing-up-leadvilles-vacation-rental-options", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/solo-to-group-getaways-leadville", permanent: true },
      { source: "/traversehospitality/blog/top-10-airbnb-properties-in-leadville-co", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/top-10-leadville-vacation-rentals", permanent: true },
      { source: "/traversehospitality/blog/top-7-ski-resorts-that-are-less-than-an-hour-drive-from-leadville-colorado", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/ski-resorts-near-leadville", permanent: true },
      { source: "/traversehospitality/blog/introducing-traverse-hospitality-a-new-chapter-in-our-journey", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/introducing-traverse-hospitality", permanent: true },
      { source: "/traversehospitality/blog/dos-and-donts-of-vacation-rental-interior-design", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/vacation-rental-interior-design-tips", permanent: true },
      { source: "/traversehospitality/blog/pros-and-cons-of-online-reviews", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/pros-and-cons-online-reviews", permanent: true },
      { source: "/traversehospitality/blog/historic-houses-in-leadville", has: oldDomainHost, destination: "https://www.booktraverse.com/blog/historic-houses-leadville", permanent: true },

      // Any other blog URL on the old domain → the blog index.
      { source: "/traversehospitality/blog/:path*", has: oldDomainHost, destination: "https://www.booktraverse.com/blog", permanent: true },
      { source: "/traversehospitality/blog", has: oldDomainHost, destination: "https://www.booktraverse.com/blog", permanent: true },

      // Catch-all (MUST be last): everything else on apex/www → homepage.
      { source: "/:path*", has: oldDomainHost, destination: "https://www.booktraverse.com/", permanent: true },

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
      // Legacy WordPress URLs still in Google's index but now 404 (verified
      // 2026-06-09) → 301 to their new equivalents so they pass equity instead
      // of soft-404ing. Specific rules MUST precede the catch-alls (Next.js
      // redirects are first-match-wins, in array order).
      {
        source: "/leadville-colorado-vacation-rentals",
        destination: "/leadville",
        permanent: true,
      },
      {
        source: "/traversehospitality/blog/:path*",
        destination: "/blog",
        permanent: true,
      },
      {
        // Note the legacy typo "activitites" — kept exactly as the old slug.
        source: "/cb-things-to-do/cb-winter-activitites",
        destination: "/crested-butte/things-to-do/winter-activities",
        permanent: true,
      },
      {
        source: "/cb-things-to-do/:path*",
        destination: "/crested-butte/things-to-do",
        permanent: true,
      },
      {
        source: "/cb-things-to-do",
        destination: "/crested-butte/things-to-do",
        permanent: true,
      },
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
