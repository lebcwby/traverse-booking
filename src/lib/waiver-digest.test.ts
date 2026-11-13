import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { buildWaiverSummary, renderWaiverBlocks } from "./waiver-digest";

/** A SuiteOp PaymentIntent, shaped like the real ones in our account. */
const pi = (over: {
  chargeType?: string;
  originator?: string;
  status?: Stripe.PaymentIntent["status"];
  amount?: number;
  refunded?: number;
}): Stripe.PaymentIntent => {
  const amount = over.amount ?? 2000;
  const status = over.status ?? "succeeded";
  return {
    id: `pi_${Math.random().toString(36).slice(2)}`,
    amount,
    amount_received: status === "succeeded" ? amount : 0,
    status,
    metadata: {
      Originator: over.originator ?? "SuiteOp",
      "Charge Type": over.chargeType ?? "Waiver",
      "Property Nickname": "LEAD:OSV303:Nadim",
      Reservation: "HA-CwkBedt",
    },
    latest_charge: over.refunded
      ? ({ amount_refunded: over.refunded } as Stripe.Charge)
      : null,
  } as unknown as Stripe.PaymentIntent;
};

const textOf = (blocks: Record<string, unknown>[]) => JSON.stringify(blocks);

describe("buildWaiverSummary", () => {
  it("sums succeeded waivers", () => {
    const s = buildWaiverSummary(
      [pi({ amount: 1000 }), pi({ amount: 2000 }), pi({ amount: 500 })],
      "2026-11-02"
    );
    expect(s.count).toBe(3);
    expect(s.grossCents).toBe(3500);
    expect(s.netCents).toBe(3500);
  });

  it("excludes deposit holds, which are not revenue", () => {
    // The trap this whole module exists to avoid: over 31 days the account
    // held $17,100 of released deposit holds against $4,850 of real waivers.
    const s = buildWaiverSummary(
      [
        pi({ amount: 1000 }),
        pi({ chargeType: "Deposit", amount: 15000, status: "canceled" }),
        pi({ chargeType: "Deposit", amount: 25000, status: "requires_capture" }),
      ],
      "2026-11-02"
    );
    expect(s.count).toBe(1);
    expect(s.grossCents).toBe(1000);
  });

  it("excludes SuiteOp's ad-hoc charges and guest-store requests", () => {
    const s = buildWaiverSummary(
      [
        pi({ amount: 1000 }),
        pi({ chargeType: "Charge", amount: 10000 }),
        pi({ chargeType: "Request", amount: 5000 }),
      ],
      "2026-11-02"
    );
    expect(s.count).toBe(1);
    expect(s.grossCents).toBe(1000);
  });

  it("ignores charges that are not SuiteOp's at all", () => {
    // A website booking carries no Originator; it must never be counted even
    // if something else about it looks waiver-shaped.
    const theirs = {
      amount: 90000,
      amount_received: 90000,
      status: "succeeded",
      metadata: { quoteId: "q_123", "Charge Type": "Waiver" },
      latest_charge: null,
    } as unknown as Stripe.PaymentIntent;
    const s = buildWaiverSummary([theirs, pi({ amount: 1000 })], "2026-11-02");
    expect(s.count).toBe(1);
    expect(s.grossCents).toBe(1000);
  });

  it("nets off refunds", () => {
    const s = buildWaiverSummary(
      [pi({ amount: 3000, refunded: 1000 })],
      "2026-11-02"
    );
    expect(s.grossCents).toBe(3000);
    expect(s.refundedCents).toBe(1000);
    expect(s.netCents).toBe(2000);
  });

  it("counts a waiver that could not be charged, without counting its money", () => {
    const s = buildWaiverSummary(
      [pi({ status: "requires_payment_method", amount: 2000 })],
      "2026-11-02"
    );
    expect(s.count).toBe(0);
    expect(s.grossCents).toBe(0);
    expect(s.failedCount).toBe(1);
  });

  it("does not treat a deliberately cancelled waiver as a failure", () => {
    const s = buildWaiverSummary(
      [pi({ status: "canceled", amount: 1000 })],
      "2026-11-02"
    );
    expect(s.failedCount).toBe(0);
    expect(s.count).toBe(0);
  });

  it("reports zeros for a day with no SuiteOp activity", () => {
    const s = buildWaiverSummary([], "2026-11-02");
    expect(s).toMatchObject({
      count: 0,
      grossCents: 0,
      refundedCents: 0,
      netCents: 0,
      failedCount: 0,
    });
  });
});

