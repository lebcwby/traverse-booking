import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/lib/cart/cart-store";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ConsentManager } from "@/components/analytics/consent-manager";
import { MetaPageViewTracker } from "@/components/layout/meta-page-view-tracker";
import { QualifiedEngagementTracker } from "@/components/layout/qualified-engagement-tracker";
import { getGoogleAdsId } from "@/lib/google-ads-public";
import { readAnonymousMatching } from "@/lib/anonymous-matching-server";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-KN2S5WQV";
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-PPWFFFPC42";
const GOOGLE_ADS_ID = getGoogleAdsId();
const GOOGLE_LINKER_DOMAINS = ["booktraverse.com", "www.booktraverse.com"];

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
    "Colorado's locally managed vacation rental company. Browse 180+ homes in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes. No booking fees — book direct and save 10–15% vs. Airbnb and VRBO.",
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
      "Colorado's locally managed vacation rental company. Browse 180+ homes in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes. No booking fees — book direct and save 10–15% vs. Airbnb and VRBO.",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const anonMatching = await readAnonymousMatching();
  // Sensitive paths (/book/*, /login, /contact, /account/*, /auth/reset-password)
  // get a nonce-based CSP without 'unsafe-inline'. Inline <Script> blocks below
  // must carry this nonce or they're blocked, breaking GTM + Google Ads enhanced
  // conversions on checkout. See src/lib/csp.ts buildSensitiveContentSecurityPolicy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      <head>
        {/* Favicon — Traverse blue diamonds on transparent background.
            Regenerate via `npx tsx scripts/regenerate-favicons.ts` after
            updating /public/book-traverse-icon.png. */}
        <link
          rel="icon"
          href="/favicon-light-32.png"
          sizes="32x32"
          type="image/png"
        />
        <link
          rel="icon"
          href="/favicon-light-48.png"
          sizes="48x48"
          type="image/png"
        />
        <link
          rel="icon"
          href="/icon-light-192.png"
          sizes="192x192"
          type="image/png"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
      <body className={`${font.className} antialiased`}>
        {/* Server-injected anonymous matching for Meta Pixel AM. Edge geo
            headers aren't readable client-side, so inline them here for
            consent-manager to merge into fbq('init', ...) on every visit. */}
        <script
          id="sp-anon-match"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.__sp_anon_match=${JSON.stringify(anonMatching).replace(/</g, "\\u003c")};`,
          }}
        />
        <Script
          src="/scripts/consent-default.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        {/*
          GA4 config — placed as a synchronous inline script so it queues in
          dataLayer BEFORE React hydration. If this runs afterInteractive, the
          config command arrives AFTER useEffect fires view_item/add_to_cart,
          and gtag.js drops those events because no GA4 property is configured
          yet when it replays the queue. By queuing config early (before any
          useEffect), gtag.js sees: consent → js → config → view_item → …
          and all custom events are correctly attributed to G-C5098JP52V.
          gtag.js itself still loads afterInteractive to avoid blocking LCP.
        */}
        <script
          id="google-tag-config"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              window.gtag = window.gtag || function () {
                window.dataLayer.push(arguments);
              };

              var ignoreReferrer = [
                "checkout.stripe.com",
                "buy.stripe.com",
                "hooks.stripe.com",
                "booking.guesty.com",
              ].some(function (domain) {
                return document.referrer.indexOf(domain) !== -1;
              });

              window.gtag("js", new Date());
              window.gtag("config", "${GA_MEASUREMENT_ID}", {
                send_page_view: true,
                cookie_domain: "booktraverse.com",
                linker: { domains: ${JSON.stringify(GOOGLE_LINKER_DOMAINS)} },
                ignore_referrer: ignoreReferrer,
              });
              window.gtag("config", "${GOOGLE_ADS_ID}", {
                allow_enhanced_conversions: true,
              });
            `,
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* Meta Pixel (noscript fallback) */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1449075326140271&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        {/* CartProvider wraps Header (so the cart icon + drawer can read state)
            and {children} (so AddToCartButton on property pages can write).
            Footer + MobileBottomNav don't read cart state, so leaving them
            outside is fine and keeps the provider tree narrow. */}
        <CartProvider>
          <Header />
          <main id="main-content" className="min-h-screen pb-16 lg:pb-0">
            {children}
          </main>
        </CartProvider>
        <Footer />
        <Suspense>
          <MobileBottomNav />
        </Suspense>

        {/* Microsoft Ads UET — loaded directly (not via GTM) to avoid CSP nonce
            blocking on /book pages and deferred GTM timing gaps */}
        <Script
          id="uet-init"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"187242635"};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");
            `,
          }}
        />

        {/* Google Tag Manager */}
        <Script
          id="gtm-init"
          strategy="afterInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function initGTM() {
                  if (window.__gtmLoaded) return;
                  window.__gtmLoaded = true;
                  window.dataLayer = window.dataLayer || [];
                  window.dataLayer.push({
                    "gtm.start": new Date().getTime(),
                    event: "gtm.js",
                  });
                  var firstScript = document.getElementsByTagName("script")[0];
                  var script = document.createElement("script");
                  script.async = true;
                  script.src = "https://www.googletagmanager.com/gtm.js?id=${GTM_ID}";
                  if (firstScript && firstScript.parentNode) {
                    firstScript.parentNode.insertBefore(script, firstScript);
                  } else {
                    document.head.appendChild(script);
                  }
                }
                function scheduleGTM() {
                  if ('requestIdleCallback' in window) {
                    requestIdleCallback(initGTM, { timeout: 3500 });
                  } else {
                    setTimeout(initGTM, 2000);
                  }
                }
                if (document.visibilityState === "visible") {
                  scheduleGTM();
                } else {
                  document.addEventListener("visibilitychange", function h() {
                    if (document.visibilityState === "visible") {
                      scheduleGTM();
                      document.removeEventListener("visibilitychange", h);
                    }
                  });
                }
              })();
            `,
          }}
        />

        {/*
          Standalone gtag.js — required to process custom gtag() events
          (view_item, begin_checkout, search, etc.) from the dataLayer.
          GTM loads its own gtag.js internally but does NOT process
          arguments-style dataLayer entries from window.gtag() calls.
          Without this script, all custom GA4 events are silently dropped.

          Loaded afterInteractive to avoid blocking LCP. The config command
          (send_page_view, linker, etc.) is issued in the synchronous
          google-tag-config inline script above, so by the time gtag.js
          replays the dataLayer, config is already queued before any
          view_item / add_to_cart events fired by React useEffect hooks.
        */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
          nonce={nonce}
        />

        <ConsentManager />
        <Suspense fallback={null}>
          <MetaPageViewTracker />
        </Suspense>
        <QualifiedEngagementTracker />
      </body>
    </html>
  );
}
