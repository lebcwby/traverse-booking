import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockSendAlert,
  mockFinalizeReservation,
  mockGetPendingCheckout,
  mockMarkPendingCheckoutError,
  mockConstructEvent,
} = vi.hoisted(() => ({
  mockSendAlert: vi.fn(),
  mockFinalizeReservation: vi.fn(),
  mockGetPendingCheckout: vi.fn(),
  mockMarkPendingCheckoutError: vi.fn(),
  mockConstructEvent: vi.fn(),
}));

vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
}));

vi.mock("@/lib/checkout-finalizer", () => ({
  finalizeReservation: mockFinalizeReservation,
  ReservationPendingRecoveryError: class ReservationPendingRecoveryError extends Error {},
}));

vi.mock("@/lib/pending-checkouts", () => ({
  getPendingCheckout: mockGetPendingCheckout,
  markPendingCheckoutError: mockMarkPendingCheckoutError,
}));

vi.mock("@/lib/server-tracking", () => ({
  subscribeToKlaviyoList: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

import { POST } from "./route";

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockSendAlert.mockResolvedValue(undefined);
    mockMarkPendingCheckoutError.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("rejects requests without a Stripe signature", async () => {
    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Stripe signature",
    });
  });

  it("finalizes a paid booking when a succeeded payment intent has a matching pending checkout", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_paid",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_paid",
          amount: 5793,
          metadata: { quoteId: "quote_123", guestEmail: "guest@example.com" },
        },
      },
    });
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_paid",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: { eventId: "purchase_evt" },
      upsells: ["late-checkout"],
      pets: 1,
    });
    mockFinalizeReservation.mockResolvedValue({
      reservationId: "res_123",
      status: "confirmed",
      chargedAmount: 57.93,
      eventId: "purchase_evt",
    });

    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: '{"id":"evt_paid"}',
      headers: {
        "stripe-signature": "sig_test",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockFinalizeReservation).toHaveBeenCalledWith({
      paymentIntentId: "pi_paid",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: { eventId: "purchase_evt" },
      upsells: ["late-checkout"],
      pets: 1,
    });
    await expect(response.json()).resolves.toEqual({ received: true });
  });

  it("marks failed payment intents without trying to finalize a reservation", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_failed",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_failed",
          status: "requires_payment_method",
          last_payment_error: {
            message: "Your card was declined.",
          },
        },
      },
    });

    const request = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: '{"id":"evt_failed"}',
      headers: {
        "stripe-signature": "sig_test",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockMarkPendingCheckoutError).toHaveBeenCalledWith(
      "pi_failed",
      "Your card was declined.",
      "payment_failed"
    );
    expect(mockFinalizeReservation).not.toHaveBeenCalled();
  });
});
