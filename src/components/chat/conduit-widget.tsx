"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Conduit is our GUEST support chat — check-in times, hot tub, parking. On an
 * owner-acquisition page it answers the wrong question entirely, and it has
 * been throwing 403s there on top of that. So it loads everywhere except the
 * owner surfaces.
 *
 * Host is checked as well as path on purpose. `audit.` and `projection.` are
 * served by host-scoped rewrites in next.config.ts, so the client router never
 * sees `/audit` — usePathname() returns "/" on those subdomains (the same trap
 * that leaked the mobile bottom bar onto them). Matching on path alone would
 * miss both hosts; matching on host alone would miss www.booktraverse.com/audit.
 */
const OWNER_HOST_PREFIXES = ["audit.", "projection."];
const OWNER_PATHS = ["/property-management", "/audit", "/projection"];

function isOwnerSurface(pathname: string, host: string): boolean {
  // `host` comes from the request header during server render and from
  // window.location afterwards. Without the header the subdomains would only be
  // recognised on the client, and the script would already be in the SSR HTML.
  const h = (
    typeof window !== "undefined" ? window.location.hostname : host
  ).toLowerCase();
  if (OWNER_HOST_PREFIXES.some((p) => h.startsWith(p))) return true;
  return OWNER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function ConduitWidget({
  nonce,
  host = "",
}: {
  nonce?: string;
  host?: string;
}) {
  const pathname = usePathname();
  // Computed during render rather than in state: on a direct load of an owner
  // page this has to be right on the FIRST render, or the 3MB widget bundle
  // starts downloading before an effect could stop it.
  const owner = isOwnerSurface(pathname, host);

  // Un-rendering the <Script> does not remove what the widget already injected,
  // so arriving at an owner page by client-side navigation would otherwise
  // leave the bubble on screen. audit.css handles /audit and /projection via
  // `.audit-page`; /property-management has no such marker class, so the
  // container is hidden directly here — and restored on the way back out.
  useEffect(() => {
    const el = document.getElementById("conduit-widget-container");
    if (!el) return;
    if (owner) el.style.display = "none";
    else el.style.removeProperty("display");
  }, [owner, pathname]);

  if (owner) return null;

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
