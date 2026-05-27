"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import {
  TrendingUp,
  HandCoins,
  Users,
  Star,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { GoogleReviewsCarousel } from "@/components/google-reviews-carousel";
import { PORTFOLIO_STATS } from "@/lib/portfolio-stats";
import "../no-fees/no-fees.css";

const B2B_PHONE = { tel: "+19705333583", display: "(970) 533-3583" };

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (config: {
          portalId: string;
          formId: string;
          region: string;
          target?: string;
        }) => void;
      };
    };
  }
}

const FORM_TARGET_ID = "hubspot-property-management-form";

// Outcome-grouped benefits — three reasons owners choose Traverse
const outcomes = [
  {
    icon: TrendingUp,
    eyebrow: "Earn more",
    title: "Higher revenue per night, more nights booked",
    points: [
      "Daily price optimization — our team prices your property to maximize ADR at the highest sustainable occupancy",
      "Distribution across 50+ channels — Airbnb, VRBO, Booking.com, Expedia, Google, plus our own direct-booking site",
      "Professional photography that makes your home stand out — selling or renting",
    ],
  },
  {
    icon: HandCoins,
    eyebrow: "Do less",
    title: "We handle the operations — you collect the deposits",
    points: [
      "Bookings, guest communication, and payment collection — fully managed",
      "Local cleaning, repair, and restock crews on call 24/7",
      "Monthly statements and direct deposits, no chasing",
    ],
  },
  {
    icon: Users,
    eyebrow: "Trust local",
    title: "A team that lives where your property is",
    points: [
      "Boots-on-the-ground in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes",
      "Real-estate expertise — comprehensive market analyses, valuations, and acquisition support",
      "24/7 owner and guest support from people who know the mountain",
    ],
  },
];

// Reviews are now sourced from src/lib/google-reviews.ts and rendered via
// <GoogleReviewsCarousel /> below — single source of truth shared with the
// home page. Refresh quarterly.

const markets = [
  {
    name: "Crested Butte",
    count: PORTFOLIO_STATS.perMarket.crestedButte,
    href: "/crested-butte",
    image: "/markets/crested-butte.jpg",
  },
  {
    name: "Leadville",
    count: PORTFOLIO_STATS.perMarket.leadville,
    href: "/leadville",
    image: "/markets/leadville.jpg",
  },
  {
    name: "Vail",
    count: PORTFOLIO_STATS.perMarket.vail,
    href: "/vail",
    image: "/property-management/markets/vail.jpg",
  },
  {
    name: "Avon",
    count: PORTFOLIO_STATS.perMarket.avon,
    href: "/avon",
    image: "/markets/avon.jpg",
  },
  {
    name: "Granby",
    count: PORTFOLIO_STATS.perMarket.granby,
    href: "/granby",
    image: "/property-management/markets/granby.jpg",
  },
  {
    name: "Twin Lakes",
    count: PORTFOLIO_STATS.perMarket.twinLakes,
    href: "/twin-lakes",
    image: "/property-management/markets/twin-lakes.jpg",
  },
];

const faqs = [
  {
    q: "What is your management commission?",
    a: "We charge a competitive management commission — meaningfully lower than national operators because we own the technology stack and run lean local operations. You'll get a specific quote tailored to your property when you submit the form below.",
  },
  {
    q: "How long is the contract, and how do I exit?",
    a: "One-year initial term with an easy exit clause. We're confident in our service and don't lock owners in. The contract spells out a clear, no-friction off-boarding process if it's ever not the right fit.",
  },
  {
    q: "Can I still use my own property?",
    a: "Always. You have full access to your calendar and can block off any dates you'd like — for personal stays, family, friends, or maintenance — at no charge. It's your home; you decide when guests are there.",
  },
  {
    q: "Who handles guest communication, cleaning, and repairs?",
    a: "We do, end-to-end. Guest messaging, check-in support, cleaning between stays, restocks, and repair coordination are all run by our local Colorado teams 24/7.",
  },
  {
    q: "What about pricing and revenue management?",
    a: "Our team optimizes nightly rates daily based on demand, comparable listings, local events, and seasonality — targeting maximum ADR at high occupancy. You can review the strategy with us anytime.",
  },
  {
    q: "Do you also help with buying or selling?",
    a: "Yes. We have in-house real estate expertise across the Colorado mountain markets — comprehensive market analyses, property valuations, acquisition support for new short-term rental investments, and listing services if you're ready to sell.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-foreground">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="pb-5 pr-9 text-sm leading-relaxed text-muted-foreground">
          {a}
        </p>
      )}
    </div>
  );
}

