// Unit tests for buildReconcilePlan — the gate that keeps us from linking
// the wrong Guesty reservation to a stuck pending_checkouts row.
//
// Every failure mode is a silent "no link, a human handles it" — the
// alternative is stamping the wrong booking, which would mark the stuck
// guest as booked while their payment sits against a different stay. So
// each case below exists because getting it wrong would cost a booking.

import { describe, expect, it } from "vitest";
import {
  buildReconcilePlan,
  describeReconcileFailure,
  type GuestyReservationLike,
  type PendingCheckoutLike,
} from "./pending-checkout-reconcile";

const PI = { id: "pi_live_abc", amount: 47744 }; // $477.44

const PENDING: PendingCheckoutLike = {
  paymentIntentId: PI.id,
  reservationId: null,
  tracking: {
    listingId: "listing_XYZ",
    listingTitle: "Grand Lodge 265",
    checkIn: "2026-12-13",
    checkOut: "2026-12-17",
    guests: 2,
  },
  guest: {
    email: "guest@example.com",
    firstName: "Jane",
    lastName: "Doe",
  },
};

const GUESTY: GuestyReservationLike = {
  _id: "GY-364GzPhs",
  confirmationCode: "GY-364GzPhs",
  status: "confirmed",
  listingId: "listing_XYZ",
  checkIn: "2026-12-13",
  checkOut: "2026-12-17",
  guestsCount: 2,
  guest: {
    email: "Guest@Example.com", // case difference — must still match
    firstName: "Jane",
    lastName: "Doe",
    fullName: "Jane Doe",
  },
  money: { hostPayout: 477.44 },
};

describe("buildReconcilePlan — happy path", () => {
  it("accepts an exact match and returns the SQL + params to run", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: GUESTY,
    });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.reservationId).toBe("GY-364GzPhs");
    expect(decision.guestEmail).toBe("guest@example.com");
    expect(decision.chargedAmount).toBe(477.44);
    expect(decision.guestyMoneyMatched).toBe(477.44);

    const upd = decision.updates.pendingCheckoutUpdate;
    expect(upd.sql).toMatch(/update pending_checkouts/i);
    // Guard: never clobber an existing stamp.
    expect(upd.sql).toMatch(/reservation_id is null/i);
    expect(upd.params).toEqual(["GY-364GzPhs", PI.id]);

    const ins = decision.updates.reservationsUpsert;
    expect(ins.sql).toMatch(/insert into reservations/i);
    // 'BE-API-reconciled' labels the source so we can find these rows later.
    expect(ins.sql).toMatch(/'BE-API-reconciled'/);
    // ON CONFLICT path is explicit so a prior sync job can't be clobbered.
    expect(ins.sql).toMatch(/on conflict \(guesty_id\) do update/i);
  });

  it("falls back to money.totalPaid when hostPayout is missing", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, money: { totalPaid: 477.44 } },
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.guestyMoneyMatched).toBe(477.44);
  });

  it("accepts a rounding difference inside 1¢", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, money: { hostPayout: 477.4399 } },
    });
    expect(decision.ok).toBe(true);
  });
});

describe("buildReconcilePlan — refuses on every mismatch", () => {
  it("refuses when pending_checkouts.reservation_id is already set", () => {
    const decision = buildReconcilePlan({
      pending: { ...PENDING, reservationId: "GY-already-here" },
      stripePaymentIntent: PI,
      guestyReservation: GUESTY,
    });
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason.kind).toBe("already-stamped");
  });

  it("refuses when the listingId does not match", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, listingId: "listing_DIFFERENT" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("listing-mismatch");
  });

  it("refuses when the check-in differs by a single day", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, checkIn: "2026-12-12" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("dates-mismatch");
  });

  it("refuses when the guest email differs by a letter", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: {
        ...GUESTY,
        guest: { ...GUESTY.guest, email: "guest@example.co" },
      },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("email-mismatch");
  });

  it("refuses when the amount is off by more than 1¢", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, money: { hostPayout: 477.46 } },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("amount-mismatch");
  });

  it("refuses when Guesty has no money fields at all", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, money: {} },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok)
      expect(decision.reason.kind).toBe("reservation-missing-money");
  });

  it("refuses to link a cancelled reservation", () => {
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: { ...GUESTY, status: "cancelled" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("guesty-cancelled");
  });

  it("refuses when _id is missing from the Guesty payload", () => {
    const { _id: _drop, ...noId } = GUESTY;
    void _drop;
    const decision = buildReconcilePlan({
      pending: PENDING,
      stripePaymentIntent: PI,
      guestyReservation: noId,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason.kind).toBe("missing-stay");
  });
});

describe("describeReconcileFailure", () => {
  it("renders each reason into a one-line sentence", () => {
    expect(
      describeReconcileFailure({
        kind: "amount-mismatch",
        stripeAmount: 100.0,
        guestyAmount: 101.0,
        tolerance: 0.01,
      })
    ).toMatch(/\$100\.00.*\$101\.00/);
    expect(
      describeReconcileFailure({
        kind: "guesty-cancelled",
        status: "cancelled",
      })
    ).toMatch(/cancelled/i);
  });
});
