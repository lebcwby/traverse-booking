"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SmsConsent } from "@/components/legal/sms-consent";

/**
 * Revenue-projection capture (projection.booktraverse.com).
 *
 * Two steps, and step one is a single dropdown on purpose. The audit page opens
 * by asking for a listing URL, which is wrong here: a unit in a resort program
 * is usually listed under the manager's or a distribution partner's account, so
 * the owner has no link of their own to paste. Asking the building instead is
 * one click, costs nothing, and is the qualifying question — the comp we send
 * back is only credible because it comes from the same building.
 */

/**
 * Only the three buildings we actually manage in. The whole page rests on
 * comping a unit against the ones down its own hallway, so a building we have
 * no units in has nothing credible to offer — and the dropdown doubles as the
 * qualifier. Adding an "elsewhere" option would buy unqualified leads at the
 * cost of the one claim that makes this page work.
 */
export const BUILDINGS = [
  "The Grand Lodge",
  "The Lodge at Mountaineer Square",
  "The Plaza",
] as const;

const UNIT_TYPES = [
  "Studio",
  "1 bedroom",
  "2 bedroom",
  "3 bedroom",
  "4+ bedroom",
] as const;

export function ProjectionLeadForm({
  id = "projection-form",
  source = "hero",
  compact = false,
}: {
  id?: string;
  source?: string;
  compact?: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [building, setBuilding] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function advance(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!building) {
      setError("Pick your building so we can pull the right comparison.");
      return;
    }
    setStep(2);
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
      const res = await fetch("/api/projection-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building,
          unitType: fd.get("unitType") || "",
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
          // Same HubSpot visitor token the audit form passes — it's what ties
          // the submission to the pages this owner viewed first.
          hutk:
            document.cookie.match(/(?:^|; )hubspotutk=([^;]*)/)?.[1] ?? "",
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
            ? "Please tick the box so we know we can email your projection."
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
        <h3>We&apos;re pulling your numbers</h3>
        <p>
          Check your inbox for a confirmation. We&apos;ll come back within one
          business day with what comparable units in your building actually
          earned over the last twelve months — real figures, with the workings
          shown.
        </p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <form className="audit-urlform proj-pickform" onSubmit={advance} id={id}>
        <label className="audit-sr" htmlFor={`${id}-building`}>
          Your building
        </label>
        <select
          id={`${id}-building`}
          className="audit-input proj-select"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
        >
          <option value="">Choose your building…</option>
          {BUILDINGS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <button type="submit" className="audit-btn">
          {compact ? "See the numbers" : "Show me the numbers"}
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
        <span className="audit-urlchip-label">Comparing against</span>
        <span className="audit-urlchip-url">{building}</span>
        <button
          type="button"
          className="audit-urlchip-edit"
          onClick={() => setStep(1)}
        >
          Change
        </button>
      </div>

      <div className="audit-grid">
        <div className="audit-span2">
          <label htmlFor={`${id}-unitType`}>Unit size *</label>
          <select id={`${id}-unitType`} name="unitType" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {UNIT_TYPES.map((u) => (
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
            Who manages it today? <span className="proj-optional">Optional</span>
          </label>
          <input
            id={`${id}-currentManager`}
            name="currentManager"
            placeholder="CBMR / self-managed / another company"
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
        Submitting this asks us to email you the projection. We&apos;ll use your
        details for that and follow up once — no lists, no spam.
      </p>

      <SmsConsent id={id} />

      <button
        type="submit"
        className="audit-btn audit-btn-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="audit-btn-icon audit-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          <>
            Send my projection
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
