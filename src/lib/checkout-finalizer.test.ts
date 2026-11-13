import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockStripeRetrieve,
  mockStripePiUpdate,
  mockStripeCustomerUpdate,
  mockRecordPayment,
  mockRecordPaymentCapped,
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
  mockResolveAmountVsBalance,
  mockPaymentTargetColumnsExist,
} = vi.hoisted(() => ({
  mockStripeRetrieve: vi.fn(),
  mockStripePiUpdate: vi.fn(),
  mockStripeCustomerUpdate: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockRecordPaymentCapped: vi.fn(),
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
  mockResolveAmountVsBalance: vi.fn(),
  mockPaymentTargetColumnsExist: vi.fn(),
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
  recordPaymentCapped: mockRecordPaymentCapped,
  addInvoiceItem: mockAddInvoiceItem,
  isAlreadySettledPaymentError: mockIsAlreadySettledPaymentError,
  resolveAmountVsBalance: mockResolveAmountVsBalance,
}));

vi.mock("@/lib/db-features", () => ({
  paymentTargetColumnsExist: mockPaymentTargetColumnsExist,
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
  // resolvePetFeePerPet is called from finalizeReservationLocked when the PI
  // metadata has a petFeePerPet entry. Stub to 0 — tests that exercise pet
  // fees override this per-call.
  resolvePetFeePerPet: vi.fn(() => 0),
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
    // Default to the pre-migration schema so the existing happy-path tests
    // exercise the legacy code path they were written for.
    mockPaymentTargetColumnsExist.mockResolvedValue(false);
    mockRecordPaymentCapped.mockResolvedValue({
      outcome: "full",
      recordedCents: 5793,
    });
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
    // No alert from here. The row was marked, so recover-checkouts owns this
    // payment and raises an age-gated alert if it is STILL stuck after 15
    // minutes. Alerting immediately was a false alarm 52 times out of 54 in
    // the 30 days to 2026-10-09, which is how a genuinely stranded $217.63
    // went unnoticed for weeks.
    expect(mockSendAlert).not.toHaveBeenCalledWith(
      "PAID BOOKING NEEDS MANUAL RECOVERY",
      expect.anything(),
      expect.anything()
    );
    expect(mockRecordPayment).not.toHaveBeenCalled();
    expect(mockMarkPendingCheckoutCompleted).not.toHaveBeenCalled();
  });

  it("DOES alert immediately when the pending row could not be written", async () => {
    // The one case with no safety net: nothing recorded the payment, so
    // recover-checkouts will never see it and a human has to act now.
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockCreateReservationInstant.mockRejectedValue(new Error("Guesty outage"));
    mockMarkPendingCheckoutError.mockRejectedValue(new Error("db down"));

    const promise = finalizeReservation({
      paymentIntentId: "pi_orphan",
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

    expect(mockSendAlert).toHaveBeenCalledWith(
      "PAID BOOKING NEEDS MANUAL RECOVERY",
      expect.stringContaining("recovery cron will NOT pick this up"),
      "paid-booking-manual-recovery-pi_orphan"
    );
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
        // E.164 format — added 2026-05-16. Bare 10-digit numbers are silently
        // dropped by Guesty's API; we now normalize to E.164 at every API
        // boundary (Stripe accepts both but we send E.164 for consistency).
        phone: "+15035551212",
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

describe("recordPaymentWithIndexingRetry — legacy path (pre-migration)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRecordPayment.mockReset();
    mockIsAlreadySettledPaymentError.mockReset();
    mockIsAlreadySettledPaymentError.mockReturnValue(false);
    mockPaymentTargetColumnsExist.mockResolvedValue(false);
    mockSendAlert.mockReset();
    mockResolveAmountVsBalance.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns outcome:full and uses legacy recordPayment on first-attempt success", async () => {
    mockRecordPayment.mockResolvedValueOnce(undefined);

    await expect(
      recordPaymentWithIndexingRetry("res_1", 100, "pi_1")
    ).resolves.toEqual({ outcome: "full" });

    expect(mockRecordPayment).toHaveBeenCalledWith("res_1", 100, "pi_1", {
      retries: 1,
      timeoutMs: 5000,
    });
    expect(mockRecordPaymentCapped).not.toHaveBeenCalled();
  });

  it("retries through the indexing race and eventually succeeds", async () => {
    // Three failures (attempts 1, 2, 3) then success on attempt 4
    mockRecordPayment
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockRejectedValueOnce(new Error("OpenAPI 404 reservation not found"))
      .mockResolvedValueOnce(undefined);

    const promise = recordPaymentWithIndexingRetry("res_2", 100, "pi_2");
    await vi.advanceTimersByTimeAsync(6000);
    await expect(promise).resolves.toEqual({ outcome: "full" });

    expect(mockRecordPayment).toHaveBeenCalledTimes(4);
  });

  it("returns outcome:full when balance is 0 (truly settled) via resolveAmountVsBalance", async () => {
    mockRecordPayment.mockRejectedValueOnce(
      new Error("Payment amount can't be greater than balance due")
    );
    mockIsAlreadySettledPaymentError.mockReturnValueOnce(true);
    mockResolveAmountVsBalance.mockResolvedValueOnce({
      settled: true,
      mismatch: false,
    });

    await expect(
      recordPaymentWithIndexingRetry("res_3", 100, "pi_3")
    ).resolves.toEqual({ outcome: "full" });

    expect(mockRecordPayment).toHaveBeenCalledTimes(1);
    expect(mockResolveAmountVsBalance).toHaveBeenCalledWith(
      "res_3",
      100,
      "pi_3"
    );
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("returns outcome:full AND sends a mismatch alert when the legacy path records Guesty's balance", async () => {
    mockRecordPayment.mockRejectedValueOnce(
      new Error("Payment amount can't be greater than balance due")
    );
    mockIsAlreadySettledPaymentError.mockReturnValueOnce(true);
    mockResolveAmountVsBalance.mockResolvedValueOnce({
      settled: true,
      mismatch: true,
      originalAmount: 536.83,
      balanceAmount: 533.12,
      delta: 3.71,
    });

    await expect(
      recordPaymentWithIndexingRetry("res_mismatch", 536.83, "pi_mismatch")
    ).resolves.toEqual({ outcome: "full" });

    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert.mock.calls[0]?.[0]).toContain(
      "Payment amount mismatch"
    );
    expect(mockSendAlert.mock.calls[0]?.[2]).toBe(
      "amount-mismatch-res_mismatch"
    );
  });

  it("falls through to backoff retry if resolveAmountVsBalance itself fails", async () => {
    for (let i = 0; i < 6; i++) {
      mockRecordPayment.mockRejectedValueOnce(
        new Error("Payment amount can't be greater than balance due")
      );
    }
    mockIsAlreadySettledPaymentError.mockReturnValue(true);
    mockResolveAmountVsBalance.mockRejectedValue(
      new Error("Guesty OpenAPI unavailable")
    );

    const promise = recordPaymentWithIndexingRetry(
      "res_resolve_fail",
      100,
      "pi_resolve_fail"
    );
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow("Guesty OpenAPI unavailable");

    expect(mockRecordPayment).toHaveBeenCalledTimes(6);
  });

  it("throws after the budget is exhausted", async () => {
    for (let i = 0; i < 6; i++) {
      mockRecordPayment.mockRejectedValueOnce(new Error("Guesty 500"));
    }

    const promise = recordPaymentWithIndexingRetry("res_4", 100, "pi_4");
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow("Guesty 500");

    expect(mockRecordPayment).toHaveBeenCalledTimes(6);
  });
});

describe("recordPaymentWithIndexingRetry — new protocol (post-migration)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPoolQuery.mockReset();
    mockRecordPayment.mockReset();
    mockRecordPaymentCapped.mockReset();
    mockSendAlert.mockReset();
    mockPaymentTargetColumnsExist.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reserves via CAS, calls recordPaymentCapped, returns outcome:full", async () => {
    // 1) SELECT payment_recorded_cents (observed = 0)
    // 2) UPDATE CAS reserve → rowCount 1
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [{ payment_recorded_cents: 0 }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ new_recorded: 5793 }] });
    mockRecordPaymentCapped.mockResolvedValueOnce({
      outcome: "full",
      recordedCents: 5793,
    });

    await expect(
      recordPaymentWithIndexingRetry("res_new_full", 57.93, "pi_new")
    ).resolves.toEqual({ outcome: "full" });

    expect(mockRecordPaymentCapped).toHaveBeenCalledWith(
      "res_new_full",
      5793,
      "pi_new"
    );
    // Reserve UPDATE arguments: ($topupCents=5793, id, $observed=0)
    const reserveCall = mockPoolQuery.mock.calls[1];
    expect(reserveCall?.[0]).toMatch(/UPDATE reservations/);
    expect(reserveCall?.[1]?.[0]).toBe(5793);
    expect(reserveCall?.[1]?.[1]).toBe("res_new_full");
    expect(reserveCall?.[1]?.[2]).toBe(0);
  });

  it("records only the balance, reverts the overshoot, returns outcome:short, and fires no alert (writer caller handles it)", async () => {
    // Stripe captured $100 (10000c), Guesty balance was $50 (5000c).
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [{ payment_recorded_cents: 0 }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ new_recorded: 10000 }] })
      .mockResolvedValueOnce({ rowCount: 1 }); // revert
    mockRecordPaymentCapped.mockResolvedValueOnce({
      outcome: "short",
      recordedCents: 5000,
      shortfallCents: 5000,
      balanceCents: 5000,
    });

    const result = await recordPaymentWithIndexingRetry(
      "res_short",
      100,
      "pi_short"
    );
    expect(result).toEqual({
      outcome: "short",
      recordedCents: 5000,
      shortfallCents: 5000,
    });
    // Revert UPDATE: $overshoot = 10000 - 5000 = 5000
    const revertCall = mockPoolQuery.mock.calls[2];
    expect(revertCall?.[0]).toMatch(/UPDATE reservations/);
    expect(revertCall?.[1]?.[0]).toBe(5000);
    expect(revertCall?.[1]?.[1]).toBe("res_short");
  });

  it("reverts the full reservation when recordPaymentCapped returns no_op and retries through backoff", async () => {
    // Every attempt: SELECT observed, reserve UPDATE rowCount=1, revert UPDATE
    for (let i = 0; i < 6; i++) {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ payment_recorded_cents: 0 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });
      mockRecordPaymentCapped.mockResolvedValueOnce({ outcome: "no_op" });
    }

    const promise = recordPaymentWithIndexingRetry("res_noop", 100, "pi_noop");
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow(/recordPaymentCapped returned no_op/);
  });

  it("CAS lost (rowCount=0) short-circuits as no_op without calling Guesty", async () => {
    for (let i = 0; i < 6; i++) {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ payment_recorded_cents: 0 }] })
        .mockResolvedValueOnce({ rowCount: 0 });
    }

    const promise = recordPaymentWithIndexingRetry(
      "res_cas_lost",
      100,
      "pi_cas_lost"
    );
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow();
    expect(mockRecordPaymentCapped).not.toHaveBeenCalled();
  });

  it("recordPaymentCapped throwing reverts the reservation and bubbles up on the last attempt", async () => {
    for (let i = 0; i < 6; i++) {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ payment_recorded_cents: 0 }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 }); // revert on throw
      mockRecordPaymentCapped.mockRejectedValueOnce(new Error("Guesty 500"));
    }

    const promise = recordPaymentWithIndexingRetry(
      "res_throw",
      100,
      "pi_throw"
    );
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(15000);
    await expect(promise).rejects.toThrow("Guesty 500");
  });
});
