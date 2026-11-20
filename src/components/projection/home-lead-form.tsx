"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SmsConsent } from "@/components/legal/sms-consent";

/**
 * Owner capture for WHOLE HOMES, sibling of ProjectionLeadForm.
 *
 * It exists because that form cannot serve this audience at all: its first
 * field is a required dropdown of three base-area condo buildings, so a
 * single-family owner in Crested Butte South literally cannot submit it. The
 * qualifying question for a house is the area and the size of the place, not
 * which lobby it shares.
 *
 * It posts to the SAME /api/projection-request route, with `propertyKind:
 * "home"` so the ops alert and the owner acknowledgement stop saying
 * "building". `area` is sent as `building` because that field is what the
 * route requires and what reaches HubSpot — renaming it would mean a HubSpot
 * property migration for no gain, and the alert labels it correctly from
 * propertyKind.
 *
 * The `source` values are cb-home-*, so single-family leads are separable from
 * the cb-pm-* condo leads in the alert's "Submitted from" line.
 */

/**
 * The Gunnison Valley as a homeowner would describe their own address.
 *
 * Unlike the condo form's dropdown, this is NOT a qualifier — we are not
 * claiming a comp in their cul-de-sac, and there is no area here we would turn
 * away. It is here because "where is it" changes the answer enormously (a
 * Mt. Crested Butte ski-in home and a Gunnison house are different businesses)
 * and because picking from a list is faster than typing an address.
 */
const AREAS = [
  "Town of Crested Butte",
  "Mt. Crested Butte",
  "Crested Butte South",
  "Buckhorn Ranch",
  "Skyland",
  "Riverbend",
  "Meridian Lake / Peanut Lake",
  "Almont",
  "Gunnison",
  "Elsewhere in the valley",
] as const;

const HOME_SIZES = [
  "2 bedroom",
  "3 bedroom",
  "4 bedroom",
  "5 bedroom",
  "6+ bedroom",
] as const;

export function HomeLeadForm({
  id = "home-form",
  source = "cb-home-hero",
}: {
  id?: string;
  source?: string;
}) {
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!area) {
      setError("Pick the area so we know which market to price against.");
      return;
    }
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/projection-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building: area,
          unitType: fd.get("unitType") || "",
          propertyKind: "home",
          firstName: fd.get("firstName") || "",
          lastName: fd.get("lastName") || "",
          email: fd.get("email") || "",
          phone: fd.get("phone") || "",
          currentManager: fd.get("currentManager") || "",
          // Implied by submitting a form that asks us to email them.
          consent: true,
          smsNotifications: fd.get("smsNotifications") === "on",
          smsMarketing: fd.get("smsMarketing") === "on",
          company: fd.get("company") || "",
          page: source,
          hutk: document.cookie.match(/(?:^|; )hubspotutk=([^;]*)/)?.[1] ?? "",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (data.ok) {
        setDone(true);
        if (typeof window !== "undefined" && window.gtag) {
          window.gtag("event", "revenue_projection_requested");
        }
        return;
      }
      setError(
        data.error === "invalid_email"
          ? "That email address doesn't look right."
          : data.error === "consent_required"
            ? "Please tick the box so we know we can email you."
            : data.error === "missing_required"
              ? "Please fill in your name and email."
              : data.error === "rate limit exceeded"
                ? "That's a few requests in a row — give it a few minutes and try again."
                : "Something went wrong. Please try again, or call us on (970) 533-3583."
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
        <h3>We&apos;re putting your review together</h3>
        <p>
          Check your inbox for a confirmation. We&apos;ll come back within one
          business day with what a home of your size in your area should be
          earning — and the questions we&apos;d want answered about how yours is
          being looked after.
        </p>
      </div>
    );
  }

  return (
    <form className="audit-fields" onSubmit={submit} id={id}>
      <div className="audit-grid">
        <div className="audit-span2">
          <label htmlFor={`${id}-area`}>Where is the home? *</label>
          <select
            id={`${id}-area`}
            className="proj-select"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">Choose the area…</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="audit-span2">
          <label htmlFor={`${id}-unitType`}>How big is it? *</label>
          <select
            id={`${id}-unitType`}
            name="unitType"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {HOME_SIZES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-firstName`}>First name *</label>
          <input
            id={`${id}-firstName`}
            name="firstName"
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor={`${id}-lastName`}>Last name</label>
          <input
            id={`${id}-lastName`}
            name="lastName"
            autoComplete="family-name"
          />
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
          <label htmlFor={`${id}-currentManager`}>
            Who looks after it today?{" "}
            <span className="proj-optional">Optional</span>
          </label>
          <input
            id={`${id}-currentManager`}
            name="currentManager"
            placeholder="Self-managed / a local company / a caretaker"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Honeypot — hidden from people, catnip for bots. */}
      <div className="audit-hp" aria-hidden="true">
        <label htmlFor={`${id}-company`}>Leave this empty</label>
        <input
          id={`${id}-company`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* See the note in audit-lead-form: a required consent checkbox of any
          kind is an A2P rejection reason, so the email basis is the request
          itself rather than a tick. */}
      <p className="audit-consent-note">
        Submitting this asks us to email you the review. We&apos;ll use your
        details for that and follow up once — no lists, no spam.
      </p>

      <SmsConsent id={id} />

      {error ? (
        <p className="audit-err" role="alert">
          {error}
        </p>
      ) : null}

      <button className="audit-btn audit-btn-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="audit-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          <>
            Show me the numbers
            <ArrowRight className="audit-btn-icon" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
