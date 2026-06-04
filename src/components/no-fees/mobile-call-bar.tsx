"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, ArrowRight } from "lucide-react";
import { trackClickToCall } from "@/lib/tracking";

/**
 * Sticky mobile-only action bar for building landing pages (Test B).
 *
 * GA4 funnel analysis (2026-06-03) showed mobile is the real, converting
 * Grand Lodge audience, and Google Business Profile visitors frequently want
 * to *call* or are comparing against the OTA listing they just saw. This bar
 * gives them a one-tap call (high-intent lead) and a one-tap path into live
 * availability, reinforcing the book-direct value.
 *
 * Mobile only (`sm:hidden`), scroll-triggered so it never covers the hero on
 * first paint. Call taps fire a `click_to_call` GA4 event.
 */
export function MobileCallBar({
  phoneTel,
  phoneDisplay,
  availabilityHref,
  callSource,
  threshold = 450,
}: {
  /** E.164 tel: target, e.g. "+19704382241". */
  phoneTel: string;
  /** Human display, e.g. "(970) 438-2241". */
  phoneDisplay: string;
  /** Where the "Check availability" CTA links (date-seeded list). */
  availabilityHref: string;
  /** Identifier for the GA4 click_to_call event, e.g. "grand-lodge". */
  callSource: string;
  /** Scroll px before the bar appears. */
  threshold?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/95 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm transition-transform duration-300 sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <p className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">
        Book direct &amp; save — no booking fees
      </p>
      <div className="flex items-stretch gap-2">
        <a
          href={`tel:${phoneTel}`}
          onClick={() => trackClickToCall({ source: callSource, phone: phoneTel })}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-primary px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          aria-label={`Call ${phoneDisplay}`}
        >
          <Phone className="h-4 w-4" />
          Call
        </a>
        <Link
          href={availabilityHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Check availability
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