describe("renderWaiverBlocks", () => {
  it("renders the day's total", () => {
    const text = textOf(
      renderWaiverBlocks(
        buildWaiverSummary([pi({ amount: 1000 }), pi({ amount: 2500 })], "2026-11-02")
      )
    );
    expect(text).toContain("Damage waivers — charged 2026-11-02");
    expect(text).toContain("2 waivers");
    expect(text).toContain("$35.00");
  });

  it("shows gross and refunded separately when something was refunded", () => {
    const text = textOf(
      renderWaiverBlocks(
        buildWaiverSummary([pi({ amount: 3000, refunded: 1000 })], "2026-11-02")
      )
    );
    expect(text).toContain("$20.00");
    expect(text).toContain("$30.00 charged, $10.00 refunded");
  });

  it("says nothing was charged rather than rendering an empty line", () => {
    const text = textOf(
      renderWaiverBlocks(buildWaiverSummary([], "2026-11-02"))
    );
    expect(text).toContain("No waivers charged");
  });

  it("flags uncovered stays when a waiver failed to charge", () => {
    const text = textOf(
      renderWaiverBlocks(
        buildWaiverSummary(
          [pi({ amount: 1000 }), pi({ status: "requires_payment_method" })],
          "2026-11-02"
        )
      )
    );
    expect(text).toContain("1 waiver failed to charge");
    expect(text).toContain("uncovered");
  });

  it("labels the check-in basis as arrivals, not as charges", () => {
    // The two bases are different numbers, so the heading has to say which
    // one is on screen or the figure cannot be checked against SuiteOp.
    const checkIn = textOf(
      renderWaiverBlocks(
        buildWaiverSummary([pi({ amount: 1000 })], "2026-11-02", "check_in", 30)
      )
    );
    expect(checkIn).toContain("stays arriving 2026-11-02");
    expect(checkIn).toContain("across 30 arrivals");

    const charged = textOf(
      renderWaiverBlocks(
        buildWaiverSummary([pi({ amount: 1000 })], "2026-11-02", "charge_date")
      )
    );
    expect(charged).toContain("charged 2026-11-02");
    expect(charged).not.toContain("arrivals");
  });

  it("distinguishes a day with no arrivals from a day nobody paid", () => {
    const noArrivals = textOf(
      renderWaiverBlocks(buildWaiverSummary([], "2026-11-02", "check_in", 0))
    );
    expect(noArrivals).toContain("No arrivals");

    const nobodyPaid = textOf(
      renderWaiverBlocks(buildWaiverSummary([], "2026-11-02", "check_in", 12))
    );
    expect(nobodyPaid).toContain("No waivers charged");
  });

  it("counts an intent once when two search batches both return it", () => {
    // Stripe search is queried in batches of reservation ids; a single
    // intent can legitimately come back from more than one of them.
    const dup = pi({ amount: 2500 });
    const s = buildWaiverSummary([dup, dup, dup], "2026-11-02", "check_in", 5);
    expect(s.count).toBe(1);
    expect(s.grossCents).toBe(2500);
  });

  it("defaults to the charge-date basis", () => {
    expect(buildWaiverSummary([], "2026-11-02").basis).toBe("charge_date");
  });

  it("stays a single block", () => {
    expect(
      renderWaiverBlocks(
        buildWaiverSummary(
          Array.from({ length: 50 }, () => pi({ amount: 1000 })),
          "2026-11-02"
        )
      )
    ).toHaveLength(1);
  });
});
