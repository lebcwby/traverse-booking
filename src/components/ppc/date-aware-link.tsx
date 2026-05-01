"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps carousel sections to intercept property card clicks and
 * append any dates stored in sessionStorage by the search form.
 */
export function DateAwareLinks({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const link = (e.target as HTMLElement).closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // Only intercept internal property and explore links
      if (!href.startsWith("/properties") && !href.startsWith("/s/")) return;

      const stored = sessionStorage.getItem("ppc_search_dates");
      if (!stored) return; // No dates entered, let link work normally

      try {
        const { checkIn, checkOut, guests } = JSON.parse(stored);
        if (!checkIn && !checkOut) return; // No dates to append

        e.preventDefault();
        const url = new URL(href, window.location.origin);
        if (checkIn && !url.searchParams.has("checkIn"))
          url.searchParams.set("checkIn", checkIn);
        if (checkOut && !url.searchParams.has("checkOut"))
          url.searchParams.set("checkOut", checkOut);
        if (guests && !url.searchParams.has("guests"))
          url.searchParams.set("guests", guests);
        router.push(url.pathname + url.search);
      } catch {
        // Parse error — let link work normally
      }
    },
    [router]
  );

  return <div onClick={handleClick}>{children}</div>;
}
