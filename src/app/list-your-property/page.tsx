"use client";

import { useState } from "react";
import {
  Send,
  Globe,
  DollarSign,
  TrendingUp,
  Search,
  Camera,
  CalendarCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";

const benefits = [
  {
    icon: Globe,
    title: "Direct Booking Channel",
    description:
      "Get your own listing on booktraverse.com — a dedicated Portland vacation rental site where guests book directly, no middleman.",
  },
  {
    icon: DollarSign,
    title: "No OTA Commissions",
    description:
      "Keep more of your revenue. Unlike Airbnb or VRBO, Book Traverse charges lower fees with no guest service fees eating into your bookings.",
  },
  {
    icon: Search,
    title: "SEO & Local Traffic",
    description:
      "Our site ranks for Portland-specific vacation rental searches, bringing you guests who are actively looking to book in your area.",
  },
  {
    icon: Camera,
    title: "Professional Listing",
    description:
      "Your property gets a polished listing page with photo gallery, availability calendar, instant booking, and guest reviews.",
  },
  {
    icon: CalendarCheck,
    title: "You Stay in Control",
    description:
      "You manage your own property, guests, and pricing. We simply provide another high-quality channel to fill your calendar.",
  },
  {
    icon: TrendingUp,
    title: "More Bookings, Less Effort",
    description:
      "Diversify beyond Airbnb and VRBO. Adding a direct booking channel means less dependency on any single platform.",
  },
];

export default function ListYourPropertyPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    propertyAddress: "",
    propertyType: "",
    bedrooms: "",
    currentChannels: "",
    message: "",
    website: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const attribution = getEmailCaptureAttribution(
        "listing_inquiry",
        "list-your-property"
      );
      const res = await fetch("/api/listing-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      identifyUser(form.email.trim().toLowerCase());
      setForm({
        name: "",
        email: "",
        phone: "",
        propertyAddress: "",
        propertyType: "",
        bedrooms: "",
        currentChannels: "",
        message: "",
        website: "",
      });
    } catch {
      setStatus("error");
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          List Your Property on Book Traverse
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Add a direct booking channel to your vacation rental business. Stay
          Portland brings you Portland-focused guests who book directly — no OTA
          commissions, no guest service fees.
        </p>
      </div>

      {/* Benefits grid */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">
              {title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold text-foreground">How It Works</h2>
        <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Apply",
              description:
                "Tell us about your property. We review it to make sure it's a good fit for our guests.",
            },
            {
              step: "2",
              title: "Get Listed",
              description:
                "We create your listing with photos, descriptions, calendar sync, and instant booking.",
            },
            {
              step: "3",
              title: "Get Booked",
              description:
                "Guests discover and book your property directly. You handle the rest — it's your property.",
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {step}
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact form */}
      <div className="mt-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Get Started</h2>
          <p className="mt-2 text-muted-foreground">
            Tell us about your property and we&apos;ll reach out within 24
            hours.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 max-w-2xl space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lp-name"
                className="block text-sm font-medium text-foreground"
              >
                Name *
              </label>
              <input
                id="lp-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="lp-email"
                className="block text-sm font-medium text-foreground"
              >
                Email *
              </label>
              <input
                id="lp-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lp-phone"
                className="block text-sm font-medium text-foreground"
              >
                Phone
              </label>
              <input
                id="lp-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="lp-address"
                className="block text-sm font-medium text-foreground"
              >
                Property Address
              </label>
              <input
                id="lp-address"
                type="text"
                value={form.propertyAddress}
                onChange={(e) =>
                  setForm({ ...form, propertyAddress: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="lp-type"
                className="block text-sm font-medium text-foreground"
              >
                Property Type
              </label>
              <select
                id="lp-type"
                value={form.propertyType}
                onChange={(e) =>
                  setForm({ ...form, propertyType: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="house">House</option>
                <option value="apartment">Apartment / Condo</option>
                <option value="townhouse">Townhouse</option>
                <option value="adu">ADU / Guest House</option>
                <option value="cabin">Cabin</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="lp-bedrooms"
                className="block text-sm font-medium text-foreground"
              >
                Bedrooms
              </label>
              <select
                id="lp-bedrooms"
                value={form.bedrooms}
                onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="studio">Studio</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5+">5+</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="lp-channels"
                className="block text-sm font-medium text-foreground"
              >
                Current Channels
              </label>
              <select
                id="lp-channels"
                value={form.currentChannels}
                onChange={(e) =>
                  setForm({ ...form, currentChannels: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="airbnb">Airbnb only</option>
                <option value="vrbo">VRBO only</option>
                <option value="both">Airbnb + VRBO</option>
                <option value="multiple">Multiple channels</option>
                <option value="none">Not listed yet</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="lp-message"
              className="block text-sm font-medium text-foreground"
            >
              Anything else we should know?
            </label>
            <textarea
              id="lp-message"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Questions, current occupancy, what you're looking for..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Honeypot */}
          <div
            className="absolute opacity-0 -z-10"
            aria-hidden="true"
            tabIndex={-1}
          >
            <label htmlFor="lp-website">Website</label>
            <input
              id="lp-website"
              type="text"
              autoComplete="off"
              tabIndex={-1}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto sm:rounded-lg"
          >
            <Send className="h-4 w-4" />
            {status === "sending" ? "Sending..." : "Submit Inquiry"}
          </button>

          {status === "sent" && (
            <p className="text-sm text-green-600">
              Thank you! We&apos;ll be in touch within 24 hours.
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-600">
              Something went wrong. Please try emailing us at
              hello@booktraverse.com.
            </p>
          )}
        </form>
      </div>

      {/* Management CTA */}
      <div className="mt-20 rounded-xl border border-border bg-muted/50 px-6 py-8 text-center sm:px-10">
        <h2 className="text-xl font-bold text-foreground">
          Looking for Full Property Management?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          If you&apos;d rather have someone handle everything — guest
          communication, cleaning, pricing, maintenance, and more — our
          management company Simply Vacation Rental Management can take care of
          it all.
        </p>
        <a
          href="https://www.simplyvrm.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(72_30%_35%)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[hsl(72_30%_30%)]"
        >
          Learn About Simply Vacation Rental Management
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
