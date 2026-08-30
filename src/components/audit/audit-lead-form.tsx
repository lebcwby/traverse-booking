"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SmsConsent } from "@/components/legal/sms-consent";

/**
 * Two-step listing-audit capture.
 *
 * Step 1 asks only for the listing URL — the lowest-friction possible opening,
 * and the same reason the page repeats a URL box in the hero, mid-page and
 * footer: whichever one an owner uses, they land here with the URL already
 * filled and only contact details left to give.
 */
export function AuditLeadForm({
  id = "audit-form",
  initialUrl = "",
  source = "hero",
  compact = false,
}: {
  id?: string;
  initialUrl?: string;
  source?: string;
  compact?: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(initialUrl ? 2 : 1);
  const [url, setUrl] = useState(initialUrl);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function advance(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Paste your listing link to get started.");
      return;
    }
    setStep(2);
    // Give the newly-revealed fields focus without yanking the page around.
    requestAnimationFrame(() => {
      document.getElementById(`${id}-firstName`)?.focus();
    });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/audit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airbnbUrl: url,
          firstName: fd.get("firstName") || "",
          lastName: fd.get("lastName") || "",
          email: fd.get("email") || "",
          phone: fd.get("phone") || "",
          zipcode: fd.get("zipcode") || "",
          // Implied by submitting a form that asks us to email them.
          consent: true,
          smsNotifications: fd.get("smsNotifications") === "on",
          smsMarketing: fd.get("smsMarketing") === "on",
          company: fd.get("company") || "",
          page: source,
          // HubSpot's visitor token. Set by the tracking script we load
          // site-wide under analytics consent; passing it is what lets
          // HubSpot attach this submission to the pages they viewed first.
          hutk:
            document.cookie.match(/(?:^|; )hubspotutk=([^;]*)/)?.[1] ?? "",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (data.ok) {
        setDone(true);
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "listing_audit_requested");
        }
        return;
      }
      setError(
        data.error === "invalid_listing_url"
          ? "That doesn't look like a listing link. Paste the full URL from Airbnb, Vrbo or Booking.com."
          : data.error === "invalid_email"
            ? "That email address doesn't look right."
            : data.error === "consent_required"
              ? "Please tick the box so we know we can email your audit."
              : data.error === "missing_required"
                ? "Please fill in your name and email."
                : data.error === "rate limit exceeded"
                  ? "That's a few requests in a row — give it a few minutes and try again."
                  : "Something went wrong. Please try again, or call us on (970) 533-3583.",
      );
    } catch {
      setError("Network problem — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="audit-done" role="status" aria-live="polite">
        <CheckCircle2 className="audit-done-icon" aria-hidden="true" />
        <h3>Your audit is being written</h3>
        <p>
          Check your inbox for a confirmation. A member of our Colorado team
          will send your written audit back within one business day.
        </p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <form className="audit-urlform" onSubmit={advance} id={id}>
        <label className="audit-sr" htmlFor={`${id}-url`}>
          Your listing URL
        </label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.airbnb.com/rooms/12345678"
          className="audit-input"
          autoComplete="off"
        />
        <button type="submit" className="audit-btn">
          {compact ? "Get my free audit" : "Get my free audit"}
          <ArrowRight className="audit-btn-icon" aria-hidden="true" />
        </button>
        {error && (
          <p className="audit-err" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form className="audit-fields" onSubmit={submit} id={id}>
      <div className="audit-urlchip">
        <span className="audit-urlchip-label">Auditing</span>
        <span className="audit-urlchip-url">{url}</span>
        <button
          type="button"
          className="audit-urlchip-edit"
          onClick={() => setStep(1)}
        >
          Change
        </button>
      </div>

      <div className="audit-grid">
        <div>
          <label htmlFor={`${id}-firstName`}>First name *</label>
          <input id={`${id}-firstName`} name="firstName" required autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor={`${id}-lastName`}>Last name</label>
          <input id={`${id}-lastName`} name="lastName" autoComplete="family-name" />
        </div>
        <div>
          <label htmlFor={`${id}-email`}>Email *</label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor={`${id}-phone`}>Phone</label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            placeholder="(970) 555-0134"
            autoComplete="tel"
          />
        </div>
        <div className="audit-span2">
          <label htmlFor={`${id}-zipcode`}>Property zip code</label>
          <input
            id={`${id}-zipcode`}
            name="zipcode"
            placeholder="81225"
            autoComplete="postal-code"
          />
        </div>
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div className="audit-hp" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Leave this empty</label>
        <input id={`${id}-company`} name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {/* The email basis is the request itself — they are asking us to send
          them an audit — so this is a statement rather than a required tick.
          A required consent checkbox of any kind is an A2P rejection reason,
          and a carrier reviewing the form will not stop to work out that this
          particular one was about email. */}
      <p className="audit-consent-note">
        Submitting this asks us to email you the audit. We&apos;ll use your
        details for that and follow up once — no lists, no spam.
      </p>

      <SmsConsent id={id} />

      <button type="submit" className="audit-btn audit-btn-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="audit-btn-icon audit-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          <>
            Send my free audit
            <ArrowRight className="audit-btn-icon" aria-hidden="true" />
          </>
        )}
      </button>

      {error && (
        <p className="audit-err" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
