import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Clock,
  CreditCard,
  RefreshCcw,
} from "lucide-react";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { FooterEmailSignup } from "./footer-email-signup";
import { FooterRecentlyViewed } from "./footer-recently-viewed";

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function SocialIcons() {
  return (
    <div className="flex items-center justify-center gap-5">
      <a
        href="https://www.instagram.com/booktraverse"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-foreground/40 transition-colors hover:text-primary-foreground"
        aria-label="Instagram"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      </a>
      <a
        href="https://www.facebook.com/traversehospitality"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-foreground/40 transition-colors hover:text-primary-foreground"
        aria-label="Facebook"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </a>
      <a
        href="https://www.google.com/search?q=traverse+leadville&sca_esv=e43388f8423b2460&hl=en-US&biw=2160&bih=1026&sxsrf=ANbL-n5twI206Ru15GEbTfagr2iKZV2A4w%3A1778094111695&ei=H5D7aaeWKpnCkPIPl8CskAs&ved=0ahUKEwjnoZ7frKWUAxUZIUQIHRcgC7IQ4dUDCBE&uact=5&oq=traverse+leadville&gs_lp=Egxnd3Mtd2l6LXNlcnAiEnRyYXZlcnNlIGxlYWR2aWxsZTIEECMYJzIEECMYJzIGEAAYFhgeMgYQABgWGB4yCxAAGIAEGIoFGIYDMgsQABiABBiKBRiGAzIIEAAYgAQYogQyBRAAGO8FMgUQABjvBUiIFFC2AligE3AEeAGQAQCYAcoBoAG3DqoBBjE0LjMuMbgBA8gBAPgBAZgCFqAC-g7CAgoQABhHGNYEGLADwgIKECMYgAQYigUYJ8ICFxAuGIAEGIoFGJECGMcBGK8BGJgFGJkFwgIKEC4YgAQYigUYQ8ICChAAGIAEGIoFGEPCAgsQABiABBixAxiDAcICDhAuGIAEGLEDGMcBGNEDwgIOEAAYgAQYigUYsQMYgwHCAhAQABiABBiKBRhDGLEDGIMBwgILEAAYgAQYigUYkQLCAhEQLhiABBiKBRiRAhjHARivAcICCxAuGIAEGLEDGIMBwgIIEAAYgAQYsQPCAg0QABiABBgUGIcCGLEDwgIIEC4YgAQYsQPCAg4QLhjHARixAxjRAxiABMICEBAAGIAEGBQYhwIYsQMYgwHCAggQLhixAxiABMICCxAuGIMBGLEDGIAEwgIFEAAYgATCAgUQLhiABMICChAAGIAEGBQYhwLCAhEQLhiABBiKBRiRAhjHARjRA8ICCxAuGMcBGNEDGIAEwgIIEAAYFhgeGAqYAwCIBgGQBgiSBwYxNy40LjGgB9TXAbIHBjEzLjQuMbgH7w7CBwYwLjE4LjTIBzSACAE&sclient=gws-wiz-serp"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-foreground/40 transition-colors hover:text-primary-foreground"
        aria-label="Search Traverse Hospitality on Google"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </a>
    </div>
  );
}

