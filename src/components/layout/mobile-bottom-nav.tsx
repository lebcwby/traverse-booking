"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Heart, Luggage, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase-auth";

type Tab = {
  label: string;
  icon: typeof Search;
  href: string;
  external?: boolean;
  match: (p: string) => boolean;
  requiresAuth: boolean;
};

const tabs: Tab[] = [
  {
    label: "Explore",
    icon: Search,
    href: "/",
    match: (p: string) => p === "/" || p === "/properties",
    requiresAuth: false,
  },
  {
    label: "Wishlists",
    icon: Heart,
    href: "/account/wishlists",
    match: (p: string) => p === "/account/wishlists",
    requiresAuth: false,
  },
  {
    label: "Trips",
    icon: Luggage,
    href: "/account/reservations",
    match: (p: string) => p.startsWith("/account/reservations"),
    requiresAuth: true,
  },
  {
    label: "Call",
    icon: Phone,
    href: "tel:+17207592013",
    external: true,
    match: () => false,
    requiresAuth: false,
  },
  {
    label: "Profile",
    icon: User,
    href: "/account/settings",
    match: (p: string) => p.startsWith("/account/settings"),
    requiresAuth: false,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [exploreHref, setExploreHref] = useState("/properties");
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Restore last search URL on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("sp_last_search");
    if (saved) setExploreHref(saved);
  }, []);

  // Save search state when on /properties
  useEffect(() => {
    if (pathname === "/properties") {
      const search = searchParams.toString();
      const url = search ? `/properties?${search}` : "/properties";
      sessionStorage.setItem("sp_last_search", url);
      setExploreHref(url);
    }
  }, [pathname, searchParams]);

  // Listen for map visibility events from the properties bottom sheet
  useEffect(() => {
    function onMapShow() {
      setHidden(true);
    }
    function onMapHide() {
      setHidden(false);
    }
    window.addEventListener("map-visible", onMapShow);
    window.addEventListener("map-hidden", onMapHide);
    return () => {
      window.removeEventListener("map-visible", onMapShow);
      window.removeEventListener("map-hidden", onMapHide);
    };
  }, []);

  // Reset hidden state when navigating away from properties
  useEffect(() => {
    if (pathname !== "/properties") setHidden(false);
  }, [pathname]);

  // Hide on property detail pages, checkout flow, and marketing landing pages
  const isPropertyDetail =
    pathname.startsWith("/properties/") && pathname !== "/properties";
  const isCheckout = pathname.startsWith("/book/");
  const isLandingPage =
    pathname.startsWith("/portland-") ||
    pathname.startsWith("/downtown-portland") ||
    pathname.startsWith("/best-places-to-stay") ||
    pathname === "/where-to-stay-in-portland";
  if (isPropertyDetail || isCheckout || isLandingPage) return null;

  const visibleTabs = tabs.filter((t) => !t.requiresAuth || loggedIn);

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 inset-x-0 z-[70] border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden transition-transform duration-300 ease-out"
      style={{ transform: hidden ? "translateY(100%)" : "translateY(0)" }}
    >
      {/* Extends white background below nav to fill gap on iOS Safari */}
      <div className="absolute inset-x-0 top-full h-20 bg-white" />
      <div className="flex h-14 items-center justify-around">
        {visibleTabs.map((tab) => {
          const { label, icon: Icon, match } = tab;
          const active = match(pathname);
          const className = `flex flex-col items-center justify-center gap-0.5 px-2 transition-colors ${
            active ? "text-accent" : "text-muted-foreground"
          }`;

          if (tab.external) {
            return (
              <a key={label} href={tab.href} className={className}>
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span className="text-[10px] font-medium leading-tight">
                  {label}
                </span>
              </a>
            );
          }

          return (
            <Link
              key={label}
              href={label === "Explore" ? exploreHref : tab.href}
              className={className}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
