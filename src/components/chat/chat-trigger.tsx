"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { openConduitWidget } from "@/components/conduit-widget";
import { usePageContext } from "./use-page-context";

export function ChatTrigger() {
  const ctx = usePageContext();
  const [mounted, setMounted] = useState(false);
  const [pastGallery, setPastGallery] = useState(
    ctx.pageType !== "property_detail"
  );

  useEffect(() => setMounted(true), []);

  // On PDP, only show after scrolling past the photo gallery
  useEffect(() => {
    if (ctx.pageType !== "property_detail") {
      setPastGallery(true);
      return;
    }
    function onScroll() {
      setPastGallery(window.scrollY > 400);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ctx.pageType]);

  function handlePillClick() {
    const listing =
      ctx.pageType === "property_detail" ? window.__spCurrentListing : null;
    openConduitWidget({
      trigger: "pill",
      pageType: ctx.pageType,
      ...(listing && { listingId: listing.id, listingTitle: listing.title }),
    });
  }

  const visible = mounted && pastGallery;

  return (
    <div
      className={`fixed z-[75] ${
        ctx.hideOnMobile ? "hidden lg:flex" : "flex"
      } flex-col mb-[env(safe-area-inset-bottom)] ${
        ctx.hasBottomBar ? "bottom-24 lg:bottom-5" : "bottom-5"
      } right-5 items-end transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Chat pill */}
      <button
        type="button"
        aria-label="Open chat"
        onClick={handlePillClick}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg p-3 lg:px-4 lg:py-3"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span className="hidden lg:inline text-sm font-medium whitespace-nowrap">
          {ctx.pillLabel}
        </span>
      </button>
    </div>
  );
}
