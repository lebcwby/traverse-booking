import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockStripeRetrieve,
  mockStripePiUpdate,
  mockStripeCustomerUpdate,
  mockRecordPayment,
  mockAddInvoiceItem,
  mockCreateReservationInstant,
  mockGetQuote,
  mockSendAlert,
  mockParseGA4SessionId,
  mockTrackBookingServerSide,
  mockCreateServerSupabaseClient,
  mockPoolQuery,
  mockGetSelectedUpsells,
  mockGetUpsellTotal,
  mockGetEffectiveServerConsent,
  mockMarkPendingCheckoutCompleted,
  mockMarkPendingCheckoutError,
  mockGetListing,
  mockIsAlreadySettledPaymentError,
} = vi.hoisted(() => ({
  mockStripeRetrieve: vi.fn(),
  mockStripePiUpdate: vi.fn(),
  mockStripeCustomerUpdate: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockAddInvoiceItem: vi.fn(),
  mockCreateReservationInstant: vi.fn(),
  mockGetQuote: vi.fn(),
  mockSendAlert: vi.fn(),
  mockParseGA4SessionId: vi.fn(),
  mockTrackBookingServerSide: vi.fn(),
  mockCreateServerSupabaseClient: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockGetSelectedUpsells: vi.fn(),
  mockGetUpsellTotal: vi.fn(),
  mockGetEffectiveServerConsent: vi.fn(),
  mockMarkPendingCheckoutCompleted: vi.fn(),
  mockMarkPendingCheckoutError: vi.fn(),
  mockGetListing: vi.fn(),
  mockIsAlreadySettledPaymentError: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    paymentIntents: {
      retrieve: mockStripeRetrieve,
      update: mockStripePiUpdate,
    },
    customers: {
      update: mockStripeCustomerUpdate,
    },
  }),
}));

vi.mock("@/lib/guesty-openapi", () => ({
  recordPayment: mockRecordPayment,
  addInvoiceItem: mockAddInvoiceItem,
  isAlreadySettledPaymentError: mockIsAlreadySettledPaymentError,
}));

vi.mock("@/lib/guesty-beapi", () => ({
  createReservationInstant: mockCreateReservationInstant,
  getQuote: mockGetQuote,
}));

vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
  sendBookingConfirmation: vi.fn(async () => {}),
  buildStripeDashboardPaymentUrl: vi.fn(
    (paymentIntentId: string) =>
      `https://dashboard.stripe.com/payments/${paymentIntentId}`
  ),
  formatDurationMs: vi.fn((durationMs: number) => `${durationMs}ms`),
  renderAlertDetails: vi.fn(() => "<table></table>"),
  renderAlertLinks: vi.fn(() => "<ul></ul>"),
}));

vi.mock("@/lib/server-tracking", () => ({
  parseGA4SessionId: mockParseGA4SessionId,
  trackBookingServerSide: mockTrackBookingServerSide,
}));

vi.mock("@/lib/supabase-auth-server", () => ({
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    query: mockPoolQuery,
  }),
  withAdvisoryLock: async <T>(_key: string, fn: () => Promise<T>) => fn(),
}));

vi.mock("@/lib/upsells", () => ({
  getSelectedUpsells: mockGetSelectedUpsells,
  getUpsellTotal: mockGetUpsellTotal,
}));

vi.mock("@/lib/consent", () => ({
  getEffectiveServerConsent: mockGetEffectiveServerConsent,
}));

vi.mock("@/lib/pending-checkouts", () => ({
  markPendingCheckoutCompleted: mockMarkPendingCheckoutCompleted,
  markPendingCheckoutError: mockMarkPendingCheckoutError,
}));

vi.mock("@/lib/supabase", () => ({
  getListing: mockGetListing,
}));

import {
  ReservationPendingRecoveryError,
  finalizeReservation,
  recordPaymentWithIndexingRetry,
} from "./checkout-finalizer";

