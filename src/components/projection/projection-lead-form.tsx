"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

/**
 * Revenue-projection capture (projection.booktraverse.com).
 *
 * Two steps, and step one is a single dropdown on purpose. The audit page opens
 * by asking for a listing URL; this audience has none — a unit inside a resort
 * rental program isn't listed anywhere they can link to, which is the entire
 * premise of the page. So the opening ask is the building, which is one click,
 * costs nothing, and is also the qualifying question: the comp we send back is
 * only credible because it comes from the same building.
 */

/** Base-area buildings we can comp directly, then everything else. */
export const BUILDINGS = [
  "The Grand Lodge",
  "The Lodge at Mountaineer Square",
  "The Plaza",
  "Elevation Hotel & Spa",
  "WestWall Lodge",
  "Another building at the base",
  "Elsewhere in Crested Butte",
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
          consent: fd.get("consent") === "on",
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

      <label className="audit-consent">
        <input type="checkbox" name="consent" required />
        <span>
          Email me my projection. We&apos;ll only use your details to send it
          and follow up once — no lists, no spam.
        </span>
      </label>

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
