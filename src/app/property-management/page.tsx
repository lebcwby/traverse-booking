"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
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

const LEADS_ENDPOINT = "https://team.traversehospitality.com/api/leads";

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
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEstimateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(LEADS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fd.get("firstname") || "",
          lastName: fd.get("lastname") || "",
          email: fd.get("email") || "",
          phone: fd.get("phone") || "",
          propertyStreetAddress: fd.get("rental_property_address") || "",
          currentlyRent: fd.get("currently_rent") || "",
          propertyPersonalUse: fd.get("property_personal_use") || "",
          expectations: fd.get("expectations") || "",
          source: "booktraverse.com",
        }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();

      if (data.ok) {
        setSuccess(true);
        // GA4: track lead-form completion for owner-acquisition funnel.
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "lead_inquiry_submitted");
        }
      } else {
        const msg =
          data.error === "missing_required"
            ? "Please fill in the required fields."
            : data.error === "invalid_email"
              ? "That email address doesn't look right."
              : "Something went wrong. Please try again.";
        setError(msg);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* data-no-fees-layout on the page root hides the global Header (via no-fees.css)
          and powers the NoFeesHeader styling. We scope ONLY the header inside the
          attribute so the rest of the page keeps Tailwind styling intact.
          NOTE: do not set `contain` here — it isolates the header's stacking context
          and clips the absolutely-positioned nav dropdowns under the next section. */}
      <div data-no-fees-layout="hide-chrome" className="relative z-50">
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
              {success ? (
                <div
                  id="estimate-success"
                  className="rounded-xl border border-green-200 bg-green-50 p-6 text-center"
                >
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
                  <h3 className="text-xl font-semibold text-foreground">
                    Thanks — we&apos;ll be in touch
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your request is in. We&apos;ll reach out within 1–2
                    business days with a free management estimate.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEstimateSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="firstname"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        First name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="firstname"
                        name="firstname"
                        type="text"
                        required
                        autoComplete="given-name"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lastname"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        Last name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="lastname"
                        name="lastname"
                        type="text"
                        required
                        autoComplete="family-name"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        Email <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="rental_property_address"
                      className="mb-1.5 block text-sm font-medium text-foreground"
                    >
                      Property street address
                    </label>
                    <input
                      id="rental_property_address"
                      name="rental_property_address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="123 Main St, Crested Butte, CO"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="currently_rent"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        Do you currently rent this property?
                      </label>
                      <select
                        id="currently_rent"
                        name="currently_rent"
                        defaultValue=""
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Please Select</option>
                        <option value="yes_short_term">Yes — short-term</option>
                        <option value="yes_long_term">Yes — long-term</option>
                        <option value="no">No</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="property_personal_use"
                        className="mb-1.5 block text-sm font-medium text-foreground"
                      >
                        Personal use of the property?
                      </label>
                      <select
                        id="property_personal_use"
                        name="property_personal_use"
                        defaultValue=""
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Please Select</option>
                        <option value="never_rental_only">
                          Never (rental only)
                        </option>
                        <option value="holidays_only">Holidays only</option>
                        <option value="few_weeks_year">
                          A few weeks/year
                        </option>
                        <option value="most_of_year">Most of the year</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="expectations"
                      className="mb-1.5 block text-sm font-medium text-foreground"
                    >
                      Anything else we should know?
                    </label>
                    <textarea
                      id="expectations"
                      name="expectations"
                      rows={4}
                      placeholder="Revenue goals, timeline, questions about Traverse — anything helps."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {error && (
                    <p
                      id="estimate-error"
                      role="alert"
                      className="text-sm text-red-600"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Sending…" : "Send over a free estimate"}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    No commitment. We&apos;ll reach out within 1–2 business
                    days.
                  </p>
                </form>
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