describe("finalizeReservation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));

    mockStripeRetrieve.mockResolvedValue({
      id: "pi_test",
      status: "succeeded",
      amount: 5793,
      metadata: { quoteId: "quote_123", baseAmountCents: "5793" },
      payment_method: "pm_123",
      customer: "cus_123",
    });
    mockStripePiUpdate.mockResolvedValue(undefined);
    mockStripeCustomerUpdate.mockResolvedValue(undefined);
    mockRecordPayment.mockResolvedValue(undefined);
    mockAddInvoiceItem.mockResolvedValue(undefined);
    mockSendAlert.mockResolvedValue(undefined);
    mockParseGA4SessionId.mockReturnValue(undefined);
    mockTrackBookingServerSide.mockResolvedValue(undefined);
    mockCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user_123" } },
        }),
      },
    });
    mockGetSelectedUpsells.mockReturnValue([]);
    mockGetUpsellTotal.mockReturnValue(0);
    mockGetEffectiveServerConsent.mockReturnValue(null);
    mockMarkPendingCheckoutCompleted.mockResolvedValue(undefined);
    mockMarkPendingCheckoutError.mockResolvedValue(undefined);
    mockGetQuote.mockResolvedValue({
      unitTypeId: "listing_1",
      checkInDateLocalized: "2026-04-20",
      checkOutDateLocalized: "2026-04-23",
      guestsCount: 2,
      rates: {
        ratePlans: [
          {
            ratePlan: {
              _id: "rate_plan_1",
              money: {
                hostPayout: 57.93,
              },
            },
          },
        ],
      },
    });
    mockGetListing.mockResolvedValue({
      title: "Test Home",
      nickname: "Test Home",
      picture: "https://example.com/home.jpg",
      property_type: "house",
      address: { city: "Portland" },
    });
    mockIsAlreadySettledPaymentError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns the existing reservation when the payment intent was already finalized", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "res_existing",
          confirmation_code: "ABC123",
          status: "confirmed",
        },
      ],
    });

    const result = await finalizeReservation({
      paymentIntentId: "pi_test",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        eventId: "purchase_existing",
        listingId: "listing_1",
        listingTitle: "Test Home",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
      },
    });

    expect(result).toMatchObject({
      reservationId: "res_existing",
      confirmationCode: "ABC123",
      status: "confirmed",
      duplicate: true,
      chargedAmount: 57.93,
      eventId: "purchase_existing",
    });
    expect(mockMarkPendingCheckoutCompleted).toHaveBeenCalledWith(
      "pi_test",
      "res_existing"
    );
    expect(mockCreateReservationInstant).not.toHaveBeenCalled();
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it("marks the booking as paid pending recovery after repeated Guesty reservation failures", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    mockCreateReservationInstant.mockRejectedValue(new Error("Guesty outage"));

    const promise = finalizeReservation({
      paymentIntentId: "pi_test",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
      },
    });

    const rejection = expect(promise).rejects.toBeInstanceOf(
      ReservationPendingRecoveryError
    );
    await vi.runAllTimersAsync();

    await rejection;
    expect(mockCreateReservationInstant).toHaveBeenCalledTimes(3);
    expect(mockMarkPendingCheckoutError).toHaveBeenCalledWith(
      "pi_test",
      expect.stringContaining("Guesty outage"),
      "paid_pending_reservation"
    );
    expect(mockSendAlert).toHaveBeenCalledWith(
      "PAID BOOKING NEEDS MANUAL RECOVERY",
      expect.stringContaining(
        "Guesty reservation creation still failed after the in-request retries."
      ),
      "paid-booking-manual-recovery-pi_test"
    );
    expect(mockRecordPayment).not.toHaveBeenCalled();
    expect(mockMarkPendingCheckoutCompleted).not.toHaveBeenCalled();
  });

  it("creates, records, and completes a successful reservation", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });
    mockCreateReservationInstant.mockResolvedValue({
      _id: "res_created",
      confirmationCode: "CONF123",
      status: "confirmed",
      guestId: "guest_1",
      checkInDateLocalized: "2026-04-20",
      checkOutDateLocalized: "2026-04-23",
    });

    const result = await finalizeReservation({
      paymentIntentId: "pi_test",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        eventId: "purchase_pi_test",
      },
      cookies: {
        ga: "GA1.1.123.456",
      },
    });

    expect(result).toMatchObject({
      reservationId: "res_created",
      confirmationCode: "CONF123",
      status: "confirmed",
      chargedAmount: 57.93,
      eventId: "purchase_pi_test",
    });
    expect(mockCreateReservationInstant).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: "quote_123",
        ratePlanId: "rate_plan_1",
        ccToken: "pm_123",
      })
    );
    expect(mockPoolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO reservations"),
      expect.any(Array)
    );
    expect(mockRecordPayment).toHaveBeenCalledWith(
      "res_created",
      57.93,
      "pi_test",
      {
        retries: 1,
        timeoutMs: 5000,
      }
    );
    expect(mockTrackBookingServerSide).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "res_created",
        total: 57.93,
      }),
      { consent: undefined }
    );
    expect(mockMarkPendingCheckoutCompleted).toHaveBeenCalledWith(
      "pi_test",
      "res_created"
    );
    expect(mockStripeCustomerUpdate).toHaveBeenCalledWith(
      "cus_123",
      expect.objectContaining({
        email: "guest@example.com",
        phone: "5035551212",
      })
    );
    expect(mockStripePiUpdate).toHaveBeenCalledWith(
      "pi_test",
      expect.objectContaining({
        metadata: expect.objectContaining({
          confirmationCode: "CONF123",
          guestyReservationId: "res_created",
        }),
      })
    );
  });

  it("skips Guesty extras when Stripe did not charge for them", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });
    mockCreateReservationInstant.mockResolvedValue({
      _id: "res_created",
      confirmationCode: "CONF123",
      status: "confirmed",
      guestId: "guest_1",
      checkInDateLocalized: "2026-04-20",
      checkOutDateLocalized: "2026-04-23",
    });
    mockGetSelectedUpsells.mockReturnValue([
      {
        id: "early-checkin",
        title: "Early Check-in (1 PM)",
        amount: 50,
        normalType: "AFE",
        secondIdentifier: "EARLY_CHECK_IN",
        accountFeeId: "fee_123",
      },
    ]);
    mockGetUpsellTotal.mockReturnValue(50);

    const result = await finalizeReservation({
      paymentIntentId: "pi_test",
      quoteId: "quote_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        eventId: "purchase_pi_test",
      },
      upsells: ["early-checkin"],
      pets: 1,
    });

    expect(mockAddInvoiceItem).not.toHaveBeenCalled();
    expect(mockSendAlert).toHaveBeenCalledWith(
      "UNPAID EXTRAS BLOCKED FROM GUESTY",
      expect.stringContaining("Stripe did not actually charge for them."),
      "unpaid-extras-blocked-pi_test"
    );
    expect(result).toMatchObject({
      reservationId: "res_created",
      chargedAmount: 57.93,
      appliedUpsells: [],
      appliedPets: 0,
      upsellStatus: {
        charged: 0,
        errors: [
          expect.stringContaining(
            "Skipping extras because Stripe charged $57.93"
          ),
        ],
      },
    });
    expect(mockRecordPayment).toHaveBeenCalledWith(
      "res_created",
      57.93,
      "pi_test",
      {
        retries: 1,
        timeoutMs: 5000,
      }
    );
  });
});

describe("recordPaymentWithIndexingRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRecordPayment.mockReset();
    mockIsAlreadySettledPaymentError.mockReset();
    mockIsAlreadySettledPaymentError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on first-attempt success", async () => {
    mockRecordPayment.mockResolvedValueOnce(undefined);

    await expect(
      recordPaymentWithIndexingRetry("res_1", 100, "pi_1")
    ).resolves.toBeUndefined();

    expect(mockRecordPayment).toHaveBeenCalledTimes(1);
  });

  it("retries through the indexing race and eventually succeeds", async () => {
    // Three failures (attempts 1, 2, 3) then success on attempt 4
    mockRecordPayment
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockResolvedValueOnce(undefined);

    const promise = recordPaymentWithIndexingRetry("res_2", 100, "pi_2");
    // Attempts complete instantly (mocked); only the inter-attempt delays consume fake time.
    // Backoffs after attempts 1, 2, 3 = 1000 + 2000 + 3000 = 6000ms.
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toBeUndefined();

    expect(mockRecordPayment).toHaveBeenCalledTimes(4);
  });

  it("returns immediately when isAlreadySettledPaymentError matches", async () => {
    mockRecordPayment.mockRejectedValueOnce(
      new Error("Payment amount can't be greater than balance due")
    );
    mockIsAlreadySettledPaymentError.mockReturnValueOnce(true);

    await expect(
      recordPaymentWithIndexingRetry("res_3", 100, "pi_3")
    ).resolves.toBeUndefined();

    expect(mockRecordPayment).toHaveBeenCalledTimes(1);
  });

  it("throws after the budget is exhausted", async () => {
    // 6 failures (initial attempt + 5 retries — total of 6 attempts)
    for (let i = 0; i < 6; i++) {
      mockRecordPayment.mockRejectedValueOnce(new Error("Guesty 500"));
    }

    const promise = recordPaymentWithIndexingRetry("res_4", 100, "pi_4");
    // Suppress unhandled rejection warning while we advance timers
    promise.catch(() => {});
    // Sum of all backoffs: 1000+2000+3000+4000+5000 = 15000ms
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow("Guesty 500");

    expect(mockRecordPayment).toHaveBeenCalledTimes(6);
  });
});
