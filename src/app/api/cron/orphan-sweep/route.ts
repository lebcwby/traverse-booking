// Orphan-charge sweep — the safety net for "guest paid but has no reservation".
//
// Background: a Stripe charge can succeed without a usable `pending_checkouts`
// row (never written, or cleaned up), so the webhook can't finalize and the
// recover-checkouts cron (which reads pending rows) never sees it. The guest is
// left with a charge and no booking — e.g. Kyle Toth $575.90 (2026-06-17) and
// the GY-CvXxRDxw orphan twin. This cron is Stripe-sourced, so it catches those.
//
// For each true booking orphan (succeeded PI with stay metadata, no
// confirmationCode, no reservation row, old enough to not be mid-finalize, not
// already refunded/disputed):
//   1. RECOVER — re-quote the same listing+dates and finalize the reservation on
//      the charge they already paid. (At payment time the unit is still open, so
//      this resolves almost all orphans into real bookings — Kyle included.)
//   2. AUTO-REFUND — if the re-quote comes back DATES_UNAVAILABLE, the stay can't
//      be honored, so refund the charge (idempotent) and alert ops to apologize.
//   3. Otherwise alert for manual review (never refund on an ambiguous error).
//
// Money-moving, so it's tightly gated: only acts on orphans >1h old, re-checks
// the reservations table right before acting, skips disputed/already-refunded
// charges, and auto-refund can be killed with ORPHAN_AUTO_REFUND=false.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeServer, buildStripeIdempotencyKey } from "@/lib/stripe";
import { getPool } from "@/lib/db";
import {
  finalizeReservation,
  ReservationPendingRecoveryError,
} from "@/lib/checkout-finalizer";
import { createQuote, getQuote } from "@/lib/guesty-beapi";
import { classifyBeapiError } from "@/lib/beapi-error";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const OPS_INBOX = "admin@traversehospitality.com";
// Only act on orphans older than this so an in-flight finalize (which creates
// the reservation a few seconds after the charge) is never mistaken for one.
const MIN_AGE_MS = 60 * 60 * 1000; // 1h
const SINCE_DAYS = 30;
const MAX_PER_RUN = 10;
// Kill switch — auto-refund is ON unless explicitly disabled.
const AUTO_REFUND_ENABLED = process.env.ORPHAN_AUTO_REFUND !== "false";

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function splitName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripeServer();
  const pool = getPool();
  const nowSec = Math.floor(Date.now() / 1000);
  const createdGte = nowSec - SINCE_DAYS * 86400;
  const tooRecentSec = nowSec - Math.floor(MIN_AGE_MS / 1000);
  const todayISO = new Date(nowSec * 1000).toISOString().slice(0, 10);

  // 1) Succeeded booking PIs (have stay metadata), old enough, not yet
  //    finalized (no confirmationCode), not refunded/disputed.
  type Cand = {
    pi: Stripe.PaymentIntent;
    charge: Stripe.Charge | null;
    listingId: string;
    checkIn: string;
    checkOut: string;
  };
  const candidates: Cand[] = [];
  let scanned = 0;
  for await (const pi of stripe.paymentIntents.list({
    created: { gte: createdGte },
    limit: 100,
    expand: ["data.latest_charge"],
  })) {
    if (++scanned > 2000) break;
    if (pi.status !== "succeeded") continue;
    if (pi.created > tooRecentSec) continue;
    if (pi.metadata?.confirmationCode) continue;
    const listingId = pi.metadata?.listingId;
    const checkIn = pi.metadata?.checkIn;
    const checkOut = pi.metadata?.checkOut;
    if (!listingId || !checkIn || !checkOut) continue; // not a booking charge
    // Only act on UPCOMING stays. A stay that has already ended can't be
    // recovered (can't re-quote past dates → INVALID_DATES) and may already be
    // resolved another way (chargeback/manual) — so skip it rather than
    // re-alerting forever (e.g. the McClintock chargeback, Jun 2-4).
    if (checkOut < todayISO) continue;
    const charge =
      pi.latest_charge && typeof pi.latest_charge !== "string"
        ? pi.latest_charge
        : null;
    if (charge) {
      const refunded =
        charge.refunded ||
        (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
      if (refunded || charge.disputed) continue; // resolved or charged-back
    }
    candidates.push({ pi, charge, listingId, checkIn, checkOut });
    if (candidates.length >= 50) break;
  }

  // 2) Keep only those with NO reservation row.
  let orphans = candidates;
  if (candidates.length) {
    const res = await pool.query(
      `SELECT stripe_payment_intent_id FROM reservations
        WHERE stripe_payment_intent_id = ANY($1)`,
      [candidates.map((c) => c.pi.id)]
    );
    const have = new Set(
      res.rows.map((r) => r.stripe_payment_intent_id as string)
    );
    orphans = candidates.filter((c) => !have.has(c.pi.id));
  }

  const outcomes: Array<Record<string, unknown>> = [];

  for (const o of orphans.slice(0, MAX_PER_RUN)) {
    const { pi, charge, listingId, checkIn, checkOut } = o;
    const amount = (pi.amount ?? 0) / 100;
    const email =
      pi.metadata?.guestEmail || charge?.billing_details?.email || "";
    const phone =
      pi.metadata?.guestPhone || charge?.billing_details?.phone || "";
    const { firstName, lastName } = splitName(charge?.billing_details?.name);

    // Re-check right before acting — a finalize may have landed since the scan.
    const exists = await pool.query(
      `SELECT 1 FROM reservations WHERE stripe_payment_intent_id = $1 LIMIT 1`,
      [pi.id]
    );
    if (exists.rows.length) {
      outcomes.push({ pi: pi.id, action: "skipped-now-has-reservation" });
      continue;
    }

    // --- RECOVERY: re-quote and finalize on the already-paid charge ---
    let guestsCount = 2;
    try {
      const orig = (await getQuote(pi.metadata!.quoteId)) as {
        guestsCount?: number;
      };
      if (typeof orig?.guestsCount === "number" && orig.guestsCount > 0) {
        guestsCount = orig.guestsCount;
      }
    } catch {
      /* original quote expired/unreadable — fall back to 2 guests */
    }

    let freshQuoteId: string | null = null;
    let datesUnavailable = false;
    try {
      const q = (await createQuote({
        listingId,
        checkIn,
        checkOut,
        guestsCount,
      })) as { _id?: string };
      freshQuoteId = q?._id ?? null;
    } catch (err) {
      const classified = classifyBeapiError(err);
      if (classified.code === "DATES_UNAVAILABLE") {
        datesUnavailable = true;
      } else {
        await sendAlert(
          "ORPHAN — NEEDS MANUAL REVIEW",
          `Paid charge with no reservation, and re-quote failed (not an availability error — don't auto-refund).<br>PI <code>${pi.id}</code> $${amount.toFixed(2)} ${email} ${checkIn}→${checkOut}.<br>${classified.message}`,
          `orphan-review-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({ pi: pi.id, action: "manual-review", code: classified.code });
        continue;
      }
    }

    if (freshQuoteId && email && firstName) {
      try {
        await finalizeReservation({
          paymentIntentId: pi.id,
          quoteId: freshQuoteId,
          guest: { firstName, lastName, email, phone },
          pets: Number(pi.metadata?.pets) || 0,
          upsells: (pi.metadata?.upsellIds || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        await sendAlert(
          "ORPHAN AUTO-RECOVERED",
          `A paid charge with no reservation was recovered into a booking.<br>PI <code>${pi.id}</code> $${amount.toFixed(2)} — ${email} — listing ${listingId}, ${checkIn}→${checkOut}.`,
          `orphan-recovered-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({ pi: pi.id, action: "recovered" });
        continue;
      } catch (err) {
        if (err instanceof ReservationPendingRecoveryError) {
          // Reservation was created; payment recording is racing Guesty's
          // indexing. Next run will see the row and skip. Not a failure.
          outcomes.push({ pi: pi.id, action: "recovered-pending" });
          continue;
        }
        await sendAlert(
          "ORPHAN — RECOVERY FAILED",
          `Re-quote succeeded but finalize threw for PI <code>${pi.id}</code> $${amount.toFixed(2)} ${email}. Not auto-refunded — review.<br>${err instanceof Error ? err.message : String(err)}`,
          `orphan-recovery-failed-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({ pi: pi.id, action: "recovery-failed" });
        continue;
      }
    }

    // --- AUTO-REFUND: stay can't be honored (dates gone) ---
    if (datesUnavailable) {
      if (!AUTO_REFUND_ENABLED) {
        await sendAlert(
          "ORPHAN — REFUND NEEDED (auto-refund disabled)",
          `Paid charge with no reservation and dates now unavailable. Auto-refund is OFF — refund manually.<br>PI <code>${pi.id}</code> $${amount.toFixed(2)} ${email} ${checkIn}→${checkOut}.`,
          `orphan-refund-needed-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({ pi: pi.id, action: "refund-needed-manual" });
        continue;
      }
      try {
        // Idempotent: never double-refund.
        const existing = await stripe.refunds.list({
          payment_intent: pi.id,
          limit: 1,
        });
        if (existing.data.length) {
          outcomes.push({ pi: pi.id, action: "already-refunded" });
          continue;
        }
        const refund = await stripe.refunds.create(
          {
            payment_intent: pi.id,
            reason: "requested_by_customer",
            metadata: { orphan: "true", reason: "stay_unavailable" },
          },
          {
            idempotencyKey: buildStripeIdempotencyKey("orphan_refund", {
              pi: pi.id,
            }),
          }
        );
        await sendAlert(
          "ORPHAN AUTO-REFUNDED",
          `A paid charge had no reservation and the dates are no longer available, so it was auto-refunded.<br>PI <code>${pi.id}</code> — refunded <b>$${(refund.amount / 100).toFixed(2)}</b> to ${email}.<br>Listing ${listingId}, ${checkIn}→${checkOut}. Please send the guest an apology.`,
          `orphan-refunded-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({
          pi: pi.id,
          action: "auto-refunded",
          amount: refund.amount / 100,
        });
      } catch (err) {
        await sendAlert(
          "ORPHAN — AUTO-REFUND FAILED",
          `Tried to auto-refund an unrecoverable orphan but the refund failed — refund manually.<br>PI <code>${pi.id}</code> $${amount.toFixed(2)} ${email}.<br>${err instanceof Error ? err.message : String(err)}`,
          `orphan-refund-failed-${pi.id}`,
          { to: OPS_INBOX }
        ).catch(() => {});
        outcomes.push({ pi: pi.id, action: "refund-failed" });
      }
      continue;
    }

    // Dates available but we couldn't recover (missing guest email/name) — manual.
    await sendAlert(
      "ORPHAN — NEEDS MANUAL REVIEW",
      `Paid charge with no reservation; couldn't auto-recover (missing guest details) and the dates are still available — create the booking manually.<br>PI <code>${pi.id}</code> $${amount.toFixed(2)} ${email || "(no email)"} ${checkIn}→${checkOut}.`,
      `orphan-review-${pi.id}`,
      { to: OPS_INBOX }
    ).catch(() => {});
    outcomes.push({ pi: pi.id, action: "manual-review-missing-details" });
  }

  return NextResponse.json({
    scanned,
    orphansFound: orphans.length,
    processed: outcomes.length,
    autoRefundEnabled: AUTO_REFUND_ENABLED,
    outcomes,
  });
}
