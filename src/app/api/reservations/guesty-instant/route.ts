// Create + charge a reservation via Guesty Pay from a tokenized card.
//
// Phase 1 of the Guesty Pay re-activation (docs/payments/guesty-pay-reactivation-plan.md).
// This is the piece that doesn't exist yet: a client→server route that takes the
// Guesty `ccToken` (from the GuestyPayPayment tokenization component) and creates
// the reservation through Guesty — which charges via Guesty Pay and vaults the card
// on the reservation (so the team can extend/refund natively). The Stripe path
// finalizes from a webhook instead; this finalizes inline.
//
// 🔒 FLAG-GATED: inert (404) unless GUESTY_PAY_ENABLED="true". Do NOT enable until
// a Guesty sandbox booking has validated the charge + 3DS behaviour (see the
// TODO(sandbox) notes below). The live Stripe checkout is untouched.

import { NextRequest, NextResponse } from "next/server";
import { createReservationInstant, getQuote } from "@/lib/guesty-beapi";
import { getPool, withAdvisoryLock } from "@/lib/db";
import { trackBookingServerSide } from "@/lib/server-tracking";
import { sendAlert } from "@/lib/alerts";
import { toE164US } from "@/lib/phone";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Single flag for both the client checkout branch (/book) and this route, so
// they can never be half-enabled. NEXT_PUBLIC_ is readable server-side too.
const ENABLED = process.env.NEXT_PUBLIC_GUESTY_PAY_ENABLED === "true";

interface Body {
  quoteId?: string;
  ratePlanId?: string;
  ccToken?: string;
  guest?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  marketingOptIn?: boolean;
  tracking?: {
    listingId?: string;
    listingTitle?: string;
    listingNickname?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    eventId?: string;
  };
}

