// sp_qualified_engagement — GA4 custom event fired once per session when a
// visitor shows real booking intent. Used as the primary biddable conversion
// on upper-funnel campaigns (Hotel Intent) where last-click purchase signal
// is too sparse to train on. See book-traverse/hotel-ads.md for context.

import { hasAnalyticsConsent } from "@/lib/consent";

const SS = {
  fired: "sp_qe_fired",
  sessionStart: "sp_qe_session_start",
  viewItems: "sp_qe_view_items",
  pageViews: "sp_qe_pages",
  searchFired: "sp_qe_search_fired",
} as const;

const THRESHOLDS = {
  viewItemMin: 2,
  searchDwellMs: 60_000,
  deepPagesMin: 3,
  deepDwellMs: 120_000,
} as const;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureSessionStart(): number {
  if (typeof window === "undefined") return Date.now();
  const existing = sessionStorage.getItem(SS.sessionStart);
  if (existing) return Number(existing);
  const now = Date.now();
  sessionStorage.setItem(SS.sessionStart, String(now));
  return now;
}

function sessionMs(): number {
  return Date.now() - ensureSessionStart();
}

function alreadyFired(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(SS.fired) === "1";
}

function fire(trigger: string) {
  if (typeof window === "undefined") return;
  if (alreadyFired()) return;
  if (!hasAnalyticsConsent() || !window.gtag) return;

  sessionStorage.setItem(SS.fired, "1");
  window.gtag("event", "sp_qualified_engagement", {
    trigger,
    session_duration_s: Math.floor(sessionMs() / 1000),
    view_item_count: Number(sessionStorage.getItem(SS.viewItems) ?? 0),
    pages_viewed: Number(sessionStorage.getItem(SS.pageViews) ?? 0),
  });
}

export function noteViewItem() {
  if (typeof window === "undefined" || alreadyFired()) return;
  const next = Number(sessionStorage.getItem(SS.viewItems) ?? 0) + 1;
  sessionStorage.setItem(SS.viewItems, String(next));
  if (next >= THRESHOLDS.viewItemMin) fire("view_item_2plus");
}

export function noteSearch() {
  if (typeof window === "undefined" || alreadyFired()) return;
  sessionStorage.setItem(SS.searchFired, "1");
  if (sessionMs() >= THRESHOLDS.searchDwellMs) {
    fire("search_60s");
    return;
  }
  const remaining = THRESHOLDS.searchDwellMs - sessionMs();
  window.setTimeout(() => {
    if (sessionStorage.getItem(SS.searchFired) === "1") fire("search_60s");
  }, remaining + 50);
}

export function noteAddToWishlist() {
  fire("wishlist");
}

export function notePageView() {
  if (typeof window === "undefined" || alreadyFired()) return;
  ensureSessionStart();
  const next = Number(sessionStorage.getItem(SS.pageViews) ?? 0) + 1;
  sessionStorage.setItem(SS.pageViews, String(next));

  if (next < THRESHOLDS.deepPagesMin) return;
  if (sessionMs() >= THRESHOLDS.deepDwellMs) {
    fire("deep_engagement");
    return;
  }
  const remaining = THRESHOLDS.deepDwellMs - sessionMs();
  window.setTimeout(() => {
    const pages = Number(sessionStorage.getItem(SS.pageViews) ?? 0);
    if (pages >= THRESHOLDS.deepPagesMin) fire("deep_engagement");
  }, remaining + 50);
}
