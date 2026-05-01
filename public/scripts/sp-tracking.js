/*
 * Book Traverse tracking bundle for static HTML pages served from /public/.
 *
 * Next.js routes get tracking via src/app/layout.tsx. Static HTML in /public/
 * bypasses that, so any .html page dropped into public/ (e.g. /no-fees/, Meta
 * landing page variants) must reference this script to get the same coverage.
 *
 * Loads (in order, after consent-default.js has already run):
 *   1. Google Tag Manager (GTM-KN2S5WQV) — deferred via requestIdleCallback
 *   2. Standalone gtag.js — GA4 (G-PPWFFFPC42) + Google Ads (AW-16519101211)
 *   3. Microsoft Ads UET (ti=187242635)
 *   4. Meta Pixel (1449075326140271) + Meta CAPI PageView — gated by consent
 *
 * Idempotent: safe to include twice; each loader guards with a flag.
 * Depends on: consent-default.js must be loaded SYNCHRONOUSLY before this file
 * so gtag consent mode defaults are applied before any gtag() config runs.
 */
(function () {
  "use strict";

  var GTM_ID = "GTM-KN2S5WQV";
  var GA_MEASUREMENT_ID = "G-PPWFFFPC42";
  var GOOGLE_ADS_ID = "AW-16519101211";
  var META_PIXEL_ID = "1449075326140271";
  var UET_TAG_ID = "187242635";
  var LINKER_DOMAINS = ["booktraverse.com", "www.booktraverse.com"];

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  /* ---------- consent read (mirrors src/lib/consent.ts) ---------- */
  function readCookie(name) {
    var prefix = name + "=";
    var cookies = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < cookies.length; i++) {
      if (cookies[i].indexOf(prefix) === 0) {
        return cookies[i].slice(prefix.length);
      }
    }
    return "";
  }

  function hasMarketingConsent() {
    var raw = readCookie("_sp_consent");
    var params = new URLSearchParams(raw || "");
    var legacyOptOut = readCookie("_sp_ccpa_optout") === "1";
    var marketing = params.has("m") ? params.get("m") === "1" : true;
    return marketing && !legacyOptOut;
  }

  /* ---------- GTM (deferred) ---------- */
  function initGTM() {
    if (window.__spGtmLoaded) return;
    window.__spGtmLoaded = true;
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    var firstScript = document.getElementsByTagName("script")[0];
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  function scheduleGTM() {
    if ("requestIdleCallback" in window) {
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

  /* ---------- Microsoft Ads UET ---------- */
  (function (w, d, t, r, u) {
    if (w.__spUetLoaded) return;
    w.__spUetLoaded = true;
    var f, n, i;
    w[u] = w[u] || [];
    f = function () {
      var o = { ti: UET_TAG_ID };
      o.q = w[u];
      w[u] = new w.UET(o);
      w[u].push("pageLoad");
    };
    n = d.createElement(t);
    n.src = r;
    n.async = 1;
    n.onload = n.onreadystatechange = function () {
      var s = this.readyState;
      if (s && s !== "loaded" && s !== "complete") return;
      f();
      n.onload = n.onreadystatechange = null;
    };
    i = d.getElementsByTagName(t)[0];
    i.parentNode.insertBefore(n, i);
  })(window, document, "script", "//bat.bing.com/bat.js", "uetq");

  /* ---------- gtag.js (GA4 + Google Ads) ---------- */
  if (!window.__spGtagLoaded) {
    window.__spGtagLoaded = true;
    var gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src =
      "https://www.googletagmanager.com/gtag/js?id=" + GA_MEASUREMENT_ID;
    document.head.appendChild(gtagScript);

    var ignoreReferrer = [
      "checkout.stripe.com",
      "buy.stripe.com",
      "hooks.stripe.com",
      "booking.guesty.com",
    ].some(function (domain) {
      return document.referrer.indexOf(domain) !== -1;
    });

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: true,
      cookie_domain: "booktraverse.com",
      linker: { domains: LINKER_DOMAINS },
      ignore_referrer: ignoreReferrer,
    });
    window.gtag("config", GOOGLE_ADS_ID, {
      allow_enhanced_conversions: true,
    });
  }

  /* ---------- Meta Pixel + CAPI PageView (consent-gated) ---------- */
  function loadMetaPixel() {
    if (window.__spFbqLoaded) return;
    window.__spFbqLoaded = true;

    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js"
    );

    window.fbq("consent", "grant");
    window.fbq("init", META_PIXEL_ID);

    var eventId =
      "pv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    window.fbq("track", "PageView", {}, { eventID: eventId });

    // CAPI mirror — same eventID for dedup. Server resolves IP/geo.
    try {
      fetch("/api/track/page-view", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: window.location.href,
          eventId: eventId,
          fbp: readCookie("_fbp") || undefined,
          fbc: readCookie("_fbc") || undefined,
        }),
      }).catch(function () {});
    } catch (e) {
      /* ignore — CAPI is best-effort */
    }
  }

  if (hasMarketingConsent()) {
    loadMetaPixel();
  } else if (window.fbq) {
    window.fbq("consent", "revoke");
  }

  // Re-check consent when the user updates preferences elsewhere on the site.
  window.addEventListener("sp:consent-changed", function () {
    if (hasMarketingConsent()) {
      loadMetaPixel();
    } else if (window.fbq) {
      window.fbq("consent", "revoke");
    }
  });
})();
