import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
// Loaded globally so the rich NoFeesHeader (now the default header on every
// page except /properties*) is styled everywhere, not just on landing pages.
import "@/app/no-fees/no-fees.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.booktraverse.com"),
  title: {
    default:
      "Colorado Vacation Rentals | Traverse Hospitality — Book Direct & Save",
    template: "%s | Traverse Hospitality",
  },
  description:
    "Colorado's locally managed vacation rental company. Browse 220+ homes in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes. No booking fees — book direct and save 10–15% vs. Airbnb and VRBO.",
  icons: null,
  manifest: "/site.webmanifest",
  verification: {
    google: "qc3712I1_krL82AHCuK-s4yTeiCVCFVJljvUsZ90LWI",
  },
  openGraph: {
    type: "website",
    siteName: "Traverse Hospitality",
    locale: "en_US",
    description:
      "Colorado's locally managed vacation rental company. Browse 220+ homes in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes. No booking fees — book direct and save 10–15% vs. Airbnb and VRBO.",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

/**
 * Root layout — deliberately a THIN STATIC SHELL.
 *
 * ⚠️ Do not add `headers()`, `cookies()`, `searchParams` or any other dynamic
 * API to this file. A root layout that reads one forces dynamic rendering for
 * EVERY route beneath it, and the CDN then caches nothing for anybody. That is
 * precisely the bug this file was split to fix: `/properties/[id]` declared
 * `revalidate = 300` and had never once used it, because the layout read both
 * `headers()` and `cookies()` (issue #82).
 *
 * Everything that needs request context now lives one level down:
 *   - app/(public)/layout.tsx — static, no nonce
 *   - app/(secure)/layout.tsx — dynamic, reads the CSP nonce
 * Both render the shared <SiteShell>. See docs/static-listing-pages.md.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Favicon — Traverse blue diamonds on transparent background.
            Regenerate via `npx tsx scripts/regenerate-favicons.ts` after
            updating /public/book-traverse-icon.png. */}
        {/* ?v=2 cache-bust forces Slack/iMessage/social/browser favicon
            caches to refetch after the Stay-Portland→Traverse icon swap.
            Bump on any future icon regen. */}
        <link
          rel="icon"
          href="/favicon-light-32.png?v=2"
          sizes="32x32"
          type="image/png"
        />
        <link
          rel="icon"
          href="/favicon-light-48.png?v=2"
          sizes="48x48"
          type="image/png"
        />
        <link
          rel="icon"
          href="/icon-light-192.png?v=2"
          sizes="192x192"
          type="image/png"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
        <link
          rel="preload"
          as="image"
          href="/images/home/hero-mobile.jpg"
          media="(max-width: 639px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/images/home/hero-desktop.jpg"
          media="(min-width: 640px)"
          fetchPriority="high"
        />
        <link rel="preconnect" href="https://assets.guesty.com" />
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://assets.guesty.com" />
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
      </head>
      <body className={`${font.className} antialiased`}>{children}</body>
    </html>
  );
}
