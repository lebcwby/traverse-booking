import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { getListingCalendar } from "@/lib/guesty-beapi";
import {
  updateReservationDates,
  recordPayment,
  recordRefund,
  getOpenAPIReservation,
} from "@/lib/guesty-openapi";
import { buildStripeIdempotencyKey, getStripeServer } from "@/lib/stripe";
import { sendAlert } from "@/lib/alerts";
import { differenceInHours, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────

interface GuestyMoney {
  hostPayout?: number;
  fareAccommodation?: number;
  fareCleaning?: number;
  totalTaxes?: number;
}

interface GuestyReservation {
  checkInDateLocalized?: string;
  checkOutDateLocalized?: string;
  money?: GuestyMoney & { money?: GuestyMoney };
}

type ChangeWindow = "flexible" | "locked" | "midstay" | "past";

// ─── Helpers ──────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  return user;
}

async function getOwnedReservation(
  reservationId: string,
  userEmail: string,
  userId: string
) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
      guesty_id, confirmation_code, listing_id, check_in, check_out,
      guests_count, status, money, guest, user_id,
      stripe_payment_intent_id
    FROM reservations
    WHERE guesty_id = $1
      AND (lower(guest->>'email') = lower($2) OR user_id = $3)`,
    [reservationId, userEmail, userId]
  );
  return result.rows[0] || null;
}

function getChangeWindow(checkIn: string, checkOut: string): ChangeWindow {
  const now = new Date();
  const checkOutDate = parseISO(checkOut.slice(0, 10));
  const checkInDate = parseISO(checkIn.slice(0, 10));

  // After checkout — no changes
  if (now > new Date(checkOutDate.getTime() + 24 * 60 * 60 * 1000))
    return "past";
  // Mid-stay — after check-in, before check-out
  if (now >= checkInDate && now <= checkOutDate) return "midstay";
  // Within 48 hours of check-in — no refund on shortening
  if (differenceInHours(checkInDate, now) <= 48) return "locked";
  // 48+ hours out — full flexibility with refunds
  return "flexible";
}

function canModify(row: {
  status: string;
  check_in: string;
  check_out: string;
}): boolean {
  const status = (row.status || "").toLowerCase();
  if (status !== "confirmed") return false;
  return getChangeWindow(row.check_in, row.check_out) !== "past";
}

function extractMoney(res: GuestyReservation): GuestyMoney {
  // Money can be nested at res.money.money (from dates endpoint response)
  // or directly at res.money (from getOpenAPIReservation)
  return res.money?.money || res.money || {};
}

// ─── POST ─────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const { reservationId } = await params;
  const body = await request.json();
  const action = body.action as string;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getOwnedReservation(reservationId, user.email!, user.id);
  if (!row) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  if (!canModify(row)) {
    return NextResponse.json(
      { error: "This reservation cannot be modified" },
      { status: 400 }
    );
  }

  // Fetch canonical localized dates from Guesty — DB timestamps are UTC
  // and .slice(0,10) gives wrong dates for Pacific timezone properties.
  let localizedCheckIn = row.check_in.slice(0, 10);
  let localizedCheckOut = row.check_out.slice(0, 10);
  try {
    const guestyRes = (await getOpenAPIReservation(
      reservationId
    )) as GuestyReservation;
    if (guestyRes.checkInDateLocalized)
      localizedCheckIn = guestyRes.checkInDateLocalized;
    if (guestyRes.checkOutDateLocalized)
      localizedCheckOut = guestyRes.checkOutDateLocalized;
  } catch {
    // Fall back to DB timestamps if Guesty fetch fails
  }

  const window = getChangeWindow(localizedCheckIn, localizedCheckOut);

  switch (action) {
    case "info":
      return handleInfo(
        { ...row, check_in: localizedCheckIn, check_out: localizedCheckOut },
        window
      );
    case "quote":
      return handleQuote(
        body,
        { ...row, check_in: localizedCheckIn, check_out: localizedCheckOut },
        reservationId,
        window
      );
    case "payment-intent":
      return handlePaymentIntent(body, row, reservationId);
    case "finalize":
      return handleFinalize(
        body,
        { ...row, check_in: localizedCheckIn, check_out: localizedCheckOut },
        reservationId
      );
    case "finalize-no-charge":
      return handleFinalizeNoCharge(
        body,
        { ...row, check_in: localizedCheckIn, check_out: localizedCheckOut },
        reservationId
      );
    case "finalize-refund":
      return handleFinalizeRefund(body, row, reservationId);
    case "rollback":
      return handleRollback(body, reservationId);
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

// ─── Action: Info ─────────────────────────────────────────────────
// Returns the change window and what the guest can modify.

function handleInfo(
  row: { check_in: string; check_out: string; listing_id: string },
  window: ChangeWindow
) {
  return NextResponse.json({
    window,
    canChangeCheckIn: window === "flexible" || window === "locked",
    canChangeCheckOut: window !== "past",
    currentCheckIn: row.check_in,
    currentCheckOut: row.check_out,
    listingId: row.listing_id,
  });
}

// ─── Action: Quote ────────────────────────────────────────────────
// Update dates on Guesty (blocks calendar), return price delta.
// Dates stay extended — caller must rollback if they cancel.

async function handleQuote(
  body: { newCheckIn?: string; newCheckOut: string },
  row: {
    listing_id: string;
    check_out: string;
    check_in: string;
    guests_count: number;
  },
  reservationId: string,
  window: ChangeWindow
) {
  const newCheckOut = body.newCheckOut;
  // Mid-stay: check-in is locked (already arrived)
  const newCheckIn =
    window === "midstay"
      ? row.check_in.slice(0, 10)
      : body.newCheckIn || row.check_in.slice(0, 10);

  if (!newCheckOut) {
    return NextResponse.json(
      { error: "newCheckOut is required" },
      { status: 400 }
    );
  }

  if (newCheckOut <= newCheckIn) {
    return NextResponse.json(
      { error: "Check-out must be after check-in" },
      { status: 400 }
    );
  }

  // Check calendar availability for new date range (excluding current reservation dates)
  try {
    const calendar = await getListingCalendar(
      row.listing_id,
      newCheckIn,
      newCheckOut
    );

    const currentCheckIn = row.check_in.slice(0, 10);
    const currentCheckOut = row.check_out.slice(0, 10);

    // Dates within our current reservation are always allowed (BEAPI
    // marks them as booked since our reservation exists). Only dates
    // OUTSIDE our reservation range need to be truly available.
    const unavailable = calendar.filter(
      (day: { date: string; status: string }) => {
        if (day.date >= currentCheckIn && day.date <= currentCheckOut)
          return false; // our own reservation dates — always ok
        return day.status !== "available";
      }
    );

    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: "Some dates are not available",
          unavailableDates: unavailable.map((d: { date: string }) => d.date),
        },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("[ChangeDates] Calendar check failed:", err);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }

  // Get current financials, then update dates on Guesty (stays extended)
  try {
    const currentRes = (await getOpenAPIReservation(
      reservationId
    )) as GuestyReservation;

    const oldMoney = extractMoney(currentRes);
    const oldHostPayout = oldMoney.hostPayout || 0;
    const checkInLocalized =
      currentRes.checkInDateLocalized || row.check_in.slice(0, 10);
    const originalCheckOut =
      currentRes.checkOutDateLocalized || row.check_out.slice(0, 10);

    // Update dates on Guesty — blocks calendar, triggers recalculation.
    // v1 PUT doesn't return recalculated money inline, so we fetch after.
    await updateReservationDates(reservationId, newCheckIn, newCheckOut);

    // Small delay for Guesty to recalculate financials
    await new Promise((r) => setTimeout(r, 1500));

    const updatedRes = (await getOpenAPIReservation(
      reservationId
    )) as GuestyReservation;
    const newMoney = extractMoney(updatedRes);
    const newHostPayout = newMoney.hostPayout || 0;
    const delta = Math.round((newHostPayout - oldHostPayout) * 100) / 100;

    console.log(
      `[ChangeDates] Quote for ${reservationId}: old=$${oldHostPayout}, new=$${newHostPayout}, delta=$${delta}, window=${window}`
    );

    // Determine what action the guest needs to take
    let action: "charge" | "refund" | "no-refund" | "no-change";
    if (delta > 0.5) {
      action = "charge";
    } else if (delta < -0.5) {
      action = window === "flexible" ? "refund" : "no-refund";
    } else {
      action = "no-change";
    }

    return NextResponse.json({
      newCheckIn,
      newCheckOut,
      originalCheckIn: checkInLocalized,
      originalCheckOut,
      window,
      action,
      pricing: {
        currentTotal: oldHostPayout,
        newTotal: newHostPayout,
        delta: Math.abs(delta),
        deltaDirection:
          delta > 0.5 ? "charge" : delta < -0.5 ? "refund" : "none",
        accommodation:
          Math.round(
            ((newMoney.fareAccommodation || 0) -
              (oldMoney.fareAccommodation || 0)) *
              100
          ) / 100,
        taxes:
          Math.round(
            ((newMoney.totalTaxes || 0) - (oldMoney.totalTaxes || 0)) * 100
          ) / 100,
        currency: "USD",
      },
    });
  } catch (err) {
    console.error("[ChangeDates] Quote failed:", err);
    return NextResponse.json(
      { error: "Failed to get pricing for date change" },
      { status: 500 }
    );
  }
}

// ─── Action: PaymentIntent (extensions — guest owes more) ─────────

async function handlePaymentIntent(
  body: { expectedAmount: number },
  row: {
    check_in: string;
    check_out: string;
    guest: { email?: string };
    confirmation_code: string;
  },
  reservationId: string
) {
  const { expectedAmount } = body;
  if (!expectedAmount || expectedAmount <= 0) {
    return NextResponse.json(
      { error: "expectedAmount is required" },
      { status: 400 }
    );
  }

  try {
    const amountCents = Math.round(expectedAmount * 100);
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        metadata: {
          type: "date_change",
          reservationId,
          amount: String(expectedAmount),
        },
        description: `Date change for ${row.confirmation_code || reservationId}`,
      },
      {
        idempotencyKey: buildStripeIdempotencyKey("date_change_pi", {
          reservationId,
          amountCents,
          ts: Math.floor(Date.now() / 60000), // 1-min window
        }),
      }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: expectedAmount,
    });
  } catch (err) {
    console.error("[ChangeDates] PaymentIntent failed:", err);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}

// ─── Action: Finalize (after payment — extensions) ────────────────

async function handleFinalize(
  body: { paymentIntentId: string; newCheckIn: string; newCheckOut: string },
  row: {
    check_in: string;
    check_out: string;
    confirmation_code: string;
    listing_id: string;
    guest: { email?: string; fullName?: string };
  },
  reservationId: string
) {
  const { paymentIntentId, newCheckIn, newCheckOut } = body;
  if (!paymentIntentId || !newCheckOut) {
    return NextResponse.json(
      { error: "paymentIntentId and newCheckOut are required" },
      { status: 400 }
    );
  }

  const stripe = getStripeServer();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: `Payment not completed (status: ${paymentIntent.status})` },
      { status: 400 }
    );
  }

  if (
    paymentIntent.metadata.type !== "date_change" ||
    paymentIntent.metadata.reservationId !== reservationId
  ) {
    return NextResponse.json(
      { error: "Payment does not match this date change" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const chargedAmount = paymentIntent.amount / 100;

  // Record payment on Guesty (fire-and-forget)
  (async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await recordPayment(reservationId, chargedAmount, paymentIntentId);
        console.log(
          `[ChangeDates] Payment recorded for ${reservationId} on attempt ${attempt}`
        );
        return;
      } catch (err) {
        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
        } else {
          console.error(`[ChangeDates] Payment recording failed:`, err);
          sendAlert(
            "Date Change Payment Recording Failed",
            `Payment for ${row.confirmation_code || reservationId}: ` +
              `${paymentIntentId}, $${chargedAmount}. Manual recording needed.`,
            `date-change-payment-${reservationId}`
          ).catch(() => {});
        }
      }
    }
  })();

  // Update local DB
  try {
    await pool.query(
      `UPDATE reservations
        SET check_in = $2, check_out = $3,
            money = jsonb_set(
              COALESCE(money, '{}'::jsonb),
              '{dateChanges}',
              COALESCE(money->'dateChanges', '[]'::jsonb) || $4::jsonb
            )
        WHERE guesty_id = $1`,
      [
        reservationId,
        newCheckIn,
        newCheckOut,
        JSON.stringify({
          type: "charge",
          paymentIntentId,
          amount: chargedAmount,
          previousCheckIn: row.check_in.slice(0, 10),
          previousCheckOut: row.check_out.slice(0, 10),
          newCheckIn,
          newCheckOut,
          recordedAt: new Date().toISOString(),
        }),
      ]
    );
  } catch (dbErr) {
    console.error("[ChangeDates] Local DB update failed:", dbErr);
  }

  return NextResponse.json({
    success: true,
    newCheckIn,
    newCheckOut,
    chargedAmount,
  });
}

// ─── Action: FinalizeNoCharge (shortening within 48h / mid-stay) ──

async function handleFinalizeNoCharge(
  body: { newCheckIn: string; newCheckOut: string },
  row: {
    check_in: string;
    check_out: string;
    confirmation_code: string;
  },
  reservationId: string
) {
  const { newCheckIn, newCheckOut } = body;
  if (!newCheckOut) {
    return NextResponse.json(
      { error: "newCheckOut is required" },
      { status: 400 }
    );
  }

  // Dates are already updated on Guesty from the quote step — just update local DB
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE reservations
        SET check_in = $2, check_out = $3,
            money = jsonb_set(
              COALESCE(money, '{}'::jsonb),
              '{dateChanges}',
              COALESCE(money->'dateChanges', '[]'::jsonb) || $4::jsonb
            )
        WHERE guesty_id = $1`,
      [
        reservationId,
        newCheckIn,
        newCheckOut,
        JSON.stringify({
          type: "no-refund-shorten",
          previousCheckIn: row.check_in.slice(0, 10),
          previousCheckOut: row.check_out.slice(0, 10),
          newCheckIn,
          newCheckOut,
          recordedAt: new Date().toISOString(),
        }),
      ]
    );
  } catch (dbErr) {
    console.error("[ChangeDates] Local DB update failed:", dbErr);
  }

  console.log(
    `[ChangeDates] No-charge finalize for ${reservationId}: ${row.check_out.slice(0, 10)} → ${newCheckOut}`
  );

  return NextResponse.json({ success: true, newCheckIn, newCheckOut });
}

