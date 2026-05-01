"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-auth";

type NavMenu = {
  label: string;
  items: { href: string; label: string; external?: boolean }[];
};

const RENTALS_MENU: NavMenu["items"] = [
  { href: "/properties", label: "Browse All Properties" },
  { href: "/properties?includeAmenities=HOT_TUB", label: "Hot Tub Rentals" },
  { href: "/properties?petsAllowed=true", label: "Pet Friendly" },
  { href: "/properties?maxPrice=100", label: "Starting under $100/night" },
];

const CB_MENU: NavMenu["items"] = [
  { href: "/crested-butte", label: "All Crested Butte Rentals" },
  { href: "/crested-butte/grand-lodge", label: "Grand Lodge" },
  { href: "/crested-butte/lodge-at-mountaineer-square", label: "Lodge at Mountaineer Square" },
  { href: "/crested-butte/the-plaza", label: "The Plaza" },
  { href: "/crested-butte/guides/where-to-stay", label: "Where to Stay Guide" },
  { href: "/crested-butte/things-to-do", label: "Things to Do" },
  { href: "https://www.crestedbutteskirentals.com/", label: "Ski & Bike Rentals ↗", external: true },
];

const LV_MENU: NavMenu["items"] = [
  { href: "/leadville", label: "All Leadville Rentals" },
  { href: "/properties?city=Leadville&tags=Grand+West+Village+Resort", label: "Grand West Village" },
  { href: "/properties?city=Leadville&tags=OSV", label: "Old St Vincents" },
  { href: "/properties?city=Leadville&tags=cabin", label: "Cabin Rentals" },
  { href: "/leadville/things-to-do", label: "Things to Do" },
  { href: "/leadville/weather", label: "Weather" },
  { href: "/leadville/getting-here", label: "Getting Here" },
];

const GUIDES_MENU: NavMenu["items"] = [
  { href: "/crested-butte/guides/where-to-stay", label: "Where to Stay in Crested Butte" },
  { href: "/crested-butte/things-to-do", label: "Things to Do in Crested Butte" },
  { href: "/leadville/things-to-do", label: "Things to Do in Leadville" },
  { href: "/blog", label: "Blog" },
];

const OWNERS_MENU: NavMenu["items"] = [
  { href: "/property-management", label: "Property Management" },
  { href: "/list-your-property", label: "List Your Property" },
  { href: "https://booktraverse.com/owners-portal/", label: "Owner Portal ↗", external: true },
];

type MenuKey = "rentals" | "cb" | "lv" | "guides" | "owners" | null;

