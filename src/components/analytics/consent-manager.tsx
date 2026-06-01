"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  applyConsentMode,
  getEffectiveClientConsent,
  type ConsentState,
} from "@/lib/consent";
import { createClient } from "@/lib/supabase-auth";
import {
  clearKnownGuest,
  getKnownGuest,
  KNOWN_GUEST_UPDATED_EVENT,
  setKnownGuest,
  type KnownGuest,
} from "@/lib/known-guest";
import { resetCheckoutTrackingState } from "@/lib/tracking";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    __sp_anon_match?: {
      external_id?: string;
      ct?: string;
      st?: string;
      zp?: string;
      country?: string;
    };
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return undefined;
}

function getAnonymousMatching(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const geo = window.__sp_anon_match || {};
  const visitorId = geo.external_id || readCookie("_sp_visitor_id");
  if (visitorId) out.external_id = visitorId;
  if (geo.ct) out.ct = geo.ct;
  if (geo.st) out.st = geo.st;
  if (geo.zp) out.zp = geo.zp;
  if (geo.country) out.country = geo.country;
  return out;
}

const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1449075326140271";
const KLAVIYO_COMPANY_ID =
  process.env.NEXT_PUBLIC_KLAVIYO_COMPANY_ID || "UMUgtM";

function loadScriptOnce(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function toAdvancedMatching(guest: KnownGuest): Record<string, string> {
  // Meta's browser pixel accepts raw values here and hashes client-side.
  // Only include fields that are present — empty strings hurt match quality.
  // Anonymous baseline (visitor UUID + edge geo) is the floor for every
  // visitor; known-guest fields override when present.
  const out: Record<string, string> = getAnonymousMatching();
  if (guest.email) out.em = guest.email;
  if (guest.phone) out.ph = guest.phone.replace(/\D/g, "");
  if (guest.firstName) out.fn = guest.firstName;
  if (guest.lastName) out.ln = guest.lastName;
  if (guest.city) out.ct = guest.city;
  if (guest.state) out.st = guest.state;
  if (guest.zip) out.zp = guest.zip;
  if (guest.country) out.country = guest.country;
  return out;
}

function loadMetaPixel(advancedMatching?: Record<string, string>) {
  if (window.fbq) {
    window.fbq("consent", "grant");
    // If we got user data after pixel was already initialized, re-init to update matching
    if (advancedMatching && Object.keys(advancedMatching).length > 0) {
      window.fbq("init", META_PIXEL_ID, advancedMatching);
    }
    return;
  }

  type MetaQueue = ((...args: unknown[]) => void) & {
    callMethod?: (...args: unknown[]) => void;
    push?: (...args: unknown[]) => void;
    loaded?: boolean;
    version?: string;
    queue?: unknown[][];
  };

  const fbq = ((...args: unknown[]) => {
    const existing = fbq as MetaQueue;
    if (existing.callMethod) existing.callMethod(...args);
    else {
      existing.queue = existing.queue || [];
      existing.queue.push(args);
    }
  }) as MetaQueue;

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  loadScriptOnce(
    "meta-pixel-loader",
    "https://connect.facebook.net/en_US/fbevents.js"
  );

  window.fbq("consent", "grant");
  window.fbq("init", META_PIXEL_ID, advancedMatching || {});
  // PageView removed — MetaPageViewTracker owns all PageViews with dedup eventIds

  // Signal that the pixel stub is ready to accept queued events
  window.dispatchEvent(new Event("sp:meta-pixel-ready"));
}

function revokeMetaPixel() {
  if (window.fbq) {
    window.fbq("consent", "revoke");
  }
  // Clear guest identity on opt-out so we don't keep firing enriched events
  // against consent. clearKnownGuest() also dispatches the updated event
  // so any listener (including the effect below) can react.
  clearKnownGuest();
  // Also reset IC dedup state so an opt-in after this fresh-starts — otherwise
  // stale sessionStorage keys (_sp_ic_event_id_*, _sp_checkout_tracked_*) and
  // the in-memory enrichedFiredIcKeys Set would suppress new enriched IC fires.
  resetCheckoutTrackingState();
}

export function ConsentManager() {
  const pathname = usePathname();
  const isCheckout = pathname.startsWith("/book");
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const advancedMatchingRef = useRef<Record<string, string>>(
    toAdvancedMatching(getKnownGuest())
  );

  // Subscribe to auth state for Meta Advanced Matching.
  // onAuthStateChange fires INITIAL_SESSION on subscribe, plus login/logout.
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email;
      if (!email) return;
      // Only populate from auth if we have no identity yet. The checkout
      // form's identifyUser() path always wins — it's the user's active
      // booking intent, and blindly letting auth overwrite it would trigger
      // the identity-anchor wipe in setKnownGuest() and destroy the richer
      // phone/firstName/lastName the form already captured.
      const current = getKnownGuest();
      if (!current.email) {
        setKnownGuest({ email });
      }
      // Deliberately do NOT clear on logout — the session may still contain
      // identity typed into the checkout form. Identity is cleared on
      // explicit consent revoke via revokeMetaPixel().
    });

    return () => subscription.unsubscribe();
  }, []);

  // Whenever known-guest updates (auth login, checkout form fill, inquiry form),
  // refresh the pixel's advanced matching config so subsequent browser-side
  // fbq('track', ...) calls carry the richer identity for Meta matching.
  useEffect(() => {
    const handler = () => {
      const matching = toAdvancedMatching(getKnownGuest());
      advancedMatchingRef.current = matching;
      if (window.fbq && Object.keys(matching).length > 0) {
        window.fbq("init", META_PIXEL_ID, matching);
      }
    };
    window.addEventListener(KNOWN_GUEST_UPDATED_EVENT, handler);
    return () => window.removeEventListener(KNOWN_GUEST_UPDATED_EVENT, handler);
  }, []);

  useEffect(() => {
    const syncConsent = () => {
      const next = getEffectiveClientConsent();
      setConsent(next);
      applyConsentMode(next);
    };

    syncConsent();
    window.addEventListener("sp:consent-changed", syncConsent);
    return () => window.removeEventListener("sp:consent-changed", syncConsent);
  }, []);

  useEffect(() => {
    if (!consent) return;

    applyConsentMode(consent);
    const interval = window.setInterval(() => applyConsentMode(consent), 500);
    window.setTimeout(() => window.clearInterval(interval), 4000);

    let klaviyoIdleHandle: number | undefined;
    let klaviyoTimeoutHandle: ReturnType<typeof setTimeout> | undefined;

    if (consent.marketing) {
      // Load the Meta Pixel EAGERLY (no rIC deferral). Every ms of pixel-load
      // delay is a ms where ViewContent/Search/IC events fire without the
      // _fbp cookie, which breaks Listing Viewers audience population.
      // Tracking quality > LCP for SP's direct-booking funnel.
      loadMetaPixel(advancedMatchingRef.current);

      // Klaviyo onsite (popups) is not tracking-critical — keep it deferred so
      // it doesn't contend with fbevents.js for main-thread time. Skip on
      // checkout entirely (popups distract from payment).
      if (!isCheckout) {
        const loadKlaviyo = () => {
          if (!getEffectiveClientConsent().marketing) return;
          loadScriptOnce(
            "klaviyo-onsite",
            `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`
          );
        };
        if ("requestIdleCallback" in window) {
          klaviyoIdleHandle = requestIdleCallback(loadKlaviyo, {
            timeout: 4000,
          });
        } else {
          klaviyoTimeoutHandle = setTimeout(loadKlaviyo, 2000);
        }
      }
    } else {
      revokeMetaPixel();
    }
    return () => {
      window.clearInterval(interval);
      if (klaviyoIdleHandle !== undefined)
        cancelIdleCallback(klaviyoIdleHandle);
      if (klaviyoTimeoutHandle !== undefined)
        clearTimeout(klaviyoTimeoutHandle);
    };
  }, [consent, isCheckout]);

  return null;
}