// ─── Action: FinalizeRefund (shortening 48+ hours out) ────────────

async function handleFinalizeRefund(
  body: { newCheckIn: string; newCheckOut: string; refundAmount: number },
  row: {
    check_in: string;
    check_out: string;
    confirmation_code: string;
    stripe_payment_intent_id: string;
  },
  reservationId: string
) {
  const { newCheckIn, newCheckOut, refundAmount } = body;
  if (!newCheckOut || !refundAmount || refundAmount <= 0) {
    return NextResponse.json(
      { error: "newCheckOut and refundAmount are required" },
      { status: 400 }
    );
  }

  // Dates are already updated on Guesty from the quote step

  // Issue Stripe refund on the original payment intent
  const piId = row.stripe_payment_intent_id;
  if (!piId) {
    await sendAlert(
      "Date Change Refund Failed — No PI",
      `Refund of $${refundAmount} needed for ${row.confirmation_code || reservationId} but no stripe_payment_intent_id found.`,
      `date-change-refund-nopi-${reservationId}`
    );
    // Still update local DB — dates are already changed on Guesty
    const pool = getPool();
    await pool.query(
      `UPDATE reservations
        SET check_in = $2, check_out = $3,
            money = jsonb_set(
              COALESCE(money, '{}'::jsonb),
              '{dateChanges}',
              COALESCE(money->'dateChanges', '[]'::jsonb) || $4::jsonb
            )
        WHERE guesty_id = $1`,
      [
        reservationId,
        newCheckIn,
        newCheckOut,
        JSON.stringify({
          type: "refund-pending-manual",
          refundAmount,
          previousCheckIn: row.check_in.slice(0, 10),
          previousCheckOut: row.check_out.slice(0, 10),
          newCheckIn,
          newCheckOut,
          recordedAt: new Date().toISOString(),
        }),
      ]
    );
    return NextResponse.json({
      success: true,
      newCheckIn,
      newCheckOut,
      refundStatus: "pending_manual",
    });
  }

  const pool = getPool();
  const refundCents = Math.round(refundAmount * 100);

  try {
    const stripe = getStripeServer();
    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: piId,
        amount: refundCents,
        metadata: {
          reservationId,
          reason: "date_change_shortening",
        },
      },
      {
        idempotencyKey: buildStripeIdempotencyKey("date_change_refund", {
          reservationId,
          refundCents,
        }),
      }
    );

    // Record refund on Guesty (fire-and-forget)
    (async () => {
      try {
        await recordRefund(
          reservationId,
          refundAmount,
          `Date change shortening — Stripe refund ${stripeRefund.id}`
        );
      } catch (err) {
        console.error("[ChangeDates] Guesty refund recording failed:", err);
        sendAlert(
          "Date Change Refund Recording Failed",
          `Stripe refund ${stripeRefund.id} ($${refundAmount}) for ${row.confirmation_code || reservationId} issued but Guesty recording failed.`,
          `date-change-refund-record-${reservationId}`
        ).catch(() => {});
      }
    })();

    await pool.query(
      `UPDATE reservations
        SET check_in = $2, check_out = $3,
            refund_amount = COALESCE(refund_amount, 0) + $4,
            money = jsonb_set(
              COALESCE(money, '{}'::jsonb),
              '{dateChanges}',
              COALESCE(money->'dateChanges', '[]'::jsonb) || $5::jsonb
            )
        WHERE guesty_id = $1`,
      [
        reservationId,
        newCheckIn,
        newCheckOut,
        refundAmount,
        JSON.stringify({
          type: "refund",
          stripeRefundId: stripeRefund.id,
          refundAmount,
          previousCheckIn: row.check_in.slice(0, 10),
          previousCheckOut: row.check_out.slice(0, 10),
          newCheckIn,
          newCheckOut,
          recordedAt: new Date().toISOString(),
        }),
      ]
    );

    console.log(
      `[ChangeDates] Refund finalized for ${reservationId}: $${refundAmount}, ${stripeRefund.id}`
    );

    return NextResponse.json({
      success: true,
      newCheckIn,
      newCheckOut,
      refundAmount,
      refundStatus: "refunded",
    });
  } catch (err) {
    console.error("[ChangeDates] Refund failed:", err);

    const errMsg = err instanceof Error ? err.message : "Unknown";
    const isModeMismatch =
      errMsg.includes("a similar object exists in test mode") ||
      errMsg.includes("a similar object exists in live mode");

    if (isModeMismatch) {
      // Test/staging mode mismatch — update DB without refund
      await pool.query(
        `UPDATE reservations
          SET check_in = $2, check_out = $3
          WHERE guesty_id = $1`,
        [reservationId, newCheckIn, newCheckOut]
      );
      return NextResponse.json({
        success: true,
        newCheckIn,
        newCheckOut,
        refundStatus: "skipped_mode_mismatch",
      });
    }

    await sendAlert(
      "Date Change Refund Failed",
      `Refund of $${refundAmount} failed for ${row.confirmation_code || reservationId}.<br/>Error: ${errMsg}`,
      `date-change-refund-failed-${reservationId}`
    );

    return NextResponse.json(
      { error: "Refund failed. Our team has been notified." },
      { status: 500 }
    );
  }
}

// ─── Action: Rollback ─────────────────────────────────────────────

async function handleRollback(
  body: { originalCheckIn: string; originalCheckOut: string },
  reservationId: string
) {
  const { originalCheckIn, originalCheckOut } = body;
  if (!originalCheckOut) {
    return NextResponse.json(
      { error: "originalCheckOut is required" },
      { status: 400 }
    );
  }

  try {
    await updateReservationDates(
      reservationId,
      originalCheckIn || originalCheckOut,
      originalCheckOut
    );
    console.log(
      `[ChangeDates] Rolled back dates for ${reservationId} to ${originalCheckIn}–${originalCheckOut}`
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ChangeDates] Rollback failed:", err);
    return NextResponse.json(
      { error: "Failed to rollback dates" },
      { status: 500 }
    );
  }
}
