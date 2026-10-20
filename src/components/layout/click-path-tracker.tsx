"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { hasAnalyticsConsent } from "@/lib/consent";
import { recordClickPathStep } from "@/lib/click-path";

/**
 * Appends each page the visitor sees to the `_sp_path` session cookie, so a
 * completed booking can say which pages led to it. See src/lib/click-path.ts
 * for why the write happens here in the browser and not in `proxy.ts`.
 *
 * Deliberately `usePathname()` only, no `useSearchParams()`: the query string
 * is not recorded, and avoiding that hook keeps this out of a Suspense
 * boundary and off the deopted-to-client-rendering list.
 */
export function ClickPathTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (!hasAnalyticsConsent()) return;
    recordClickPathStep(pathname);
  }, [pathname]);

  return null;
}
