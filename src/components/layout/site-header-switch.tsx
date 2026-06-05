"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";

/**
 * Global header selector (rendered once in the root layout).
 *
 * The rich "home page" nav (NoFeesHeader) is the default across the whole site;
 * the search-oriented Header is kept only on /properties* (the browse/detail
 * surface, which has its own filter UI).
 *
 * Pages that already render their own NoFeesHeader inline (the building/market
 * landing pages) suppress this global one via a CSS rule in no-fees.css
 * (`body:has(main .site-header) > header`), so there's never a double header.
 */
export function SiteHeaderSwitch() {
  const pathname = usePathname();
  if (pathname.startsWith("/properties")) return <Header />;
  return <NoFeesHeader />;
}
