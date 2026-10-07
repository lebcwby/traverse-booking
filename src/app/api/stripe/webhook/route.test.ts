import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockSendAlert,
  mockFinalizeReservation,
  mockGetPendingCheckout,
  mockMarkPendingCheckoutError,
  mockConstructEvent,
  mockGetPendingCartCheckout,
  mockPaymentIntentsSearch,
} = vi.hoisted(() => ({
  mockSendAlert: vi.fn(),
  mockFinalizeReservation: vi.fn(),
  mockGetPendingCheckout: vi.fn(),
  mockMarkPendingCheckoutError: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockGetPendingCartCheckout: vi.fn(),
  mockPaymentIntentsSearch: vi.fn(),
}));

vi.mock("@/lib/cart/pending-cart-checkouts", () => ({
  getPendingCartCheckoutByPaymentIntent: mockGetPendingCartCheckout,
}));

// Keep the real module's constants (OPS_ALERT_INBOX) and mock only the
// sender, so the assertions below compare against the address the app
// actually ships rather than one restated in the test.
vi.mock("@/lib/alerts", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/alerts")>()),
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
    paymentIntents: {
      search: mockPaymentIntentsSearch,
    },
  }),
}));

import { OPS_ALERT_INBOX } from "@/lib/alerts";
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

  // ── Shared-Stripe-account filtering ──────────────────────────────────────
  // SuiteOp posts damage-waiver charges through the same Stripe account. Each
  // one used to email "PAID BOOKING MISSING PENDING CHECKOUT" with a
  // per-PaymentIntent alert key, so the hourly cooldown never collapsed them.

  function succeededEvent(
    id: string,
    metadata: Record<string, string>,
    amount = 800
  ) {
    return {
      id: `evt_${id}`,
      type: "payment_intent.succeeded",
      data: { object: { id, amount, metadata } },
    };
  }

  async function postWebhook() {
    return POST(
      new NextRequest("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: '{"id":"evt"}',
        headers: { "stripe-signature": "sig_test" },
      })
    );
  }

  it("ignores a third-party payment intent with no website metadata", async () => {
    mockConstructEvent.mockReturnValue(succeededEvent("pi_suiteop", {}));
    mockGetPendingCheckout.mockResolvedValue(null);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockSendAlert).not.toHaveBeenCalled();
    // The row lookup is skipped entirely — there is no reason to expect one.
    expect(mockGetPendingCheckout).not.toHaveBeenCalled();
    expect(mockFinalizeReservation).not.toHaveBeenCalled();
  });

  it("still alerts when a real website booking has no pending checkout row", async () => {
    mockConstructEvent.mockReturnValue(
      succeededEvent("pi_orphan", { quoteId: "quote_abc" }, 57_93)
    );
    mockGetPendingCheckout.mockResolvedValue(null);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockGetPendingCheckout).toHaveBeenCalledWith("pi_orphan");
    expect(mockSendAlert).toHaveBeenCalledWith(
      "PAID BOOKING MISSING PENDING CHECKOUT",
      expect.stringContaining("pi_orphan"),
      "missing-pending-checkout-pi_orphan",
      { to: OPS_ALERT_INBOX }
    );
  });

  it("still alerts when a website booking is missing guest details", async () => {
    mockConstructEvent.mockReturnValue(
      succeededEvent("pi_noguest", { quoteId: "quote_xyz" })
    );
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_noguest",
      quoteId: "quote_xyz",
      guest: { firstName: "", lastName: "", email: "", phone: "" },
    });

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockSendAlert).toHaveBeenCalledWith(
      "PAID BOOKING MISSING GUEST DETAILS",
      expect.stringContaining("pi_noguest"),
      "missing-pending-guest-pi_noguest",
      { to: OPS_ALERT_INBOX }
    );
    expect(mockFinalizeReservation).not.toHaveBeenCalled();
  });

  it("ignores a date-change payment intent — that flow finalizes itself", async () => {
    mockConstructEvent.mockReturnValue(
      succeededEvent("pi_datechange", {
        type: "date_change",
        reservationId: "res_1",
      })
    );

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockSendAlert).not.toHaveBeenCalled();
    expect(mockGetPendingCheckout).not.toHaveBeenCalled();
  });

  it("ignores a cart payment intent that has its pending cart row", async () => {
    mockConstructEvent.mockReturnValue(
      succeededEvent("pi_cart", { cartCheckout: "true", lineCount: "2" })
    );
    mockGetPendingCartCheckout.mockResolvedValue({
      cartId: "cart_1",
      status: "pending",
    });

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockGetPendingCartCheckout).toHaveBeenCalledWith("pi_cart");
    expect(mockSendAlert).not.toHaveBeenCalled();
    // Cart rows live in pending_cart_checkouts, never pending_checkouts.
    expect(mockGetPendingCheckout).not.toHaveBeenCalled();
  });

  it("alerts with the cart-specific subject when a cart payment has no row", async () => {
    mockConstructEvent.mockReturnValue(
      succeededEvent("pi_cart_orphan", { cartCheckout: "true", lineCount: "3" })
    );
    mockGetPendingCartCheckout.mockResolvedValue(null);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(mockSendAlert).toHaveBeenCalledWith(
      "PAID CART MISSING PENDING CHECKOUT",
      expect.stringContaining("pi_cart_orphan"),
      "missing-pending-cart-pi_cart_orphan",
      { to: OPS_ALERT_INBOX }
    );
  });

  // ── Double-charge detection ──────────────────────────────────────────────
  // This used to list PaymentIntents by Stripe CUSTOMER, so the commonest
  // duplicate of all went unseen: a guest who retries in a fresh session and
  // mints a new customer id. GY-Z6iXznfG was charged $793.58 twice on
  // 2026-10-07 under two customer ids and no alert fired.

  function succeededPi(
    id: string,
    customer: string | null,
    extra: Record<string, unknown> = {}
  ) {
    return {
      id,
      amount: 79_358,
      created: Math.floor(Date.now() / 1000),
      customer,
      status: "succeeded",
      metadata: {
        listingId: "listing_1",
        checkIn: "2026-10-11",
        checkOut: "2026-10-14",
      },
      ...extra,
    };
  }

  function staySucceededEvent(id: string, customer: string) {
    return {
      id: `evt_${id}`,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id,
          amount: 79_358,
          customer,
          metadata: {
            quoteId: "quote_dc",
            listingId: "listing_1",
            checkIn: "2026-10-11",
            checkOut: "2026-10-14",
          },
        },
      },
    };
  }

  it("alerts on two charges for one stay even under different Stripe customers", async () => {
    mockConstructEvent.mockReturnValue(
      staySucceededEvent("pi_second", "cus_NEW")
    );
    mockPaymentIntentsSearch.mockResolvedValue({
      data: [
        succeededPi("pi_first", "cus_ORIGINAL", {
          metadata: {
            listingId: "listing_1",
            checkIn: "2026-10-11",
            checkOut: "2026-10-14",
            confirmationCode: "GY-Z6iXznfG",
          },
        }),
        succeededPi("pi_second", "cus_NEW"),
      ],
    });
    mockGetPendingCheckout.mockResolvedValue(null);

    await postWebhook();

    const doubleCharge = mockSendAlert.mock.calls.find(
      (c) => c[0] === "POSSIBLE DOUBLE CHARGE"
    );
    expect(doubleCharge).toBeDefined();
    expect(doubleCharge?.[1]).toContain("pi_first");
    expect(doubleCharge?.[1]).toContain("pi_second");
    // Names the split explicitly — that's the tell that it was a retry.
    expect(doubleCharge?.[1]).toContain("2 different Stripe customers");
    // Cooldown is keyed per stay so both webhooks don't double-send.
    expect(doubleCharge?.[2]).toBe(
      "double-charge-listing_1-2026-10-11-2026-10-14"
    );
  });

  it("does not alert when the duplicate has already been refunded", async () => {
    mockConstructEvent.mockReturnValue(
      staySucceededEvent("pi_second", "cus_NEW")
    );
    mockPaymentIntentsSearch.mockResolvedValue({
      data: [
        succeededPi("pi_first", "cus_ORIGINAL", {
          latest_charge: {
            refunded: true,
            amount: 79_358,
            amount_refunded: 79_358,
          },
        }),
        succeededPi("pi_second", "cus_NEW"),
      ],
    });
    mockGetPendingCheckout.mockResolvedValue(null);

    await postWebhook();

    expect(
      mockSendAlert.mock.calls.find((c) => c[0] === "POSSIBLE DOUBLE CHARGE")
    ).toBeUndefined();
  });

  it("does not alert on a single charge for the stay", async () => {
    mockConstructEvent.mockReturnValue(
      staySucceededEvent("pi_only", "cus_ORIGINAL")
    );
    mockPaymentIntentsSearch.mockResolvedValue({
      data: [succeededPi("pi_only", "cus_ORIGINAL")],
    });
    mockGetPendingCheckout.mockResolvedValue(null);

    await postWebhook();

    expect(
      mockSendAlert.mock.calls.find((c) => c[0] === "POSSIBLE DOUBLE CHARGE")
    ).toBeUndefined();
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
