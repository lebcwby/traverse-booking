"use client";

import { useEffect, useRef } from "react";
import {
  getVariant,
  trackABExposure,
  PRICING_BADGE_TEST,
} from "@/lib/ab-testing";
import { CheckCircle2, Umbrella, Tag } from "lucide-react";

/**
 * A/B tested "all fees included" badge for the booking sidebar.
 *
 * Variants:
 *  - rain_check:       "No surprise fees. Total price, every time."
 *  - full_picture:     "Total price shown · No hidden fees"  (default/control)
 *  - no_sticker_shock: "This price is the real price." + subtitle
 */
export function PricingBadge({ className = "" }: { className?: string }) {
  const variant = getVariant(PRICING_BADGE_TEST);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackABExposure(PRICING_BADGE_TEST.id, variant);
      tracked.current = true;
    }
  }, [variant]);

  switch (variant) {
    case "rain_check":
      return <RainCheckBadge className={className} />;
    case "no_sticker_shock":
      return <NoStickerShockBadge className={className} />;
    case "full_picture":
    default:
      return <FullPictureBadge className={className} />;
  }
}

/** Compact pill for mobile bottom bar — always uses the assigned variant */
export function PricingBadgeCompact() {
  const variant = getVariant(PRICING_BADGE_TEST);

  const label =
    variant === "rain_check"
      ? "No surprise fees"
      : variant === "no_sticker_shock"
        ? "All fees included"
        : "Total price shown";

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
      <CheckCircle2 className="h-3 w-3 text-accent" />
      {label}
    </span>
  );
}

/* ─── Variant Components ─────────────────────────────────── */

/** Option 1: "No Rain Checks Needed" — warm bg, umbrella, casual */
function RainCheckBadge({ className }: { className: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-t-lg bg-[#faf8f5] px-4 py-3 ${className}`}
    >
      <Umbrella className="h-[18px] w-[18px] shrink-0 text-[#404f52]" />
      <span className="text-sm font-medium text-[#404f52]">
        No surprise fees. Total price, every time.
      </span>
    </div>
  );
}

/** Option 3: "The Full Picture" — gold pill, checkmark, scannable */
function FullPictureBadge({ className }: { className: string }) {
  return (
    <div
      className={`flex justify-center rounded-t-lg bg-background px-4 py-3 ${className}`}
    >
      <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-foreground">
          <svg viewBox="0 0 11 11" fill="none" className="h-[11px] w-[11px]">
            <path
              d="M2 5.5L4.5 8L9 3"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          Total price shown
        </span>
        <span className="h-1 w-1 rounded-full bg-foreground/40" />
        <span className="text-[13px] font-semibold text-foreground">
          No hidden fees
        </span>
      </div>
    </div>
  );
}

/** Option 5: "No Sticker Shock" — peach bg, price tag, two-line */
function NoStickerShockBadge({ className }: { className: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-t-lg bg-[#f4d7c3] px-4 py-3 ${className}`}
    >
      <div className="relative shrink-0">
        <Tag className="h-[18px] w-[18px] text-[#1c1d1d]" />
        <span className="absolute -bottom-0.5 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#404f52]">
          <svg viewBox="0 0 10 10" fill="none" className="h-2 w-2">
            <path
              d="M2 5L4 7L8 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#1c1d1d] leading-tight">
          This price is the real price.
        </p>
        <p className="text-[12px] text-[#404f52] leading-tight">
          All fees included — no surprises at checkout.
        </p>
      </div>
    </div>
  );
}
