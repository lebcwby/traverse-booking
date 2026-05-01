import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { cancelOpenAPIReservation, recordRefund } from "@/lib/guesty-openapi";
import { buildStripeIdempotencyKey, getStripeServer } from "@/lib/stripe";
import { sendAlert, sendGuestyRefundRecordFailedAlert } from "@/lib/alerts";
import {
  sendCancellationEmail,
  type CancellationEmailRefundStatus,
} from "@/lib/emails/cancellation-email";
import { getEffectiveServerConsent } from "@/lib/consent";
import {
  parseGA4SessionId,
  trackCancellationServerSide,
  trackRefundServerSide,
} from "@/lib/server-tracking";

const CANCELLATION_WINDOW_MS = 48 * 60 * 60 * 1000;

type RefundStatus =
  | "refund_pending"
  | "full_refund"
  | "non_refundable"
  | "pending_manual"
  | "failed";

interface ReservationRow {
  guesty_id: string;
  confirmation_code: string | null;
  guest: { email?: string; fullName?: string } | null;
  listing_id: string | null;
  listing: { title?: string } | null;
  check_in: string;
  check_out: string;
  status: string | null;
  user_id: string | null;
  stripe_payment_intent_id: string | null;
  canceled_at: string | null;
  guesty_canceled_at: string | null;
  refund_status: RefundStatus | null;
  refund_amount: string | number | null;
  stripe_refund_id: string | null;
  guesty_refund_recorded: boolean | null;
  cancellation_email_sent_at: string | null;
  money: Record<string, unknown> | null;
  listing_title: string | null;
  listing_picture: string | null;
}

const SELECT_RESERVATION = `
  SELECT
    r.guesty_id,
    r.confirmation_code,
    r.guest,
    r.listing_id,
    r.listing,
    r.check_in,
    r.check_out,
    r.status,
    r.user_id,
    r.stripe_payment_intent_id,
    r.canceled_at,
    r.guesty_canceled_at,
    r.refund_status,
    r.refund_amount,
    r.stripe_refund_id,
    r.guesty_refund_recorded,
    r.cancellation_email_sent_at,
    r.money,
    l.title AS listing_title,
    l.picture AS listing_picture
  FROM reservations r
  LEFT JOIN listings l ON l.guesty_id = r.listing_id
  WHERE r.guesty_id = $1
`;

function getTotalPaid(money: Record<string, unknown> | null): number {
  if (!money) return 0;
  const t =
    (money as { totalPaid?: number; total_paid?: number }).totalPaid ??
    (money as { total_paid?: number }).total_paid ??
    0;
  return Number(t || 0);
}

/**
 * Extracts a Stripe PaymentIntent id from Guesty's payment notes.
 *
 * Reservations created via the checkout finalizer get
 * `stripe_payment_intent_id` set on the row directly. Reservations that land
 * in our DB through a Guesty webhook sync first do NOT — but the PI is still
 * recorded by the finalizer in the Guesty payment note as
 * `Stripe PI pi_xxx — collected via native Stripe`. Pull it back out so the
 * cancel/refund flow can still issue a Stripe refund instead of falling
 * through to manual processing.
 */
function extractStripePaymentIntentFromMoney(
  money: Record<string, unknown> | null
): string | null {
  if (!money) return null;
  const payments = (money as { payments?: unknown }).payments;
  if (!Array.isArray(payments)) return null;
  for (const payment of payments) {
    if (!payment || typeof payment !== "object") continue;
    const note = (payment as { note?: unknown }).note;
    if (typeof note !== "string") continue;
    const match = note.match(/\b(pi_[A-Za-z0-9]+)\b/);
    if (match) return match[1];
  }
  return null;
}

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isTerminalRefundStatus(
  status: RefundStatus | null
): status is CancellationEmailRefundStatus {
  return (
    status === "full_refund" ||
    status === "non_refundable" ||
    status === "pending_manual" ||
    status === "failed"
  );
}