export async function POST(request: NextRequest) {
  if (!ENABLED) {
    return NextResponse.json(
      { error: "Guesty Pay is not enabled" },
      { status: 404 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { quoteId, ratePlanId, ccToken, guest, marketingOptIn } = body;
  const tracking = body.tracking || {};
  if (!quoteId || !ratePlanId || !ccToken || !guest?.email || !guest?.firstName) {
    return NextResponse.json(
      {
        error:
          "quoteId, ratePlanId, ccToken, and guest (firstName + email) are required",
        code: "INVALID_REQUEST",
      },
      { status: 400 }
    );
  }

  // Serialize per-quote so a double-submit can't create two reservations.
  // Guesty quotes are single-use, so a racing second call also fails at Guesty.
  return withAdvisoryLock(`guesty-instant:${quoteId}`, async () => {
    const pool = getPool();

    // Authoritative quote (listing/dates) — never trust the client.
    let quote: Record<string, unknown>;
    try {
      quote = (await getQuote(quoteId)) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Quote not found or expired", code: "INVALID_DATES" },
        { status: 400 }
      );
    }
    const listingId =
      (quote.unitTypeId as string) || tracking.listingId || null;

    // Create + charge via Guesty Pay.
    let reservation: Record<string, unknown>;
    try {
      reservation = (await createReservationInstant({
        quoteId,
        ratePlanId,
        ccToken,
        guest: {
          firstName: guest.firstName as string,
          lastName: guest.lastName || "",
          email: guest.email as string,
          phone: toE164US(guest.phone),
        },
        policy: {
          privacy: {
            version: 1,
            dateOfAcceptance: new Date().toISOString(),
            isAccepted: true,
          },
          termsAndConditions: {
            dateOfAcceptance: new Date().toISOString(),
            isAccepted: true,
          },
          ...(marketingOptIn ? { marketing: { isAccepted: true } } : {}),
        },
      })) as Record<string, unknown>;
    } catch (err) {
      await sendAlert(
        "GUESTY PAY — RESERVATION CREATE FAILED",
        `createReservationInstant failed for quote <code>${quoteId}</code> (${guest.email}).<br>${err instanceof Error ? err.message : String(err)}`,
        `guesty-instant-fail-${quoteId}`,
        { to: "admin@traversehospitality.com" }
      ).catch(() => {});
      return NextResponse.json(
        { error: "We couldn't complete your booking. Please try again.", code: "RESERVATION_FAILED" },
        { status: 502 }
      );
    }

    const reservationId = String(
      reservation._id || reservation.id || reservation.reservationId || ""
    );
    const confirmationCode =
      (reservation.confirmationCode as string) ||
      (reservation.confirmation_code as string) ||
      null;

    // ── 3D Secure (SCA) ─────────────────────────────────────────────
    // Some cards require authentication. The installed tokenization SDK returns
    // only a token (no client-side authURL), so 3DS surfaces here. If the create
    // response carries an authentication/redirect URL, bounce the guest to it
    // before treating the booking as done — the client redirects to `authUrl`.
    // TODO(sandbox): confirm the exact field name + the post-auth return flow
    //   (Guesty redirects back to a success URL → verifyPayment to finalize).
    const authUrl =
      (reservation.authURL as string) ||
      (reservation.authUrl as string) ||
      (reservation.redirectUrl as string) ||
      ((reservation.payment as Record<string, unknown>)?.authURL as string) ||
      "";
    if (authUrl) {
      return NextResponse.json({
        requiresAuth: true,
        authUrl,
        reservationId,
        confirmationCode,
      });
    }

    // ── Charge verification ─────────────────────────────────────────
    // Guesty creates the reservation EVEN IF the charge fails, so confirm the
    // payment before treating it as a booking. Defensive on field names (mark
    // sandbox-confirmed): block on a CLEAR failed/unpaid signal; if we can't
    // positively confirm "paid", proceed but alert ops to eyeball it (so we
    // never reject a genuinely-paid booking on an unexpected response shape).
    const money = (reservation.money as Record<string, unknown>) || {};
    const nestedMoney = (money.money as Record<string, unknown>) || {};
    const balanceDue = Number(money.balanceDue ?? nestedMoney.balanceDue ?? NaN);
    const paymentStatus = String(
      money.paymentStatus || reservation.paymentStatus || ""
    ).toUpperCase();
    const clearlyUnpaid =
      paymentStatus === "FAILED" ||
      paymentStatus === "UNPAID" ||
      paymentStatus === "DECLINED" ||
      (Number.isFinite(balanceDue) && balanceDue > 0.01);
    if (clearlyUnpaid) {
      await sendAlert(
        "GUESTY PAY — CHARGE FAILED",
        `Reservation <code>${reservationId}</code> (${confirmationCode || "?"}) was created but the charge did NOT go through (status=${paymentStatus || "?"}, balanceDue=${balanceDue}). The dates may be held in Guesty without payment — review/cancel.`,
        `guesty-charge-failed-${reservationId}`,
        { to: "admin@traversehospitality.com" }
      ).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Your payment couldn't be processed. Please try a different card.",
          code: "PAYMENT_FAILED",
        },
        { status: 402 }
      );
    }
    const positivelyPaid =
      paymentStatus === "PAID" ||
      paymentStatus === "SUCCEEDED" ||
      (Number.isFinite(balanceDue) && balanceDue <= 0.01);
    if (!positivelyPaid) {
      await sendAlert(
        "GUESTY PAY — CHARGE STATUS UNCONFIRMED (review)",
        `Reservation <code>${reservationId}</code> (${confirmationCode || "?"}) was created and treated as booked, but we couldn't positively confirm the charge from the response (status=${paymentStatus || "?"}, balanceDue=${balanceDue}). Verify it was paid in Guesty. If this fires for normal bookings, fix the field check in the route.`,
        `guesty-charge-unconfirmed-${reservationId}`,
        { to: "admin@traversehospitality.com" }
      ).catch(() => {});
    }

    const amount =
      Number(money.hostPayout) || Number(nestedMoney.hostPayout) || 0;

    // Persist locally. No stripe_payment_intent_id — Guesty Pay charged natively,
    // so payment is already recorded on Guesty (no recordPayment needed).
    try {
      await pool.query(
        `INSERT INTO reservations (guesty_id, confirmation_code, listing_id, guest_id, status, source, check_in, check_out, guests_count, guest, money, last_synced_at, payment_recorded_at, listing_title, listing_photo)
         VALUES ($1, $2, $3, $4, $5, 'BE-API', $6, $7, $8, $9, $10, $11, $11, $12, $13)
         ON CONFLICT (guesty_id) DO UPDATE SET
           status = EXCLUDED.status,
           confirmation_code = EXCLUDED.confirmation_code,
           guest = EXCLUDED.guest,
           money = COALESCE(reservations.money, EXCLUDED.money),
           payment_recorded_at = COALESCE(reservations.payment_recorded_at, EXCLUDED.payment_recorded_at),
           last_synced_at = $11`,
        [
          reservationId,
          confirmationCode,
          listingId,
          ((reservation.guestId || reservation.bookerId) as string) || null,
          (reservation.status as string) || "confirmed",
          (reservation.checkInDateLocalized as string) || tracking.checkIn || null,
          (reservation.checkOutDateLocalized as string) || tracking.checkOut || null,
          tracking.guests || null,
          JSON.stringify({
            email: guest.email,
            firstName: guest.firstName,
            lastName: guest.lastName || null,
            fullName: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
            phone: guest.phone || null,
          }),
          JSON.stringify({ total_paid: amount, currency: "USD" }),
          Date.now(),
          tracking.listingTitle || null,
          null,
        ]
      );
    } catch (dbErr) {
      // Reservation exists in Guesty; local write failed → alert, don't fail the booking.
      await sendAlert(
        "GUESTY PAY — RESERVATION DB WRITE FAILED",
        `Guesty reservation <code>${reservationId}</code> (${confirmationCode || "?"}) was created + charged, but the local DB write failed. ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
        `guesty-instant-db-${reservationId}`,
        { to: "admin@traversehospitality.com" }
      ).catch(() => {});
    }

    // Purchase tracking (best-effort).
    await trackBookingServerSide({
      reservationId,
      confirmationCode,
      listingId: listingId || "",
      listingTitle: tracking.listingTitle || "",
      listingNickname: tracking.listingNickname,
      checkIn:
        (reservation.checkInDateLocalized as string) || tracking.checkIn || "",
      checkOut:
        (reservation.checkOutDateLocalized as string) ||
        tracking.checkOut ||
        "",
      guests: tracking.guests || 0,
      total: amount,
      eventId: tracking.eventId || `purchase_${reservationId}`,
      guest: {
        email: guest.email as string,
        phone: guest.phone || "",
        firstName: guest.firstName as string,
        lastName: guest.lastName || "",
      },
    }).catch((err) => console.error("[GuestyPay tracking] error:", err));

    return NextResponse.json({ reservationId, confirmationCode });
  });
}
