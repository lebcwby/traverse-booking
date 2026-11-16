// Shared verification + stamping logic for linking a Guesty reservation that
// ops created by hand against a stuck pending_checkouts row.
//
// Two callers:
//   1. scripts/stamp-reconciled-reservation.ts — human-driven one-shot.
//   2. /api/cron/recover-checkouts — auto-link when the only thing left to
//      try is to detect a hand-made reservation and stop the retry loop.
//
// Both go through buildReconcilePlan() first — it returns `{ok: false, reason}`
// unless EVERY check passes. The caller decides whether to actually run the
// writes it returns.
//
// Why the match must be exact (listing + checkIn + checkOut + guestEmail +
// amount within 1¢): a wrong stamp links the wrong booking to the guest's
// payment, so the next ORPHAN sweep would also drop them, the recovery cron
// would stop, and the guest would quietly have no reservation while ops'
// hand-made row is cleared from the retry list. The penalty for over-strict
// is "a human runs the script"; the penalty for over-loose is a lost booking.

import type Stripe from "stripe";

/** The shape of a Guesty OpenAPI v1 reservation payload the match reads. */
export interface GuestyReservationLike {
  _id?: string;
  confirmationCode?: string;
  listingId?: string;
  checkIn?: string;
  checkOut?: string;
  guestsCount?: number;
  status?: string;
  guest?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
  guestId?: string;
  bookerId?: string;
  money?: {
    hostPayout?: number;
    totalPaid?: number;
    fareAccommodation?: number;
    [k: string]: unknown;
  };
}

