import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPaymentTargetColumnsExist,
  mockAttemptReserveAndRecord,
  mockPoolQuery,
  mockSendAlert,
  mockStripeRetrieve,
  mockRecordPayment,
  mockResolveAmountVsBalance,
  mockIsAlreadySettledPaymentError,
  mockIsTestModePaymentIntentError,
} = vi.hoisted(() => ({
  mockPaymentTargetColumnsExist: vi.fn(),
  mockAttemptReserveAndRecord: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockSendAlert: vi.fn().mockResolvedValue(undefined),
  mockStripeRetrieve: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockResolveAmountVsBalance: vi.fn(),
  mockIsAlreadySettledPaymentError: vi.fn().mockReturnValue(false),
  mockIsTestModePaymentIntentError: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

vi.mock("@/lib/db-features", () => ({
  paymentTargetColumnsExist: mockPaymentTargetColumnsExist,
}));

vi.mock("@/lib/checkout-finalizer", () => ({
  attemptReserveAndRecord: mockAttemptReserveAndRecord,
}));

vi.mock("@/lib/guesty-openapi", () => ({
  recordPayment: mockRecordPayment,
  resolveAmountVsBalance: mockResolveAmountVsBalance,
  isAlreadySettledPaymentError: mockIsAlreadySettledPaymentError,
  isTestModePaymentIntentError: mockIsTestModePaymentIntentError,
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    paymentIntents: { retrieve: mockStripeRetrieve },
  }),
}));

vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
  buildStripeDashboardPaymentUrl: (id: string) =>
    `https://dashboard.stripe.com/payments/${id}`,
  formatDurationMs: (ms: number) => `${ms}ms`,
  renderAlertDetails: () => "<table></table>",
  renderAlertLinks: () => "<ul></ul>",
}));

async function invoke() {
  process.env.CRON_SECRET = "test-secret";
  const { GET } = await import("./route");
  return GET(
    new Request("https://x/api/cron/record-payments", {
      headers: { authorization: "Bearer test-secret" },
    })
  );
}

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetModules();
  mockPoolQuery.mockReset();
  mockAttemptReserveAndRecord.mockReset();
  mockSendAlert.mockClear();
  mockStripeRetrieve.mockReset();
  mockRecordPayment.mockReset();
  mockResolveAmountVsBalance.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/cron/record-payments — new protocol", () => {
  beforeEach(() => {
    mockPaymentTargetColumnsExist.mockResolvedValue(true);
  });

  it("returns 'no pending payments' when the shortfall query is empty", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await invoke();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ count: 0 });
    expect(mockAttemptReserveAndRecord).not.toHaveBeenCalled();
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
  });

  it("tops up a fresh row to full and records the result", async () => {
    const now = Date.now();
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "r1",
          confirmation_code: "C1",
          stripe_payment_intent_id: "pi_1",
          payment_target_cents: 10000,
          payment_recorded_cents: 5000,
          payment_target_cents_set_at: now - 1 * DAY,
          check_in: "2026-11-15",
          check_out: "2026-11-18",
          guest: null,
          listing_title: "Home",
          listing_nickname: "home",
        },
      ],
    });
    mockAttemptReserveAndRecord.mockResolvedValueOnce({
      outcome: "full",
      recordedCents: 5000,
    });

    const res = await invoke();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.results[0]).toMatchObject({
      reservationId: "r1",
      status: expect.stringContaining("full"),
    });
    expect(mockAttemptReserveAndRecord).toHaveBeenCalledWith({
      reservationId: "r1",
      paymentIntentId: "pi_1",
      targetCents: 10000,
      observedCents: 5000,
    });
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
  });

  it("records 'still short' when top-up returns short and does NOT call Stripe", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "r2",
          confirmation_code: null,
          stripe_payment_intent_id: "pi_2",
          payment_target_cents: 10000,
          payment_recorded_cents: 5000,
          payment_target_cents_set_at: Date.now() - 2 * DAY,
          check_in: null,
          check_out: null,
          guest: null,
          listing_title: null,
          listing_nickname: null,
        },
      ],
    });
    mockAttemptReserveAndRecord.mockResolvedValueOnce({
      outcome: "short",
      recordedCents: 2000,
      shortfallCents: 3000,
      balanceCents: 2000,
    });

    const res = await invoke();
    const body = await res.json();
    expect(body.results[0].status).toMatch(/still short/);
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
  });

  it("stops retrying and fires the stale alert past the 30-day cutoff", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "r_stale",
          confirmation_code: "STALE",
          stripe_payment_intent_id: "pi_stale",
          payment_target_cents: 10000,
          payment_recorded_cents: 9500,
          payment_target_cents_set_at: Date.now() - 31 * DAY,
          check_in: null,
          check_out: null,
          guest: null,
          listing_title: "Lodge",
          listing_nickname: null,
        },
      ],
    });

    const res = await invoke();
    const body = await res.json();
    expect(body.results[0].status).toMatch(/stale/);
    expect(mockAttemptReserveAndRecord).not.toHaveBeenCalled();
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert.mock.calls[0]?.[2]).toBe("amount-short-stale-r_stale");
  });

  it("skips rows with no payment intent id", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "r_no_pi",
          stripe_payment_intent_id: null,
          payment_target_cents: 10000,
          payment_recorded_cents: 0,
          payment_target_cents_set_at: Date.now() - DAY,
          check_in: null,
          check_out: null,
          guest: null,
          confirmation_code: null,
          listing_title: null,
          listing_nickname: null,
        },
      ],
    });

    const res = await invoke();
    const body = await res.json();
    expect(body.results[0].status).toMatch(/no payment intent/);
    expect(mockAttemptReserveAndRecord).not.toHaveBeenCalled();
  });
});

describe("/api/cron/record-payments — legacy pre-migration path", () => {
  beforeEach(() => {
    mockPaymentTargetColumnsExist.mockResolvedValue(false);
  });

  it("falls through to the legacy query and retrieves PI amount from Stripe", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          guesty_id: "r_legacy",
          confirmation_code: "LGC",
          stripe_payment_intent_id: "pi_legacy",
          last_synced_at: Date.now() - 5 * 60 * 1000,
          status: "confirmed",
          check_in: "2026-11-15",
          check_out: "2026-11-17",
          guest: { email: "g@example.com" },
          listing_id: "lst",
          listing_title: "Home",
          listing_nickname: "home",
        },
      ],
    });
    mockStripeRetrieve.mockResolvedValueOnce({
      status: "succeeded",
      amount: 10000,
    });
    mockRecordPayment.mockResolvedValueOnce(undefined);
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await invoke();
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      reservationId: "r_legacy",
      status: "recorded",
    });
    expect(mockRecordPayment).toHaveBeenCalledWith(
      "r_legacy",
      100,
      "pi_legacy"
    );
  });
});