export default function PropertyManagementPage() {
  const formCreatedRef = useRef(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded) return;
    if (formCreatedRef.current) return;
    if (!window.hbspt) return;

    formCreatedRef.current = true;
    window.hbspt.forms.create({
      portalId: "7792991",
      formId: "49d127fb-581a-4606-9669-145f15e64a0f",
      region: "na2",
      target: `#${FORM_TARGET_ID}`,
    });
  }, [scriptLoaded]);

  return (
    <>
      <Script
        src="https://js-na2.hsforms.net/forms/embed/v2.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {/* data-no-fees-layout on the page root hides the global Header (via no-fees.css)
          and powers the NoFeesHeader styling. We scope ONLY the header inside the
          attribute so the rest of the page keeps Tailwind styling intact.
          NOTE: do not set `contain` here — it isolates the header's stacking context
          and clips the absolutely-positioned nav dropdowns under the next section. */}
      <div data-no-fees-layout={true} className="relative z-50">
        <NoFeesHeader phoneOverride={B2B_PHONE} />
      </div>
      <div className="bg-background">
        {/* Hero — full-bleed image with overlay */}
        <section className="relative min-h-[600px] overflow-hidden sm:min-h-[680px]">
          <Image
            src="/property-management/hero-porch-view.png"
            alt="Mountain porch view from a Traverse Hospitality property in Colorado"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />

          <div className="relative mx-auto flex min-h-[600px] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center text-white sm:min-h-[680px] sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
              Colorado Property Management
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-[#3b82f6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl">
              Find out how much your property
              <br className="hidden sm:block" />
              can earn you
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/90 drop-shadow sm:text-xl">
              Higher earnings, hassle-free operations, and 24/7 local care
              across Colorado&apos;s premier mountain markets.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="#estimate"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-foreground shadow-lg transition-transform hover:scale-[1.02]"
              >
                Get my free estimate
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="tel:+19705333583"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <Phone className="h-4 w-4" />
                Talk to an advisor
              </a>
            </div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-y-4 px-6 py-6 text-center sm:grid-cols-4 sm:gap-y-0 sm:px-8 sm:py-5">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {PORTFOLIO_STATS.totalListings}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                Active listings
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {PORTFOLIO_STATS.markets}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                Colorado markets
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground">
                {PORTFOLIO_STATS.googleRating}
                <Star className="h-5 w-5 fill-yellow-400 stroke-yellow-400" />
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                Google reviews
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {PORTFOLIO_STATS.channels}+
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                Distribution channels
              </div>
            </div>
          </div>
        </section>

        {/* Outcomes — three reasons */}
        <section className="px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Three reasons owners choose Traverse
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                We&apos;re the only Colorado management company that pairs deep
                local operations with a modern technology stack — so you earn
                more, do less, and stay in control.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {outcomes.map(({ icon: Icon, eyebrow, title, points }) => (
                <div
                  key={eyebrow}
                  className="rounded-2xl border border-border bg-card p-7"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-primary">
                    {eyebrow}
                  </p>
                  <h3 className="mt-2 text-xl font-bold leading-snug text-foreground">
                    {title}
                  </h3>
                  <ul className="mt-5 space-y-3">
                    {points.map((p) => (
                      <li
                        key={p}
                        className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof — Google reviews carousel (shared with home page;
            curated reviews live in src/lib/google-reviews.ts and refresh
            quarterly). */}
        <GoogleReviewsCarousel
          background="muted"
          heading="Owners trust Traverse with their homes"
          subhead="4.8 average rating from guests and owners across our Google profiles."
        />

        {/* How it works */}
        <section className="px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                How onboarding works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                From first call to first booking — usually in under 3 weeks.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-4">
              {[
                {
                  n: "1",
                  title: "Free estimate",
                  body: "Submit the form and we&apos;ll send you a personalized earnings projection within 24 hours.",
                },
                {
                  n: "2",
                  title: "Onboarding call",
                  body: "We walk through the agreement, contract terms, and any questions about your property.",
                },
                {
                  n: "3",
                  title: "Listing setup",
                  body: "Professional photography, listing copy, and channel distribution across 50+ booking sites.",
                },
                {
                  n: "4",
                  title: "Get booked",
                  body: "Daily pricing optimization kicks in, guests start booking, and you receive monthly direct deposits.",
                },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                    {s.n}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {s.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: s.body }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Markets we serve */}
        <section className="bg-[hsl(215_25%_95%)] px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built for the Colorado mountains
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Local operations, local crews, local knowledge — across six
                premier markets.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {markets.map((m) => (
                <a
                  key={m.name}
                  href={m.href}
                  className="group relative block overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={m.image}
                      alt={`${m.name}, Colorado`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="flex items-center gap-2 text-lg font-bold">
                        <MapPin className="h-4 w-4" />
                        {m.name}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-sm text-white/90">{m.count}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Owner questions, answered
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Most owners ask the same things. Here are the straight answers.
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card px-6 sm:px-8">
              {faqs.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        {/* HubSpot form */}
        <section
          id="estimate"
          className="bg-gradient-to-br from-primary/5 via-background to-primary/10 px-6 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Get your free earnings estimate
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Tell us about your property and we&apos;ll send a personalized
                projection within 24 hours. No commitments, no pressure.
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
              <div id={FORM_TARGET_ID} />
              {!scriptLoaded && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Loading form...
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <a
                href="mailto:bookings@traversehospitality.com"
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Mail className="h-4 w-4" />
                bookings@traversehospitality.com
              </a>
              <a
                href="tel:+19705333583"
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                (970) 533-3583
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                115 W 6th St. Suite 100, Leadville, CO 80461
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky mobile CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-card/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:hidden">
        <a
          href="tel:+19705333583"
          className="flex flex-1 items-center justify-center gap-2 px-3 py-4 text-sm font-semibold text-foreground"
        >
          <Phone className="h-4 w-4" />
          Call us
        </a>
        <a
          href="#estimate"
          className="flex flex-[1.5] items-center justify-center gap-2 bg-primary px-3 py-4 text-sm font-semibold text-primary-foreground"
        >
          Free estimate
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </>
  );
}
