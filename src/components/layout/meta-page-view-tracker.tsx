"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { hasMarketingConsent } from "@/lib/consent";
import { getDiscoveredClientIp } from "@/lib/client-ip-discovery";
import { getKnownGuest } from "@/lib/known-guest";
import { waitForPixelAndFbp } from "@/lib/meta-pixel-wait";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function generateEventId(): string {
  return `pv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getMetaCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const cookies = document.cookie;
  const fbp = cookies.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1];
  const fbc = cookies.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1];
  return { fbp: fbp || undefined, fbc: fbc || undefined };
}

function fireCAPIPageView(eventId: string) {
  if (!hasMarketingConsent()) return;
  getDiscoveredClientIp().then((clientIp) => {
    fetch("/api/track/page-view", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.href,
        eventId,
        guest: getKnownGuest(),
        ...getMetaCookies(),
        clientIp,
      }),
    }).catch(() => {});
  });
}

export function MetaPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMountedRef = useRef(false);
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    const isInitial = !hasMountedRef.current;
    hasMountedRef.current = true;

    const eventId = generateEventId();

    if (isInitial) {
      // Initial PageView: wait for pixel + _fbp, then fire browser fbq (queued
      // via stub if fbevents.js is still loading) and CAPI together so they
      // carry matching eventID and fbp.
      waitForPixelAndFbp().then(() => {
        window.fbq?.("track", "PageView", {}, { eventID: eventId });
        fireCAPIPageView(eventId);
      });
    } else {
      // Subsequent SPA navigations — pixel is already loaded, _fbp exists
      window.fbq?.("track", "PageView", {}, { eventID: eventId });
      fireCAPIPageView(eventId);
    }
  }, [pathname, search]);

  return null;
}
