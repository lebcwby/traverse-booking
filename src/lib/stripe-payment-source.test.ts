import { describe, expect, it } from "vitest";
import { classifyPaymentIntent } from "./stripe-payment-source";

describe("classifyPaymentIntent", () => {
  it("treats a quoteId as a single-listing website booking", () => {
    expect(classifyPaymentIntent({ metadata: { quoteId: "q_1" } })).toBe(
      "website_booking"
    );
  });

  it("treats cartCheckout=true as a cart booking", () => {
    expect(
      classifyPaymentIntent({
        metadata: { cartCheckout: "true", lineCount: "2" },
      })
    ).toBe("website_cart");
  });

  it("treats type=date_change as a date change", () => {
    expect(
      classifyPaymentIntent({
        metadata: { type: "date_change", reservationId: "res_1" },
      })
    ).toBe("website_date_change");
  });

  // Everything below must classify as external: these are the cases that were
  // generating a "PAID BOOKING MISSING PENDING CHECKOUT" email per charge.

  it("treats empty metadata as external", () => {
    expect(classifyPaymentIntent({ metadata: {} })).toBe("external");
  });

  it("treats missing metadata as external", () => {
    expect(classifyPaymentIntent({})).toBe("external");
  });

  it("treats null metadata as external", () => {
    expect(classifyPaymentIntent({ metadata: null })).toBe("external");
  });

  it("treats an empty-string quoteId as external, not a booking", () => {
    expect(classifyPaymentIntent({ metadata: { quoteId: "" } })).toBe(
      "external"
    );
  });

  it("treats a whitespace-only quoteId as external", () => {
    expect(classifyPaymentIntent({ metadata: { quoteId: "   " } })).toBe(
      "external"
    );
  });

  it('does not accept cartCheckout values other than the literal "true"', () => {
    expect(classifyPaymentIntent({ metadata: { cartCheckout: "false" } })).toBe(
      "external"
    );
    expect(classifyPaymentIntent({ metadata: { cartCheckout: "1" } })).toBe(
      "external"
    );
  });

  it("does not accept an unrelated type value", () => {
    expect(classifyPaymentIntent({ metadata: { type: "damage_waiver" } })).toBe(
      "external"
    );
  });

  it("classifies a SuiteOp-shaped damage-waiver charge as external", () => {
    expect(
      classifyPaymentIntent({
        metadata: {
          source: "suiteop",
          reservation_code: "GY-abc123",
          charge_type: "damage_waiver",
        },
      })
    ).toBe("external");
  });

  it("prefers booking over cart when a PaymentIntent somehow carries both", () => {
    expect(
      classifyPaymentIntent({
        metadata: { quoteId: "q_1", cartCheckout: "true" },
      })
    ).toBe("website_booking");
  });
});
