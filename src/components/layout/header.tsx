"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Luggage,
  User,
  Settings,
  Mail,
  LogOut,
  Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase-auth";
import { clearWishlistCache } from "@/components/wishlist-button";
import { HeaderCartButton } from "@/components/cart/header-cart-button";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isSettingsPage = pathname.startsWith("/account/settings");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (pathname !== "/") {
      router.prefetch("/");
    }
  }, [pathname, router]);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  // Clear navigating state when returning via browser back (bfcache)
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setNavigating(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserAvatar(session?.user?.user_metadata?.avatar_url ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const isPropertiesSearchPage = pathname === "/properties";

  if (isPropertiesSearchPage) {
    return (
      <header
        className={`sticky top-0 z-[70] hidden w-full border-b border-border bg-[#faf8f5] transition-shadow duration-300 lg:block ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        <div className="flex h-20 items-center justify-between px-4 md:px-14">
          <Link
            href="/"
            className="flex shrink-0 items-center"
            aria-label="Traverse Hospitality"
            onClick={() => setNavigating(true)}
          >
            <picture>
              <source srcSet="/no-fees/logo.webp" type="image/webp" />
              <img
                src="/no-fees/logo.png"
                alt="Traverse Hospitality"
                width={432}
                height={144}
                className="h-10 w-auto"
              />
            </picture>
          </Link>

          <div className="flex shrink-0 items-center gap-6">
            <HeaderCartButton className="text-[#2a2b2b] transition-colors hover:text-[#2d3e2c]" />
            <Link
              href="/account/wishlists"
              className="flex items-center gap-2 text-sm font-medium text-[#2a2b2b] transition-colors hover:text-[#2d3e2c]"
            >
              <Heart className="h-4 w-4" strokeWidth={1.8} />
              Wishlist
            </Link>
            {userEmail ? (
              <Link
                href="/account/reservations"
                className="flex items-center gap-2 text-sm font-medium text-[#2a2b2b] transition-colors hover:text-[#2d3e2c]"
              >
                {userAvatar ? (
                  <Image
                    src={userAvatar}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2d3e2c] text-[11px] font-bold text-white">
                    {userEmail[0].toUpperCase()}
                  </span>
                )}
                Account
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm font-medium text-[#2a2b2b] transition-colors hover:text-[#2d3e2c]"
              >
                <User className="h-4 w-4" strokeWidth={1.8} />
                Sign in
              </Link>
            )}
            <Link
              href="/properties"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1d1d] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a2b2b]"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Check Availability
            </Link>
          </div>
        </div>

        {navigating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white">
            <div className="flex flex-col items-center">
              <Image
                src="/book-traverse-icon.png"
                alt="Traverse Hospitality"
                width={56}
                height={63}
                className="mb-6 animate-pulse"
                priority
              />
              <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/50"
                  style={{
                    animation: "shimmer 2.5s ease-in-out infinite",
                    width: "40%",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  return (
    <header
      className={`sticky top-0 z-[70] w-full border-b border-border bg-white transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      } hidden lg:block`}
    >
      <div className="flex h-16 items-center justify-between px-4 md:h-20 md:px-14">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center"
          onClick={() => {
            if (pathname !== "/") setNavigating(true);
          }}
        >
          <Image
            src="/book-traverse-icon.png"
            alt="Traverse Hospitality"
            width={32}
            height={36}
            className="h-8 w-auto md:h-9"
            priority
          />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Done button on settings, otherwise avatar + menu */}
        {isSettingsPage ? (
          <button
            onClick={() => router.back()}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Done
          </button>
        ) : (
          <div
            className="relative flex shrink-0 items-center gap-3"
            ref={menuRef}
          >
            {userEmail ? (
              <Link
                href="/account/settings"
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
              >
                {userAvatar ? (
                  <Image
                    src={userAvatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-medium text-primary">
                    {userEmail[0].toUpperCase()}
                  </div>
                )}
              </Link>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-muted hover:shadow-md"
            >
              <Menu className="h-5 w-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border bg-white py-2 shadow-xl">
                {userEmail ? (
                  <>
                    <Link
                      href="/account/wishlists"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Heart className="h-5 w-5" />
                      Wishlists
                    </Link>
                    <Link
                      href="/account/reservations"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Luggage className="h-5 w-5" />
                      Trips
                    </Link>
                    {/* Messages link hidden until feature is ready */}
                    <Link
                      href="/account/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <User className="h-5 w-5" />
                      Profile
                    </Link>
                    <div className="mx-4 my-1 border-t border-border" />
                    <Link
                      href="/account/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm text-foreground hover:bg-muted"
                    >
                      <Settings className="h-5 w-5" />
                      Account Settings
                    </Link>
                    <Link
                      href="/contact"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm text-foreground hover:bg-muted"
                    >
                      <Mail className="h-5 w-5" />
                      Contact
                    </Link>
                    <div className="mx-4 my-1 border-t border-border" />
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        await supabase.auth.signOut();
                        clearWishlistCache();
                        router.refresh();
                      }}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <LogOut className="h-5 w-5" />
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/contact"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Mail className="h-5 w-5" />
                      Contact
                    </Link>
                    <div className="mx-4 my-1 border-t border-border" />
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm text-foreground hover:bg-muted"
                    >
                      <User className="h-5 w-5" />
                      Log In
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {navigating && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white">
          <div className="flex flex-col items-center">
            <Image
              src="/book-traverse-icon.png"
              alt="Traverse Hospitality"
              width={56}
              height={63}
              className="mb-6 animate-pulse"
              priority
            />
            <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/50"
                style={{
                  animation: "shimmer 2.5s ease-in-out infinite",
                  width: "40%",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
