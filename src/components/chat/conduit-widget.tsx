"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isOwnerSurface } from "@/lib/owner-surfaces";

/**
 * Conduit is our GUEST support chat — check-in times, hot tub, parking. On an
 * owner-acquisition page it answers the wrong question entirely, and it has
 * been throwing 403s there on top of that. So it loads everywhere except the
 * owner surfaces, which are where the Vintory widget takes over instead.
 */
/**
 * Kill switch. Set NEXT_PUBLIC_CONDUIT_WIDGET=off to remove the widget
 * sitewide without editing code.
 *
 * ⚠️ This still needs a redeploy. NEXT_PUBLIC_* values are inlined at BUILD
 * time, so flipping it in Vercel does nothing until the next deploy — and per
 * CLAUDE.md that deploy must use `--force`, or the cached build keeps the old
 * value. It saves a code change and a review, not a deploy.
 */
const WIDGET_DISABLED =
  (process.env.NEXT_PUBLIC_CONDUIT_WIDGET || "").trim().toLowerCase() === "off";

export function ConduitWidget({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  // Host is read here rather than passed down from the root layout: that prop
  // came from `headers()`, which forced dynamic rendering for the entire site
  // (issue #82). It only discriminates the landing subdomains, where
  // usePathname() returns "/" because the rewrite is server-side.
  //
  // ⚠️ Tradeoff: on audit.booktraverse.com the suppression now happens at
  // hydration rather than during SSR, so the loader can briefly start. That
  // page is a low-traffic lead magnet where this widget already 403s (noted in
  // CLAUDE.md), so it is not a regression — but it is a real narrowing.
  const host = typeof window !== "undefined" ? window.location.host : "";
  // Computed during render rather than in state: on a direct load of an owner
  // page this has to be right on the FIRST render, or the 3MB widget bundle
  // starts downloading before an effect could stop it.
  const owner = isOwnerSurface(pathname, host);

  // Un-rendering the <Script> does not remove what the widget already injected,
  // so arriving at an owner page by client-side navigation would otherwise
  // leave the bubble on screen. audit.css handles /audit and /projection via
  // `.audit-page`; /property-management has no such marker class, so the
  // container is hidden directly here — and restored on the way back out.
  const hidden = owner || WIDGET_DISABLED;

  useEffect(() => {
    const el = document.getElementById("conduit-widget-container");
    if (!el) return;
    if (hidden) el.style.display = "none";
    else el.style.removeProperty("display");
  }, [hidden, pathname]);

  if (hidden) return null;

  return (
    <Script
      id="conduit-widget"
      src="https://base.conduit.ai/widget/widget.min.js"
      strategy="afterInteractive"
      nonce={nonce}
      data-widget-id="775588b1-311b-4695-bf49-b820b965e107"
    />
  );
}
