import { describe, expect, it } from "vitest";
import {
  findDormantDuplicate,
  sameAmount,
  type GuestyPaymentRow,
} from "./duplicate-payment-rows";

const stripeRow = (amount: number, status = "SUCCEEDED"): GuestyPaymentRow => ({
  _id: "stripe_" + amount,
  amount,
  status,
  note: `Stripe PI pi_3Tzm${amount} — collected via native Stripe`,
});

const autoRow = (
  amount: number,
  status = "PENDING",
  attempts: unknown[] = []
): GuestyPaymentRow => ({
  _id: "auto_" + amount,
  amount,
  status,
  attempts,
});

describe("sameAmount", () => {
  it("matches to the cent and no looser", () => {
    expect(sameAmount(592.9, 592.9)).toBe(true);
    expect(sameAmount(592.9, 592.901)).toBe(true);
    expect(sameAmount(592.9, 592.91)).toBe(false);
    expect(sameAmount(592.9, 592.89)).toBe(false);
  });
});

describe("findDormantDuplicate", () => {
  // The shape this exists for: GY-BQH77T7H, a live landmine at the time of the
  // survey — $255.75 collected via Stripe, $255.75 sitting PENDING.
  it("flags a PENDING auto-rule row that matches a collected Stripe payment", () => {
    const v = findDormantDuplicate([stripeRow(255.75), autoRow(255.75)], 0);
    expect(v.duplicate).toBe(true);
    expect(v.paymentId).toBe("auto_255.75");
    expect(v.amount).toBe(255.75);
  });

  // ⚠️ The case that makes a naive sweep dangerous. GY-reaVneZq:
  // $8,567.65 Stripe + $1,261.56 auto = $9,829.21 = hostPayout. The auto row
  // is collecting a REAL balance. Voiding it loses us the money.
  it("refuses a complementary amount — that is a genuine scheduled balance", () => {
    const v = findDormantDuplicate([stripeRow(8567.65), autoRow(1261.56)], 0);
    expect(v.duplicate).toBe(false);
    expect(v.reason).toMatch(/genuine scheduled balance/);
  });

  it("refuses when a balance is genuinely outstanding", () => {
    const v = findDormantDuplicate(
      [stripeRow(255.75), autoRow(255.75)],
      255.75
    );
    expect(v.duplicate).toBe(false);
    expect(v.reason).toMatch(/balanceDue/);
  });

  // A row mid-capture is not dormant; whatever happened needs a human.
  it("refuses a row that has already attempted capture", () => {
    const v = findDormantDuplicate(
      [stripeRow(592.9), autoRow(592.9, "PENDING", [{ status: "FAILED" }])],
      0
    );
    expect(v.duplicate).toBe(false);
  });

  // Cancelling a SUCCEEDED row leaves the stay unpaid. Never.
  it("never flags a SUCCEEDED auto-rule row", () => {
    const v = findDormantDuplicate(
      [stripeRow(592.9), autoRow(592.9, "SUCCEEDED")],
      0
    );
    expect(v.duplicate).toBe(false);
  });

  it("requires the Stripe payment to have actually succeeded", () => {
    const v = findDormantDuplicate(
      [stripeRow(592.9, "CANCELLED"), autoRow(592.9)],
      0
    );
    expect(v.duplicate).toBe(false);
    expect(v.reason).toMatch(/no SUCCEEDED Stripe-collected payment/);
  });

  it("ignores a noted row that is not ours", () => {
    const manual: GuestyPaymentRow = {
      _id: "m1",
      amount: 592.9,
      status: "SUCCEEDED",
      note: "collected at front desk",
    };
    const v = findDormantDuplicate([manual, autoRow(592.9)], 0);
    expect(v.duplicate).toBe(false);
  });

  it("refuses a zero or negative amount", () => {
    expect(findDormantDuplicate([stripeRow(0), autoRow(0)], 0).duplicate).toBe(
      false
    );
  });

  it("handles a reservation with only our payment", () => {
    expect(findDormantDuplicate([stripeRow(255.75)], 0).duplicate).toBe(false);
  });

  it("handles empty and malformed input without throwing", () => {
    expect(findDormantDuplicate([], 0).duplicate).toBe(false);
    expect(
      findDormantDuplicate(undefined as unknown as GuestyPaymentRow[], 0)
        .duplicate
    ).toBe(false);
  });

  // Mixed: one duplicate and one legitimate balance on the same reservation.
  // The duplicate should be found, and only the duplicate.
  it("picks the matching row when a legitimate balance row also exists", () => {
    const v = findDormantDuplicate(
      [stripeRow(600.65), autoRow(600.65), autoRow(50)],
      0
    );
    expect(v.duplicate).toBe(true);
    expect(v.paymentId).toBe("auto_600.65");
    expect(v.amount).toBe(600.65);
  });
});