export function NoFeesHeader() {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initial = email ? email.charAt(0).toUpperCase() : null;

  function NavDropdown({
    id,
    label,
    items,
  }: {
    id: MenuKey;
    label: string;
    items: NavMenu["items"];
  }) {
    return (
      <div className={`nav-item has-menu${openMenu === id ? " is-open" : ""}`}>
        <button
          type="button"
          className="nav-trigger"
          aria-expanded={openMenu === id}
          onClick={() => setOpenMenu((c) => (c === id ? null : id))}
        >
          {label} <span className="caret">▾</span>
        </button>
        <div className="nav-menu" role="menu">
          {items.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                role="menuitem"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.label} href={item.href} role="menuitem">
                {item.label}
              </Link>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link href="/" className="logo" aria-label="Traverse Hospitality">
            <picture>
              <source
                media="(max-width: 720px)"
                srcSet="/no-fees/logo-white.webp"
                type="image/webp"
              />
              <source
                media="(max-width: 720px)"
                srcSet="/no-fees/logo-white.png"
              />
              <source srcSet="/no-fees/logo.webp" type="image/webp" />
              <img
                src="/no-fees/logo.png"
                alt="Traverse Hospitality"
                width={432}
                height={144}
              />
            </picture>
          </Link>

          <nav className="primary-nav" aria-label="Primary" ref={navRef}>
            <NavDropdown id="rentals" label="Rentals" items={RENTALS_MENU} />
            <NavDropdown id="cb" label="Crested Butte" items={CB_MENU} />
            <NavDropdown id="lv" label="Leadville" items={LV_MENU} />
            <NavDropdown id="guides" label="Guides & Blog" items={GUIDES_MENU} />
            <NavDropdown id="owners" label="For Owners" items={OWNERS_MENU} />
          </nav>

          <div className="header-actions">
            <a
              href="tel:+17207592013"
              className="icon-link"
              aria-label="Call us"
              style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.02em" }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>(720) 759-2013</span>
            </a>
            {email ? (
              <Link
                href="/account/reservations"
                className="icon-link"
                aria-label="Account"
              >
                <span className="account-avatar">{initial}</span>
                <span>Account</span>
              </Link>
            ) : (
              <Link href="/login" className="icon-link" aria-label="Sign in">
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Sign in</span>
              </Link>
            )}
            <a
              href="/plan"
              target="_blank"
              rel="noopener"
              className="btn btn-primary btn-plan"
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
                <path d="M12 3v18M3 8h18M3 16h18" />
                <circle cx="8" cy="8" r={1.4} fill="currentColor" />
                <circle cx="16" cy="16" r={1.4} fill="currentColor" />
              </svg>
              Plan My Trip
            </a>
            <button
              type="button"
              className="menu-toggle"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav${mobileOpen ? " open" : ""}`}>
        <button
          type="button"
          className="mobile-nav-close"
          aria-label="Close"
          onClick={() => setMobileOpen(false)}
        >
          ×
        </button>
        <nav>
          <strong style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", padding: "16px 0 8px", display: "block" }}>
            Rentals
          </strong>
          <Link href="/properties" onClick={() => setMobileOpen(false)}>
            Browse All Properties
          </Link>
          <Link href="/properties?includeAmenities=HOT_TUB" onClick={() => setMobileOpen(false)}>
            Hot Tub Rentals
          </Link>
          <Link href="/properties?petsAllowed=true" onClick={() => setMobileOpen(false)}>
            Pet Friendly
          </Link>

          <strong style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", padding: "24px 0 8px", display: "block" }}>
            Crested Butte
          </strong>
          <Link href="/crested-butte" onClick={() => setMobileOpen(false)}>
            All Crested Butte Rentals
          </Link>
          <Link href="/crested-butte/grand-lodge" onClick={() => setMobileOpen(false)}>
            Grand Lodge
          </Link>
          <Link href="/crested-butte/lodge-at-mountaineer-square" onClick={() => setMobileOpen(false)}>
            Lodge at Mountaineer Square
          </Link>
          <Link href="/crested-butte/the-plaza" onClick={() => setMobileOpen(false)}>
            The Plaza
          </Link>

          <strong style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", padding: "24px 0 8px", display: "block" }}>
            Leadville
          </strong>
          <Link href="/leadville" onClick={() => setMobileOpen(false)}>
            All Leadville Rentals
          </Link>
          <Link href="/properties?city=Leadville&tags=Grand+West+Village+Resort" onClick={() => setMobileOpen(false)}>
            Grand West Village
          </Link>
          <Link href="/properties?city=Leadville&tags=OSV" onClick={() => setMobileOpen(false)}>
            Old St Vincents
          </Link>
          <Link href="/properties?city=Leadville&tags=cabin" onClick={() => setMobileOpen(false)}>
            Cabin Rentals
          </Link>

          <strong style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)", padding: "24px 0 8px", display: "block" }}>
            More
          </strong>
          <Link href="/crested-butte/guides/where-to-stay" onClick={() => setMobileOpen(false)}>
            Where to Stay Guide
          </Link>
          <Link href="/blog" onClick={() => setMobileOpen(false)}>
            Blog
          </Link>
          <Link href="/property-management" onClick={() => setMobileOpen(false)}>
            For Owners
          </Link>
          <Link href="/contact" onClick={() => setMobileOpen(false)}>
            Contact
          </Link>
          {email ? (
            <Link href="/account/reservations" onClick={() => setMobileOpen(false)}>
              Account
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              Sign in
            </Link>
          )}
        </nav>
        <div style={{ padding: "16px 0", fontSize: "14px" }}>
          <a href="tel:+17207592013" style={{ color: "inherit", textDecoration: "none" }}>
            📞 (720) 759-2013
          </a>
        </div>
        <a
          href="/plan"
          target="_blank"
          rel="noopener"
          className="btn btn-plan mobile-nav-cta"
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
            <path d="M12 3v18M3 8h18M3 16h18" />
            <circle cx="8" cy="8" r={1.4} fill="currentColor" />
            <circle cx="16" cy="16" r={1.4} fill="currentColor" />
          </svg>
          Plan My Trip →
        </a>
      </div>
    </>
  );
}
