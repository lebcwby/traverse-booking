"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { SmsConsent } from "@/components/legal/sms-consent";

/**
 * Revenue-projection capture — deliberately ONE step.
 *
 * It used to open on the building dropdown alone and reveal the contact fields
 * afterwards. A2P 10DLC killed that: carriers review the opt-in URL themselves,
 * and a reviewer landing on a page whose form is a lone dropdown sees no phone
 * field and no consent checkboxes. "Form collects phone numbers without consent
 * language" is a listed rejection reason, and nothing tells them there is a
 * second step behind it.
 *
 * The building is still the first field, and still the qualifying question —
 * the comp we send back is only credible because it comes from the same
 * building. It just no longer hides everything else.
 */
/**
 * The buildings we manage in, plus an escape hatch.
 *
 * The page rests on comping a unit against the ones down its own hallway, so
 * the dropdown doubles as a qualifier. An earlier version of this list held
 * only the three base-area buildings and this note argued against an
 * "elsewhere" option on the grounds that it buys unqualified leads. Nadim
 * asked for "Other" anyway on 2026-11-18, which is a reasonable call — a
 * Mt. Crested Butte owner who finds the page and is turned away at the first
 * field is a lead we never hear about, and an unqualified lead is at least
 * visible. The tradeoff did not go away, it was accepted.
 *
 * ⚠️ Two of these cannot be served the way the other three can:
 *   - "Black Bear" — we manage exactly 2 units there (BB204, a 4BR, and
 *     BB303, a 2BR; Guesty, active + listed, 2026-11-18). A same-building
 *     comp exists for those two sizes and for nothing else.
 *   - "Other" — no in-building comp at all, by definition.
 * Both land in the ops alert's Building row, so whoever writes the projection
 * can see before they start that they are pricing off the wider market. Say
 * which it is in the write-up rather than implying a hallway comp.
 */
export const BUILDINGS = [
  "The Grand Lodge",
  "The Lodge at Mountaineer Square",
  "The Plaza",
  "Black Bear",
  "Other",
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
}: {
  id?: string;
  source?: string;
}) {
  const [building, setBuilding] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!building) {
      setError("Pick your building so we can pull the right comparison.");
      return;
    }
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
            ? "Please tick the box so we know we can email your projection."
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

  return (
    <form className="audit-fields" onSubmit={submit} id={id}>
      <div className="audit-grid">
        <div className="audit-span2">
          <label htmlFor={`${id}-building`}>Your building *</label>
          <select
            id={`${id}-building`}
            className="proj-select"
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
        </div>
        <div className="audit-span2">
          <label htmlFor={`${id}-unitType`}>Unit size *</label>
          <select
            id={`${id}-unitType`}
            name="unitType"
            required
            defaultValue=""
          >
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
            Who manages it today?{" "}
            <span className="proj-optional">Optional</span>
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
