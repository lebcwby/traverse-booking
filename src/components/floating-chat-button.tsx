"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { openConduitWidget } from "@/components/conduit-widget";

/**
 * Floating chat trigger for mobile on pages where the bottom nav is hidden
 * (property detail, checkout, landing pages). On those pages the bottom nav's
 * "Help" button isn't available, so this provides an alternate way to open
 * the Conduit chat widget. Shows page-aware copy instead of a generic icon.
 *
 * Fix #3: Positioned above existing fixed bottom bars (MobileBottomBar on PDP,
 * pay bar on checkout) to avoid overlapping primary CTAs.
 */
export function FloatingChatButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show on the same pages where MobileBottomNav returns null
  const isPropertyDetail =
    pathname.startsWith("/properties/") && pathname !== "/properties";
  const isCheckout = pathname.startsWith("/book/");
  const isLandingPage =
    pathname.startsWith("/portland-") ||
    pathname.startsWith("/downtown-portland") ||
    pathname.startsWith("/best-places-to-stay") ||
    pathname === "/where-to-stay-in-portland";

  if (!isPropertyDetail && !isCheckout && !isLandingPage) return null;

  const label = isCheckout
    ? "Need booking help?"
    : isPropertyDetail
      ? "Ask about this place"
      : "Help me find a place";

  // Fix #2: Pass pageType so GA4 events have context even without listing data
  const pageType = isPropertyDetail
    ? "property_detail"
    : isCheckout
      ? "checkout"
      : "landing_page";

  return (
    <button
      type="button"
      aria-label="Open chat"
      onClick={() =>
        openConduitWidget({ trigger: "floating_button", pageType })
      }
      className={`fixed right-5 z-[60] flex items-center gap-2 rounded-full bg-[#404f52] text-white shadow-lg transition-transform duration-300 ease-out px-4 py-3 mb-[env(safe-area-inset-bottom)] lg:hidden ${
        mounted ? "scale-100" : "scale-0"
      } ${isPropertyDetail || isCheckout ? "bottom-24" : "bottom-5"}`}
    >
      <MessageCircle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}
