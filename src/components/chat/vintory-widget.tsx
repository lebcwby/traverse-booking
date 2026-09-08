"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isOwnerSurface } from "@/lib/owner-surfaces";

const LOADER_SRC = "https://widgets.leadconnectorhq.com/loader.js";
const RESOURCES_URL = "https://widgets.leadconnectorhq.com/chat-widget/loader.js";
const WIDGET_ID = "6a94dee3d45d62178f396363";
const SCRIPT_ID = "vintory-chat-widget";

/**
 * Vintory's LeadConnector chat, on the owner-acquisition pages only.
 *
 * ⚠️ Injected imperatively rather than with next/script, which cost most of a
 * day the first time round. In the App Router:
 *   · strategy="afterInteractive" emits NO literal <script src> — the tag is
 *     client-injected and lives only in the RSC payload, so a compliance
 *     reviewer fetching the HTML sees nothing.
 *   · strategy="beforeInteractive" emits only <link rel="preload">.
 *   · A plain <script async> gets hoisted into <head> by React 19, so the
 *     loader runs before <body> exists and the widget never mounts.
 * Creating the element in an effect sidesteps all three: the body is there by
 * definition, and the loader mounts normally.
 *
 * CSP needs https://*.leadconnectorhq.com in script/style/connect/frame/img/
 * font — the bare widgets host is not enough, because the loader goes on to
 * pull chat-widget.esm.js and libphonenumber from stcdn once it boots.
 */
export function VintoryWidget({ host = "" }: { host?: string }) {
  const pathname = usePathname();
  const owner = isOwnerSurface(pathname, host);

  useEffect(() => {
    if (!owner) {
      // Navigating away: drop the loader so it can't re-init, and remove the
      // UI it already mounted. LeadConnector appends its own elements outside
      // our tree, so un-rendering a component would not have cleaned them up.
      document.getElementById(SCRIPT_ID)?.remove();
      document
        .querySelectorAll("chat-widget, [id^='lc_text-widget'], #lc_text-widget")
        .forEach((el) => el.remove());
      return;
    }

    if (document.getElementById(SCRIPT_ID)) return;

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = LOADER_SRC;
    s.defer = true;
    s.setAttribute("data-resources-url", RESOURCES_URL);
    s.setAttribute("data-widget-id", WIDGET_ID);
    s.setAttribute("data-source", "WEB_USER");
    document.body.appendChild(s);
  }, [owner, pathname]);

  return null;
}
