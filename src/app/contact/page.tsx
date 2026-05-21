"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, Send, Home } from "lucide-react";
import Link from "next/link";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";
import { trackContactSubmit, identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    website: "",
    marketingOptIn: false,
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const attribution = getEmailCaptureAttribution("contact_form", "contact");
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attribution }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      trackContactSubmit(form.subject);
      identifyUser(form.email.trim().toLowerCase());
      setForm({
        name: "",
        email: "",
        subject: "",
        message: "",
        website: "",
        marketingOptIn: false,
      });
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Contact Us
      </h1>
      <p className="mt-3 text-muted-foreground">
        Have a question about a property or need help with your booking?
        We&apos;d love to hear from you.
      </p>

      {/* Instant help note */}
      <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-foreground">
          <span className="font-medium">Need help right now?</span> Call{" "}
          <a
            href="tel:+17207592013"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            (720) 759-2013
          </a>{" "}
          or email{" "}
          <a
            href="mailto:bookings@traversehospitality.com"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
          >
            bookings@traversehospitality.com
          </a>{" "}
          for the fastest response.
        </p>
      </div>

      {/* Property owner CTA */}
      <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <Home className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm text-foreground">
              <span className="font-medium">
                Own a vacation rental in Colorado?
              </span>{" "}
              List your property with Traverse Hospitality — full-service
              management across Crested Butte, Leadville, Vail, and more.
            </p>
            <Link
              href="/property-management"
              className="mt-3 mx-auto block w-1/2 rounded-full bg-accent px-6 py-2 text-center text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-12 md:grid-cols-5">
        {/* Contact info */}
        <div className="space-y-6 md:col-span-2">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <TrackedContactLink
                href="mailto:bookings@traversehospitality.com"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                bookings@traversehospitality.com
              </TrackedContactLink>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Phone</p>
              <TrackedContactLink
                href="tel:+17207592013"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                (720) 759-2013
              </TrackedContactLink>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Location</p>
              <p className="text-sm text-muted-foreground">
                Leadville &amp; Crested Butte, Colorado
              </p>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <form onSubmit={handleSubmit} className="space-y-5 md:col-span-3">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-foreground"
            >
              Subject
            </label>
            <input
              id="subject"
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-foreground"
            >
              Message
            </label>
            <textarea
              id="message"
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1 w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Honeypot — hidden from real users, bots fill it in */}
          <div
            className="absolute opacity-0 -z-10"
            aria-hidden="true"
            tabIndex={-1}
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              autoComplete="off"
              tabIndex={-1}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(e) =>
                setForm({ ...form, marketingOptIn: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">
              Also send me Colorado travel deals and tips
            </span>
          </label>

          <button
            type="submit"
            disabled={status === "sending"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>

          {status === "sent" && (
            <p className="text-sm text-green-600">
              Thank you! We&apos;ll get back to you soon.
            </p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-600">
              Something went wrong. Please try emailing us directly.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
