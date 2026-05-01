"use client";

import { usePathname } from "next/navigation";

export type PageType =
  | "property_detail"
  | "checkout"
  | "browse"
  | "landing_page"
  | "home"
  | "other";

interface PageContext {
  pageType: PageType;
  pillLabel: string;
  hasBottomBar: boolean;
  /** Hide pill on mobile — true when mobile bottom nav (with Help tab) is visible */
  hideOnMobile: boolean;
}

export function usePageContext(): PageContext {
  const pathname = usePathname();

  const isPropertyDetail =
    pathname.startsWith("/properties/") && pathname !== "/properties";
  const isCheckout = pathname.startsWith("/book/");
  const isBrowse = pathname === "/properties";
  const isHome = pathname === "/";
  const isLandingPage =
    pathname.startsWith("/portland-") ||
    pathname.startsWith("/downtown-portland") ||
    pathname.startsWith("/best-places-to-stay") ||
    pathname === "/where-to-stay-in-portland" ||
    pathname.startsWith("/where-to-stay") ||
    pathname.startsWith("/s/");
  const isConfirmation =
    pathname.includes("/confirmation/") || pathname.includes("/3ds-callback");

  if (isConfirmation) {
    return {
      pageType: "checkout",
      pillLabel: "Questions?",
      hasBottomBar: false,
      hideOnMobile: true,
    };
  }

  if (isPropertyDetail) {
    return {
      pageType: "property_detail",
      pillLabel: "Ask about this place",
      hasBottomBar: false,
      hideOnMobile: true,
    };
  }

  if (isCheckout) {
    return {
      pageType: "checkout",
      pillLabel: "Need booking help?",
      hasBottomBar: false,
      hideOnMobile: true,
    };
  }

  if (isBrowse) {
    return {
      pageType: "browse",
      pillLabel: "Help me find a place",
      hasBottomBar: false,
      hideOnMobile: true,
    };
  }

  if (isLandingPage) {
    return {
      pageType: "landing_page",
      pillLabel: "Help me find a place",
      hasBottomBar: true,
      hideOnMobile: false,
    };
  }

  if (isHome) {
    return {
      pageType: "home",
      pillLabel: "Questions?",
      hasBottomBar: false,
      hideOnMobile: true,
    };
  }

  return {
    pageType: "other",
    pillLabel: "Questions?",
    hasBottomBar: false,
    hideOnMobile: true,
  };
}