function Copyright() {
  return (
    <div className="text-center text-xs text-primary-foreground/40">
      &copy; {new Date().getFullYear()} Book Traverse. All rights reserved.
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Footer                                                      */
/* ------------------------------------------------------------------ */

function MobileFooter() {
  return (
    <div className="sm:hidden py-6 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
      {/* 1. Logo (centered) */}
      <div className="text-center mb-5 px-6">
        <Image
          src="/book-traverse-wordmark-white.png"
          alt="Book Traverse"
          width={180}
          height={40}
          className="mx-auto h-8 w-auto"
        />
      </div>

      {/* 2. Recently Viewed Carousel (conditional) */}
      <div className="mb-6 px-6">
        <Suspense>
          <FooterRecentlyViewed />
        </Suspense>
      </div>

      {/* 3. Social Proof Strip */}
      <div className="border-y border-primary-foreground/10 py-4 px-6 mb-6 text-center">
        <p className="text-xs">
          <span className="font-semibold text-primary-foreground/95">189+</span>
          <span className="text-primary-foreground/50"> homes · </span>
          <span className="font-semibold text-primary-foreground/95">
            80,000+
          </span>
          <span className="text-primary-foreground/50"> guests hosted · </span>
          <span className="font-semibold text-primary-foreground/95">87%</span>
          <span className="text-primary-foreground/50"> 5&#9733; reviews</span>
        </p>
        <p className="mt-1 text-xs font-medium text-warm">
          Book direct &amp; save 10–15%
        </p>
      </div>

      {/* 4. Email Signup */}
      <div className="mt-8 mb-6 px-6">
        <FooterEmailSignup />
      </div>

      {/* 5. Quick Links (curated 10, 2 columns) */}
      <div className="grid grid-cols-2 gap-x-8 px-6 mb-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/40 mb-2">
            Browse
          </h3>
          <div className="flex flex-col">
            <Link
              href="/properties"
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              All Properties
            </Link>
            <Link
              href={getLandingPagePath("pet-friendly")}
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Pet-Friendly
            </Link>
            <Link
              href={getLandingPagePath("hot-tubs")}
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Hot Tubs
            </Link>
            <Link
              href={getLandingPagePath("family-friendly")}
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Family-Friendly
            </Link>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/40 mb-2">
            Info
          </h3>
          <div className="flex flex-col">
            <Link
              href="/book-direct"
              className="block py-2.5 text-sm font-medium text-primary-foreground/90 transition-colors"
            >
              Book Direct &amp; Save
            </Link>
            <Link
              href="/guide"
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Colorado Travel Guide
            </Link>
            <Link
              href="/contact"
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Contact
            </Link>
            <Link
              href="/reviews"
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Guest Reviews
            </Link>
            <Link
              href="/contact"
              className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
            >
              Trust &amp; Safety
            </Link>
          </div>
        </div>
      </div>

      {/* 5b. Trip Plans (mobile) */}
      <div className="px-6 mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/40 mb-2">
          Trip Plans
        </h3>
        <div className="flex flex-col">
          <Link
            href="/plan"
            className="block py-2.5 text-sm font-medium text-primary-foreground/90 transition-colors"
          >
            Plan Your Colorado Trip
          </Link>
          <Link
            href="/plan"
            className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
          >
            Weekend Getaway Planner
          </Link>
          <Link
            href="/plan"
            className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
          >
            Crested Butte Guide
          </Link>
          <Link
            href="/plan"
            className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
          >
            Leadville Guide
          </Link>
          <Link
            href="/crested-butte/guides/where-to-stay"
            className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
          >
            Where to Stay in CB
          </Link>
          <Link
            href="/blog"
            className="block py-2.5 text-sm text-primary-foreground/70 transition-colors"
          >
            Blog
          </Link>
        </div>
      </div>

      {/* 6. Trust Signals */}
      <div className="flex items-center justify-center gap-4 text-xs text-primary-foreground/50 px-6 mb-6 flex-wrap">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Guest safety
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          24/7 support
        </span>
        <span className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          Secure payment
        </span>
      </div>

      {/* 7. Contact + Legal */}
      <div className="px-6 mb-4">
        {/* Contact row */}
        <div className="flex items-center justify-center gap-4 text-[0.8125rem] text-primary-foreground/50 flex-wrap">
          <TrackedContactLink
            href="mailto:bookings@traversehospitality.com"
            className="flex items-center gap-1.5 transition-colors hover:text-primary-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            bookings@traversehospitality.com
          </TrackedContactLink>
          <TrackedContactLink
            href="tel:+17207592013"
            className="flex items-center gap-1.5 transition-colors hover:text-primary-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            (720) 759-2013
          </TrackedContactLink>
        </div>
        {/* Legal row */}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-primary-foreground/40 flex-wrap">
          <Link
            href="/terms"
            className="transition-colors hover:text-primary-foreground/60"
          >
            Terms
          </Link>
          <span>|</span>
          <Link
            href="/privacy"
            className="transition-colors hover:text-primary-foreground/60"
          >
            Privacy
          </Link>
          <span>|</span>
          <Link
            href="/cancellation"
            className="transition-colors hover:text-primary-foreground/60"
          >
            Cancellation
          </Link>
          <span>|</span>
          <Link
            href="/accessibility"
            className="transition-colors hover:text-primary-foreground/60"
          >
            Accessibility
          </Link>
        </div>
      </div>

      {/* 8. Social Icons + Copyright */}
      <div className="mx-6 border-t border-primary-foreground/10 pt-4 mt-4">
        <SocialIcons />
        <div className="mt-4">
          <Copyright />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop Footer                                                     */
/* ------------------------------------------------------------------ */

function DesktopFooter() {
  return (
    <div className="hidden sm:block">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        {/* Logo + social proof (replaces tagline) */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/book-traverse-wordmark-white.png"
            alt="Book Traverse"
            width={180}
            height={40}
            className="h-8 w-auto"
          />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/60">
            <span className="font-semibold text-primary-foreground/95">
              189+
            </span>{" "}
            homes ·{" "}
            <span className="font-semibold text-primary-foreground/95">
              80,000+
            </span>{" "}
            guests hosted ·{" "}
            <span className="font-semibold text-primary-foreground/95">
              87%
            </span>{" "}
            5&#9733; reviews
          </p>
          <p className="mt-1 text-sm text-warm font-medium">
            Book direct &amp; save 10–15%
          </p>
        </div>

        {/* Email signup */}
        <div className="mt-8">
          <FooterEmailSignup />
        </div>

        {/* Explore — organized by category for SEO internal linking */}
        <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">
              By Market
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/crested-butte"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Crested Butte
              </Link>
              <Link
                href="/leadville"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Leadville
              </Link>
              <Link
                href="/properties?city=Vail"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Vail
              </Link>
              <Link
                href="/properties?city=Avon"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Avon
              </Link>
              <Link
                href="/properties?city=Granby"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Granby
              </Link>
              <Link
                href="/properties?city=Twin+Lakes"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Twin Lakes
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">
              By Type
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/properties"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                All Properties
              </Link>
              <Link
                href={getLandingPagePath("pet-friendly")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Pet-Friendly
              </Link>
              <Link
                href={getLandingPagePath("large-groups")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Large Groups
              </Link>
              <Link
                href={getLandingPagePath("family-friendly")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Family-Friendly
              </Link>
              <Link
                href={getLandingPagePath("hot-tubs")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Hot Tubs
              </Link>
              <Link
                href={getLandingPagePath("fireplace")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Fireplaces
              </Link>
              <Link
                href={getLandingPagePath("extended-stay")}
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Extended Stay
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">
              Buildings &amp; Categories
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/crested-butte/grand-lodge"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Grand Lodge Crested Butte
              </Link>
              <Link
                href="/crested-butte/the-plaza"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                The Plaza Condominiums
              </Link>
              <Link
                href="/crested-butte/lodge-at-mountaineer-square"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Lodge at Mountaineer Square
              </Link>
              <Link
                href="/properties?tag=Grand+West+Village+Resort"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Grand West Village
              </Link>
              <Link
                href="/properties?tag=OSV"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Old St Vincent&apos;s
              </Link>
              <Link
                href="/properties?tag=cabin"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Cabin Rentals
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/40">
              Guides &amp; More
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href="/book-direct"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground font-medium"
              >
                Book Direct &amp; Save
              </Link>
              <Link
                href="/crested-butte/guides/where-to-stay"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Where to Stay in Crested Butte
              </Link>
              <Link
                href="/reviews"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Guest Reviews
              </Link>
              <Link
                href="/blog"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Blog
              </Link>
              <Link
                href="/contact"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Trust &amp; Safety
              </Link>
            </div>
          </div>
        </div>

        {/* Trust Signal bar */}
        <div className="flex items-center justify-center gap-8 text-sm text-primary-foreground/50 mt-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Guest Safety Guarantee
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            24/7 Local Support
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4" />
            Secure Payment
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCcw className="h-4 w-4" />
            Flexible Cancellation
          </span>
        </div>

        {/* Utility links */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm">
          <Link
            href="/contact"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Contact
          </Link>
          <Link
            href="/terms"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Privacy
          </Link>
          <Link
            href="/cancellation"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Cancellation
          </Link>
          <Link
            href="/accessibility"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Accessibility
          </Link>
          <Link
            href="/do-not-sell"
            className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Privacy Choices
          </Link>
        </div>

        {/* Contact + social row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-primary-foreground/50">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Leadville & Crested Butte, CO
          </span>
          <TrackedContactLink
            href="mailto:bookings@traversehospitality.com"
            className="flex items-center gap-1.5 transition-colors hover:text-primary-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            bookings@traversehospitality.com
          </TrackedContactLink>
          <TrackedContactLink
            href="tel:+17207592013"
            className="flex items-center gap-1.5 transition-colors hover:text-primary-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
            (720) 759-2013
          </TrackedContactLink>
        </div>

        {/* Social + GBP links */}
        <div className="mt-4">
          <SocialIcons />
        </div>

        {/* Bottom */}
        <div className="mt-8 border-t border-primary-foreground/10 pt-6">
          <Copyright />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported Footer                                                    */
/* ------------------------------------------------------------------ */

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      {/* Mobile */}
      <MobileFooter />
      {/* Desktop */}
      <DesktopFooter />
    </footer>
  );
}