export interface PendingCheckoutLike {
  paymentIntentId: string;
  reservationId?: string | null;
  tracking: {
    listingId: string;
    listingTitle?: string;
    checkIn: string;
    checkOut: string;
    guests?: number;
  };
  guest: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export type ReconcileFailReason =
  | { kind: "already-stamped"; existingReservationId: string }
  | { kind: "missing-stay"; field: string }
  | { kind: "listing-mismatch"; pending: string; guesty: string }
  | { kind: "dates-mismatch"; pending: string; guesty: string }
  | { kind: "email-mismatch"; pending: string; guesty: string }
  | {
      kind: "amount-mismatch";
      stripeAmount: number;
      guestyAmount: number;
      tolerance: number;
    }
  | { kind: "reservation-missing-money" }
  | { kind: "guesty-cancelled"; status: string };

export interface ReconcilePlan {
  ok: true;
  reservationId: string;
  confirmationCode: string | null;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestEmail: string;
  guestsCount: number;
  chargedAmount: number;
  guestyMoneyMatched: number;
  updates: {
    pendingCheckoutUpdate: {
      sql: string;
      params: [string, string]; // reservationId, paymentIntentId
    };
    reservationsUpsert: {
      sql: string;
      params: unknown[];
    };
  };
}

export type ReconcileDecision =
  | ReconcilePlan
  | { ok: false; reason: ReconcileFailReason };

// 1¢ tolerance. Guesty rounds money to 2 decimals internally and the
// Stripe amount is in integer cents, so anything beyond this is a real
// mismatch and NOT a floating-point artefact.
const AMOUNT_TOLERANCE_USD = 0.01;

// Guesty reservation statuses we refuse to link against. Linking a
// cancelled or inquiry reservation would stamp a stay the guest cannot
// actually occupy. 'confirmed' is the only green-light status.
const ACCEPTED_GUESTY_STATUSES = new Set(["confirmed", "reserved", "booked"]);

export function buildReconcilePlan(args: {
  pending: PendingCheckoutLike;
  stripePaymentIntent: Pick<Stripe.PaymentIntent, "id" | "amount">;
  guestyReservation: GuestyReservationLike;
}): ReconcileDecision {
  const { pending, stripePaymentIntent, guestyReservation } = args;

  // Belt-and-braces: never overwrite a stamp that's already set. The
  // checkout-recovery cron filters on `reservation_id IS NULL`, but the
  // script runs outside that query and must enforce the same guard.
  if (pending.reservationId) {
    return {
      ok: false,
      reason: {
        kind: "already-stamped",
        existingReservationId: pending.reservationId,
      },
    };
  }

  const reservationId = (guestyReservation._id || "").trim();
  if (!reservationId) {
    return { ok: false, reason: { kind: "missing-stay", field: "_id" } };
  }
  const guestyListingId = (guestyReservation.listingId || "").trim();
  const guestyCheckIn = (guestyReservation.checkIn || "").trim();
  const guestyCheckOut = (guestyReservation.checkOut || "").trim();
  const guestyEmail = (guestyReservation.guest?.email || "")
    .trim()
    .toLowerCase();
  const status = (guestyReservation.status || "").trim().toLowerCase();

  if (!ACCEPTED_GUESTY_STATUSES.has(status)) {
    return { ok: false, reason: { kind: "guesty-cancelled", status } };
  }

  if (!guestyListingId) {
    return { ok: false, reason: { kind: "missing-stay", field: "listingId" } };
  }
  if (!guestyCheckIn) {
    return { ok: false, reason: { kind: "missing-stay", field: "checkIn" } };
  }
  if (!guestyCheckOut) {
    return { ok: false, reason: { kind: "missing-stay", field: "checkOut" } };
  }
  if (!guestyEmail) {
    return {
      ok: false,
      reason: { kind: "missing-stay", field: "guest.email" },
    };
  }

  if (guestyListingId !== pending.tracking.listingId) {
    return {
      ok: false,
      reason: {
        kind: "listing-mismatch",
        pending: pending.tracking.listingId,
        guesty: guestyListingId,
      },
    };
  }

  if (guestyCheckIn !== pending.tracking.checkIn) {
    return {
      ok: false,
      reason: {
        kind: "dates-mismatch",
        pending: `${pending.tracking.checkIn} (checkIn)`,
        guesty: `${guestyCheckIn} (checkIn)`,
      },
    };
  }
  if (guestyCheckOut !== pending.tracking.checkOut) {
    return {
      ok: false,
      reason: {
        kind: "dates-mismatch",
        pending: `${pending.tracking.checkOut} (checkOut)`,
        guesty: `${guestyCheckOut} (checkOut)`,
      },
    };
  }

  const pendingEmail = (pending.guest.email || "").trim().toLowerCase();
  if (pendingEmail !== guestyEmail) {
    return {
      ok: false,
      reason: {
        kind: "email-mismatch",
        pending: pendingEmail,
        guesty: guestyEmail,
      },
    };
  }

  const stripeAmountUsd = (stripePaymentIntent.amount ?? 0) / 100;
  const money = guestyReservation.money;
  if (!money) {
    return { ok: false, reason: { kind: "reservation-missing-money" } };
  }
  // Prefer hostPayout — that's what Guesty reconciles against on a direct
  // booking and what our checkout-finalizer writes into reservations.money.
  // Fall back to totalPaid for handmade rows where the ledger was recorded
  // first and hostPayout wasn't set.
  const guestyAmount =
    typeof money.hostPayout === "number"
      ? money.hostPayout
      : typeof money.totalPaid === "number"
        ? money.totalPaid
        : NaN;
  if (!Number.isFinite(guestyAmount)) {
    return { ok: false, reason: { kind: "reservation-missing-money" } };
  }
  if (Math.abs(guestyAmount - stripeAmountUsd) > AMOUNT_TOLERANCE_USD) {
    return {
      ok: false,
      reason: {
        kind: "amount-mismatch",
        stripeAmount: stripeAmountUsd,
        guestyAmount,
        tolerance: AMOUNT_TOLERANCE_USD,
      },
    };
  }

  const guestsCount =
    typeof guestyReservation.guestsCount === "number"
      ? guestyReservation.guestsCount
      : (pending.tracking.guests ?? 1);
  const confirmationCode = guestyReservation.confirmationCode?.trim() || null;

  // Mirror checkout-finalizer's canonical INSERT shape. ON CONFLICT does the
  // right thing when a reservation row happens to already exist (a sync job
  // raced ahead): we fill in the Stripe link without clobbering anything.
  const reservationsUpsert = {
    sql: `INSERT INTO reservations (
            guesty_id,
            confirmation_code,
            listing_id,
            guest_id,
            status,
            source,
            check_in,
            check_out,
            guests_count,
            guest,
            money,
            last_synced_at,
            stripe_payment_intent_id,
            listing_title
          ) VALUES ($1, $2, $3, $4, $5, 'BE-API-reconciled', $6, $7, $8, $9, $10, now(), $11, $12)
          ON CONFLICT (guesty_id) DO UPDATE SET
            status = EXCLUDED.status,
            confirmation_code = COALESCE(EXCLUDED.confirmation_code, reservations.confirmation_code),
            guest = COALESCE(reservations.guest, EXCLUDED.guest),
            money = COALESCE(reservations.money, EXCLUDED.money),
            stripe_payment_intent_id = COALESCE(reservations.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
            listing_title = COALESCE(reservations.listing_title, EXCLUDED.listing_title),
            last_synced_at = now()`,
    params: [
      reservationId,
      confirmationCode,
      guestyListingId,
      guestyReservation.guestId || guestyReservation.bookerId || null,
      guestyReservation.status || "confirmed",
      guestyCheckIn,
      guestyCheckOut,
      guestsCount,
      JSON.stringify({
        email: pending.guest.email || null,
        firstName:
          pending.guest.firstName || guestyReservation.guest?.firstName || null,
        lastName:
          pending.guest.lastName || guestyReservation.guest?.lastName || null,
        fullName:
          guestyReservation.guest?.fullName ||
          [pending.guest.firstName, pending.guest.lastName]
            .filter(Boolean)
            .join(" ") ||
          null,
        phone: pending.guest.phone || guestyReservation.guest?.phone || null,
      }),
      JSON.stringify({ total_paid: stripeAmountUsd, currency: "USD" }),
      stripePaymentIntent.id,
      pending.tracking.listingTitle || null,
    ],
  };

  const pendingCheckoutUpdate = {
    sql: `UPDATE pending_checkouts
             SET status         = 'completed',
                 reservation_id = $1,
                 completed_at   = now(),
                 last_error     = null,
                 updated_at     = now()
           WHERE payment_intent_id = $2
             AND reservation_id IS NULL`,
    params: [reservationId, pending.paymentIntentId] as [string, string],
  };

  return {
    ok: true,
    reservationId,
    confirmationCode,
    listingId: guestyListingId,
    checkIn: guestyCheckIn,
    checkOut: guestyCheckOut,
    guestEmail: guestyEmail,
    guestsCount,
    chargedAmount: stripeAmountUsd,
    guestyMoneyMatched: guestyAmount,
    updates: { pendingCheckoutUpdate, reservationsUpsert },
  };
}

export function describeReconcileFailure(reason: ReconcileFailReason): string {
  switch (reason.kind) {
    case "already-stamped":
      return `pending_checkouts.reservation_id is already set to ${reason.existingReservationId} — stamp not needed.`;
    case "missing-stay":
      return `Guesty reservation is missing field "${reason.field}" — cannot verify match.`;
    case "listing-mismatch":
      return `listingId does not match: pending=${reason.pending}, guesty=${reason.guesty}.`;
    case "dates-mismatch":
      return `date mismatch: pending=${reason.pending}, guesty=${reason.guesty}.`;
    case "email-mismatch":
      return `guest email does not match: pending=${reason.pending}, guesty=${reason.guesty}.`;
    case "amount-mismatch":
      return (
        `amount mismatch: Stripe=$${reason.stripeAmount.toFixed(2)}, ` +
        `Guesty=$${reason.guestyAmount.toFixed(2)} ` +
        `(tolerance $${reason.tolerance.toFixed(2)}).`
      );
    case "reservation-missing-money":
      return `Guesty reservation has no money.hostPayout or money.totalPaid — cannot verify amount.`;
    case "guesty-cancelled":
      return `Guesty reservation status is "${reason.status}", not a confirmed stay.`;
  }
}
