"use client";
// src/components/plan/share-itinerary.tsx
// Share button: native Web Share API on mobile + Safari, copy-to-clipboard
// fallback on desktop Chrome/Firefox. Shares the current URL, which
// plan-client persists to /plan/[id] ~800ms after the first itinerary
// settles so recipients SSR into static-plan-page.

import { useState } from "react";
import { Share2, Check, Link as LinkIcon } from "lucide-react";
import type { Itinerary } from "@/lib/plan/schema";

interface ShareItineraryProps {
  itinerary: Itinerary;
  variant?: "mobile" | "desktop";
}

export function ShareItinerary({
  itinerary,
  variant = "mobile",
}: ShareItineraryProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const title = itinerary.title || "My Colorado trip plan";
    const text = `${title} — built on Book Traverse`;

    const canNativeShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";

    if (canNativeShare) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link to share your trip plan:", url);
    }
  };

  if (variant === "desktop") {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label={copied ? "Link copied" : "Share trip plan"}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-primary hover:text-primary"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" />
            Copied
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            Share
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? "Link copied" : "Share trip plan"}
      className="inline-flex w-full shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full border border-neutral-300 bg-white px-6 py-3.5 text-[15px] font-semibold tracking-tight text-neutral-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:translate-y-0 sm:w-auto"
    >
      {copied ? (
        <>
          <Check className="h-5 w-5 text-emerald-600" />
          Link copied
        </>
      ) : (
        <>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Share2 className="h-5 w-5" />
          ) : (
            <LinkIcon className="h-5 w-5" />
          )}
          Share trip plan
        </>
      )}
    </button>
  );
}
