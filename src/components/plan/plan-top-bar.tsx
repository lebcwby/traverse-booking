"use client";
// src/components/plan/plan-top-bar.tsx
// Desktop-only sticky top bar for the plan workspace. Mirrors the reference
// design: P logomark + tagline on the left, account + menu buttons + the
// prominent "Email my trip plan" CTA on the right. Hidden on mobile (the
// mobile header inside plan-client handles that viewport).

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Luggage, LogOut, Mail, Menu, User, X } from "lucide-react";
import type { Itinerary } from "@/lib/plan/schema";
import { createClient } from "@/lib/supabase-auth";
import { SaveItinerary } from "./save-itinerary";
import { ShareItinerary } from "./share-itinerary";

interface PlanTopBarProps {
  itinerary: Itinerary | null;
}

export function PlanTopBar({ itinerary }: PlanTopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <div className="hidden h-[72px] shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 lg:flex">
      <Link href="/plan" className="flex items-center gap-3">
        <Image
          src="/book-traverse-wordmark-dark.png"
          alt="Book Traverse"
          width={150}
          height={50}
          priority
          className="h-7 w-auto"
        />
        <span className="hidden text-[11.5px] leading-snug text-neutral-500 xl:inline">
          Where Portlanders eat, drink and hang out
        </span>
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href={userEmail ? "/account/reservations" : "/login"}
          aria-label={userEmail ? "Account" : "Log in"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-primary hover:text-primary"
        >
          <User className="h-4 w-4" />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-primary hover:text-primary"
          >
            {menuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
              <MenuLink href="/properties" onClick={() => setMenuOpen(false)}>
                Browse properties
              </MenuLink>
              <MenuLink href="/guide" onClick={() => setMenuOpen(false)}>
                Travel guide
              </MenuLink>
              <MenuLink href="/contact" onClick={() => setMenuOpen(false)}>
                <Mail className="h-4 w-4" /> Contact
              </MenuLink>
              <div className="mx-3 my-1 border-t border-neutral-100" />
              {userEmail ? (
                <>
                  <MenuLink
                    href="/account/wishlists"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Heart className="h-4 w-4" /> Wishlists
                  </MenuLink>
                  <MenuLink
                    href="/account/reservations"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Luggage className="h-4 w-4" /> Trips
                  </MenuLink>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await supabase.auth.signOut();
                      router.refresh();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <MenuLink href="/login" onClick={() => setMenuOpen(false)}>
                  <User className="h-4 w-4" /> Log in
                </MenuLink>
              )}
            </div>
          )}
        </div>

        {itinerary ? (
          <>
            <ShareItinerary itinerary={itinerary} variant="desktop" />
            <SaveItinerary itinerary={itinerary} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
    >
      {children}
    </Link>
  );
}