function upsizedListingPicture(picture: string | null): string | null {
  if (!picture) return null;
  return picture.replace(
    "/t_default_thumb/",
    "/c_fill,w_536,h_402,f_auto,q_auto/"
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const { reservationId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();
    const result = await pool.query(SELECT_RESERVATION, [reservationId]);
    let row = result.rows[0] as ReservationRow | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Ownership check
    const guest = row.guest;
    const emailMatch =
      guest?.email && guest.email.toLowerCase() === user.email.toLowerCase();
    const userIdMatch = row.user_id === user.id;
    if (!emailMatch && !userIdMatch) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    const checkInDate = new Date(row.check_in);
    const now = new Date();
    const msUntilCheckIn = checkInDate.getTime() - now.getTime();
    const refundEligible = msUntilCheckIn > CANCELLATION_WINDOW_MS;

    // Prefer the explicit column, but fall back to the PI embedded in the
    // Guesty payment note for reservations that were synced via webhook
    // before the checkout finalizer could write the column. Persist the
    // recovered value so future operations don't need to re-derive it.
    let piId = row.stripe_payment_intent_id;
    if (!piId) {
      const recovered = extractStripePaymentIntentFromMoney(row.money);
      if (recovered) {
        piId = recovered;
        try {
          await pool.query(
            `UPDATE reservations
                SET stripe_payment_intent_id = $2
              WHERE guesty_id = $1
                AND stripe_payment_intent_id IS NULL`,
            [reservationId, recovered]
          );
          row.stripe_payment_intent_id = recovered;
        } catch (backfillErr) {
          console.warn(
            "[Portal] Failed to backfill stripe_payment_intent_id:",
            backfillErr instanceof Error ? backfillErr.message : backfillErr
          );
        }
      }
    }

    let didFreshClaim = false;
    let didWork = false;

    if (row.status !== "canceled") {
      // Fresh path: compute refund_status and atomic claim
      const computed: RefundStatus = refundEligible
        ? piId
          ? "refund_pending"
          : "pending_manual"
        : "non_refundable";

      const claim = await pool.query(
        `UPDATE reservations
            SET status = 'canceled',
                canceled_at = NOW(),
                refund_status = $2
          WHERE guesty_id = $1 AND status != 'canceled'
          RETURNING canceled_at, refund_status`,
        [reservationId, computed]
      );

      if (claim.rowCount === 0) {
        // Race: concurrent caller already canceled. Re-fetch and fall through to readback/resume.
        const refetch = await pool.query(SELECT_RESERVATION, [reservationId]);
        row = refetch.rows[0] as ReservationRow;
      } else {
        row.status = "canceled";
        row.canceled_at = claim.rows[0].canceled_at;
        row.refund_status = claim.rows[0].refund_status as RefundStatus;
        didFreshClaim = true;
        didWork = true;
      }
    }

    // Now status === 'canceled'. Branch on persisted refund_status.
    if (row.refund_status === null) {
      // Legacy / manual / third-party canceled row
      return NextResponse.json(
        { error: "Reservation is already canceled" },
        { status: 400 }
      );
    }

    // Step: Guesty cancel (resume-safe)
    if (row.guesty_canceled_at === null) {
      try {
        await cancelOpenAPIReservation(reservationId);
        const upd = await pool.query(
          `UPDATE reservations SET guesty_canceled_at = NOW() WHERE guesty_id = $1 RETURNING guesty_canceled_at`,
          [reservationId]
        );
        row.guesty_canceled_at = upd.rows[0].guesty_canceled_at;
        didWork = true;
      } catch (err) {
        console.error("[Portal] Failed to cancel reservation in Guesty:", err);
        if (didFreshClaim) {
          // Revert is only safe before Guesty cancel ever succeeded
          await pool.query(
            `UPDATE reservations
                SET status = 'confirmed',
                    canceled_at = NULL,
                    refund_status = NULL
              WHERE guesty_id = $1 AND guesty_canceled_at IS NULL`,
            [reservationId]
          );
        }
        return NextResponse.json(
          { error: "Failed to cancel reservation. Please contact support." },
          { status: 500 }
        );
      }
    }

    // If a previous run landed in `pending_manual` only because we didn't yet
    // know the Stripe PI, and we just recovered one, promote it back to
    // `refund_pending` so the refund step picks it up.
    if (row.refund_status === "pending_manual" && piId && refundEligible) {
      const promote = await pool.query(
        `UPDATE reservations
            SET refund_status = 'refund_pending'
          WHERE guesty_id = $1
            AND refund_status = 'pending_manual'
          RETURNING refund_status`,
        [reservationId]
      );
      if (promote.rowCount && promote.rowCount > 0) {
        row.refund_status = "refund_pending";
        didWork = true;
      }
    }

    // Step: Stripe refund (resume-safe)
    if (
      row.refund_status === "refund_pending" &&
      row.stripe_refund_id === null &&
      piId
    ) {
      try {
        const stripe = getStripeServer();
        const stripeRefund = await stripe.refunds.create(
          {
            payment_intent: piId,
            metadata: {
              reservationId,
              reason: "guest_self_service_cancellation",
            },
          },
          {
            idempotencyKey: buildStripeIdempotencyKey(
              "reservation_cancel_refund",
              {
                reservationId,
                paymentIntentId: piId,
                refundType: "full",
              }
            ),
          }
        );
        const refundAmt = stripeRefund.amount / 100;
        const upd = await pool.query(
          `UPDATE reservations
              SET refund_status = 'full_refund',
                  stripe_refund_id = $2,
                  refund_amount = $3
            WHERE guesty_id = $1
            RETURNING refund_status, stripe_refund_id, refund_amount`,
          [reservationId, stripeRefund.id, refundAmt]
        );
        row.refund_status = upd.rows[0].refund_status as RefundStatus;
        row.stripe_refund_id = upd.rows[0].stripe_refund_id;
        row.refund_amount = upd.rows[0].refund_amount;
        didWork = true;
      } catch (stripeErr) {
        const errMsg =
          stripeErr instanceof Error ? stripeErr.message : "Unknown";
        const isModeMismatch =
          errMsg.includes("a similar object exists in test mode") ||
          errMsg.includes("a similar object exists in live mode");

        if (isModeMismatch) {
          // Test-mode payment intent refunded from live env (or vice versa).
          // Mark as non-refundable via Stripe — the payment was never real
          // in this environment, so there's nothing to refund.
          console.warn(
            `[Portal] Stripe mode mismatch for ${reservationId} (${piId}) — skipping refund`
          );
          await pool.query(
            `UPDATE reservations SET refund_status = 'non_refundable' WHERE guesty_id = $1`,
            [reservationId]
          );
          row.refund_status = "non_refundable";
        } else {
          console.error("[Portal] Stripe refund failed:", stripeErr);
          await pool.query(
            `UPDATE reservations SET refund_status = 'failed' WHERE guesty_id = $1`,
            [reservationId]
          );
          row.refund_status = "failed";
          await sendAlert(
            "Stripe Refund Failed",
            `Stripe refund failed for reservation <strong>${row.confirmation_code || reservationId}</strong>.<br/>` +
              `Error: ${errMsg}`,
            `stripe-refund-failed-${reservationId}`
          );
        }
        didWork = true;
      }
    }

    // Step: Refund any date-change extension payments (resume-safe).
    // These are additional Stripe PaymentIntents from stay extensions/date changes.
    if (
      (row.refund_status === "full_refund" ||
        row.refund_status === "non_refundable") &&
      row.money?.dateChanges
    ) {
      const dateChanges = Array.isArray(row.money.dateChanges)
        ? row.money.dateChanges
        : [];
      const chargeEntries = dateChanges.filter(
        (dc: { type?: string; paymentIntentId?: string; refunded?: boolean }) =>
          dc.type === "charge" && dc.paymentIntentId && !dc.refunded
      );

      if (chargeEntries.length > 0) {
        const stripe = getStripeServer();
        let extraRefundTotal = 0;

        for (const entry of chargeEntries) {
          try {
            const refund = await stripe.refunds.create(
              {
                payment_intent: entry.paymentIntentId,
                metadata: {
                  reservationId,
                  reason: "cancellation_date_change_refund",
                },
              },
              {
                idempotencyKey: buildStripeIdempotencyKey(
                  "cancel_date_change_refund",
                  { reservationId, paymentIntentId: entry.paymentIntentId }
                ),
              }
            );
            extraRefundTotal += refund.amount / 100;
            entry.refunded = true;
            console.log(
              `[Portal] Refunded date-change PI ${entry.paymentIntentId}: $${refund.amount / 100}`
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown";
            if (
              errMsg.includes("a similar object exists in test mode") ||
              errMsg.includes("a similar object exists in live mode")
            ) {
              entry.refunded = true; // mode mismatch — skip
            } else {
              console.error(
                `[Portal] Failed to refund date-change PI ${entry.paymentIntentId}:`,
                err
              );
              await sendAlert(
                "Date Change Refund Failed on Cancellation",
                `Failed to refund date-change payment ${entry.paymentIntentId} ($${entry.amount}) ` +
                  `for reservation ${row.confirmation_code || reservationId}.<br/>Error: ${errMsg}`,
                `cancel-dc-refund-${entry.paymentIntentId}`
              );
            }
          }
        }

        // Update the dateChanges in the DB with refunded flags
        if (
          extraRefundTotal > 0 ||
          chargeEntries.some((e: { refunded?: boolean }) => e.refunded)
        ) {
          await pool.query(
            `UPDATE reservations
              SET money = jsonb_set(COALESCE(money, '{}'::jsonb), '{dateChanges}', $2::jsonb),
                  refund_amount = COALESCE(refund_amount, 0) + $3
              WHERE guesty_id = $1`,
            [reservationId, JSON.stringify(dateChanges), extraRefundTotal]
          );
          row.refund_amount =
            (Number(row.refund_amount) || 0) + extraRefundTotal;
          didWork = true;
        }
      }
    }

    // Step: Guesty recordRefund (resume-safe). Retry on both NULL (never
    // attempted) and `false` (previously failed) so a re-trigger picks up
    // failed rows instead of skipping them.
    if (
      row.refund_status === "full_refund" &&
      row.guesty_refund_recorded !== true
    ) {
      const refundAmt = asNumber(row.refund_amount);
      try {
        await recordRefund(
          reservationId,
          refundAmt,
          `Guest self-service cancellation — Stripe refund ${row.stripe_refund_id}`
        );
        await pool.query(
          `UPDATE reservations SET guesty_refund_recorded = true WHERE guesty_id = $1`,
          [reservationId]
        );
        row.guesty_refund_recorded = true;
        didWork = true;
      } catch (guestyErr) {
        console.error("[Portal] Failed to record refund in Guesty:", guestyErr);
        await pool.query(
          `UPDATE reservations SET guesty_refund_recorded = false WHERE guesty_id = $1`,
          [reservationId]
        );
        row.guesty_refund_recorded = false;
        await sendGuestyRefundRecordFailedAlert({
          reservationId,
          confirmationCode: row.confirmation_code,
          refundAmount: refundAmt,
          stripeRefundId: row.stripe_refund_id || "",
          error: guestyErr instanceof Error ? guestyErr.message : "Unknown",
        });
        didWork = true;
      }
    }

    // Step: Internal cancellation alert (existing) — only when work was performed
    if (didWork) {
      const refundNote =
        row.refund_status === "full_refund"
          ? `Full refund — Stripe refund <code>${row.stripe_refund_id}</code> ($${asNumber(row.refund_amount).toFixed(2)})`
          : row.refund_status === "non_refundable"
            ? "Non-refundable (within 48hrs of check-in)"
            : row.refund_status === "pending_manual"
              ? "Refund eligible but no Stripe PI on file — manual refund needed"
              : row.refund_status === "failed"
                ? "Stripe refund FAILED — manual follow-up required"
                : "Cancellation processed";

      await sendAlert(
        "Guest Cancellation",
        `<strong>${guest?.fullName || user.email}</strong> canceled reservation ` +
          `<strong>${row.confirmation_code || reservationId}</strong> ` +
          `for <strong>${row.listing_title || row.listing?.title || "Unknown listing"}</strong>.<br/><br/>` +
          `Check-in: ${row.check_in}<br/>` +
          `Check-out: ${row.check_out}<br/>` +
          `Refund: <strong>${refundNote}</strong> ` +
          `(${msUntilCheckIn > 0 ? Math.round(msUntilCheckIn / (1000 * 60 * 60)) + "hrs" : "past"} until check-in)`,
        `guest-cancellation-${reservationId}`
      );
    }

    // Step: Guest cancellation email (terminal statuses only, idempotent on cancellation_email_sent_at)
    if (
      row.cancellation_email_sent_at === null &&
      isTerminalRefundStatus(row.refund_status)
    ) {
      try {
        await sendCancellationEmail({
          reservationId,
          confirmationCode: row.confirmation_code,
          guestEmail: guest?.email || user.email,
          guestName: guest?.fullName || "",
          listingId: row.listing_id,
          listingTitle: row.listing_title || row.listing?.title || "your stay",
          listingPhoto: upsizedListingPicture(row.listing_picture),
          checkIn: row.check_in,
          checkOut: row.check_out,
          refundStatus: row.refund_status,
          refundAmount:
            row.refund_status === "full_refund"
              ? asNumber(row.refund_amount)
              : 0,
          totalPaid: getTotalPaid(row.money),
        });
        await pool.query(
          `UPDATE reservations SET cancellation_email_sent_at = NOW() WHERE guesty_id = $1`,
          [reservationId]
        );
      } catch (emailErr) {
        console.error("[Portal] Cancellation email failed:", emailErr);
        await sendAlert(
          "Cancellation Email Failed",
          `Failed to send guest cancellation email for ${row.confirmation_code || reservationId}.<br/>Error: ${emailErr instanceof Error ? emailErr.message : "Unknown"}`,
          `cancellation-email-failed-${reservationId}`
        );
      }
    }

    // Step: GA4 server-side tracking (only for actual work)
    if (didWork) {
      const consent = getEffectiveServerConsent({
        consentCookieValue: request.cookies.get("_sp_consent")?.value,
        legacyOptOutValue: request.cookies.get("_sp_ccpa_optout")?.value,
      });
      const gaCookie = request.cookies.get("_ga")?.value;
      const gaClientId = gaCookie?.split(".").slice(-2).join(".") || undefined;
      const gaSessionId = parseGA4SessionId(
        request.cookies.get("_ga_PPWFFFPC42")?.value
      );
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        undefined;
      const clientUserAgent = request.headers.get("user-agent") || undefined;
      const fbp = request.cookies.get("_fbp")?.value || undefined;

      const refundedNumeric =
        row.refund_status === "full_refund" ? asNumber(row.refund_amount) : 0;

      trackCancellationServerSide(
        {
          reservationId,
          listingId: row.listing_id || undefined,
          listingTitle: row.listing_title || row.listing?.title || undefined,
          refundAmount: refundedNumeric,
          refunded: row.refund_status === "full_refund",
          guest: { email: guest?.email },
          gaClientId,
          context: { clientIp, clientUserAgent, fbp, gaSessionId },
        },
        { consent }
      ).catch((err) =>
        console.error("[Server Tracking] cancellation error:", err)
      );

      // GA4 refund event: prefer the actual refund amount; otherwise pull the original PI charge
      let ga4RefundAmount = refundedNumeric;
      if (
        ga4RefundAmount === 0 &&
        piId &&
        (row.refund_status === "non_refundable" ||
          row.refund_status === "pending_manual" ||
          row.refund_status === "failed")
      ) {
        try {
          const stripeForLookup = getStripeServer();
          const originalPi =
            await stripeForLookup.paymentIntents.retrieve(piId);
          ga4RefundAmount = originalPi.amount / 100;
        } catch (err) {
          console.warn(
            "[Cancel] Failed to retrieve original PI for GA4 refund:",
            err instanceof Error ? err.message : err
          );
        }
      }

      if (ga4RefundAmount > 0) {
        trackRefundServerSide(
          {
            reservationId,
            listingId: row.listing_id || undefined,
            listingTitle: row.listing_title || row.listing?.title || undefined,
            refundAmount: ga4RefundAmount,
            guest: { email: guest?.email },
            gaClientId,
            context: { clientIp, clientUserAgent, fbp, gaSessionId },
          },
          { consent }
        ).catch((err) => console.error("[Server Tracking] refund error:", err));
      }
    }

    return NextResponse.json({
      success: true,
      reservationId,
      refundStatus: row.refund_status,
      refundAmount:
        row.refund_status === "full_refund" ? asNumber(row.refund_amount) : 0,
      stripeRefundId: row.stripe_refund_id,
      guestyRefundRecorded: row.guesty_refund_recorded,
      canceledAt: row.canceled_at,
    });
  } catch (err) {
    console.error("[Portal] Cancel reservation error:", err);
    return NextResponse.json(
      { error: "Failed to cancel reservation" },
      { status: 500 }
    );
  }
}
