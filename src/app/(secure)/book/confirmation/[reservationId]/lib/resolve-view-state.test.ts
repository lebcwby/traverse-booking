import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockPoolQuery,
  mockLookupAuthUserByEmail,
  mockRetrievePaymentIntent,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockLookupAuthUserByEmail: vi.fn(),
  mockRetrievePaymentIntent: vi.fn(),
}));

vi.mock("@/lib/supabase-auth-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

vi.mock("@/lib/auth-lookup", () => ({
  lookupAuthUserByEmail: mockLookupAuthUserByEmail,
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    paymentIntents: { retrieve: mockRetrievePaymentIntent },
  }),
}));

import {
  AuthResolutionError,
  ReservationNotFoundError,
  resolveViewState,
} from "./resolve-view-state";

const RES_ROW = {
  guesty_id: "res_123",
  confirmation_code: "GY-RES12345",
  user_id: null,
  guest: { email: "alex@example.com", firstName: "Alex" },
  listing_id: "listing_abc",
  listing_title: "The Pomeroy",
  listing_picture: "https://cloudinary/abc.jpg",
  check_in: "2026-04-17",
  check_out: "2026-04-20",
  guests_count: 2,
  money: {
    subTotalPrice: 612,
    fareCleaning: 95,
    totalTaxes: 78.42,
    totalPaid: 785.42,
    currency: "USD",
  },
};

beforeEach(() => {
  mockGetUser.mockReset();
  mockPoolQuery.mockReset();
  mockLookupAuthUserByEmail.mockReset();
  mockRetrievePaymentIntent.mockReset();
  // Default: no PI on the row means no Stripe lookup happens, but if a test
  // does set stripe_payment_intent_id, surface a minimal retrievable object
  // so we don't have to mock it in every test.
  mockRetrievePaymentIntent.mockResolvedValue({
    payment_method: {
      card: { brand: "visa", last4: "4242" },
    },
    latest_charge: {
      created: 1775588683,
      receipt_url: "https://pay.stripe.com/receipts/test",
      payment_method_details: { card: { brand: "visa", last4: "4242" } },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveViewState", () => {
  it("returns guest state for anonymous user with no existing account", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: false,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("guest");
    if (state.kind === "guest") {
      expect(state.data.confirmationCode).toBe("GY-RES12345");
      expect(state.data.money?.hasDetailedBreakdown).toBe(true);
    }
  });

  it("returns existing-account state for anonymous user with matching auth account", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: true,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("existing-account");
  });

  it("returns owner state when logged-in user's id matches reservation.user_id", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user_xyz", email: "alex@example.com" } },
      error: null,
    });
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ ...RES_ROW, user_id: "user_xyz" }],
      rowCount: 1,
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("owner");
    if (state.kind === "owner") {
      expect(state.firstName).toBe("Alex");
    }
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockLookupAuthUserByEmail).not.toHaveBeenCalled();
  });

  it("returns owner state when user_id is null but email matches, and backfills user_id with a guarded query", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user_xyz", email: "ALEX@EXAMPLE.COM" } },
      error: null,
    });
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [RES_ROW], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("owner");
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    const updateCall = mockPoolQuery.mock.calls[1];
    expect(updateCall[0]).toContain("UPDATE reservations");
    expect(updateCall[0]).toContain("lower(guest->>'email') = lower($3)");
    expect(updateCall[1]).toEqual(["user_xyz", "res_123", "alex@example.com"]);
  });

  it("returns stranger state when logged-in user does not own the reservation", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user_other", email: "bob@example.com" } },
      error: null,
    });
    mockPoolQuery.mockResolvedValue({
      rows: [{ ...RES_ROW, user_id: "user_xyz" }],
      rowCount: 1,
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("stranger");
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("throws ReservationNotFoundError when reservation does not exist (after retries)", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      const promise = resolveViewState("missing");
      // Attach a synchronous .catch so the rejection (which fires once timers
      // are advanced) doesn't surface as an unhandled rejection while we wait.
      const captured = promise.catch((err) => err);
      await vi.runAllTimersAsync();

      const result = await captured;
      expect(result).toBeInstanceOf(ReservationNotFoundError);
      // Confirms the row-fetch was retried instead of failing fast.
      expect(mockPoolQuery.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers when the row is missing on first attempt then appears on retry", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [RES_ROW], rowCount: 1 });
      mockLookupAuthUserByEmail.mockResolvedValue({
        exists: false,
        providers: [],
      });

      const promise = resolveViewState("res_123");
      await vi.runAllTimersAsync();

      const state = await promise;
      expect(state.kind).toBe("guest");
      expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws AuthResolutionError when getUser returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "boom" },
    });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });

    await expect(resolveViewState("res_123")).rejects.toBeInstanceOf(
      AuthResolutionError
    );
  });

  it("throws AuthResolutionError when getUser throws", async () => {
    mockGetUser.mockRejectedValue(new Error("boom"));
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });

    await expect(resolveViewState("res_123")).rejects.toBeInstanceOf(
      AuthResolutionError
    );
  });

  it("marks money with only totalPaid as lacking a detailed breakdown", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockPoolQuery.mockResolvedValue({
      rows: [
        {
          ...RES_ROW,
          money: {
            totalPaid: 785.42,
            currency: "USD",
          },
        },
      ],
      rowCount: 1,
    });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: false,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("guest");
    if (state.kind === "guest") {
      expect(state.data.money).toEqual({
        total: 785.42,
        currency: "USD",
        stay: null,
        cleaning: null,
        taxes: null,
        hasDetailedBreakdown: false,
      });
    }
  });

  it("marks money with detailed fields as having a breakdown", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: false,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("guest");
    if (state.kind === "guest") {
      expect(state.data.money?.hasDetailedBreakdown).toBe(true);
      expect(state.data.money?.stay).toBe(612);
    }
  });

  it("matches owner state case-insensitively by email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user_xyz", email: "ALEX@example.com" } },
      error: null,
    });
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [RES_ROW], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("owner");
    expect(mockPoolQuery.mock.calls[1][1]).toEqual([
      "user_xyz",
      "res_123",
      "alex@example.com",
    ]);
  });

  it("treats AuthSessionMissingError by name as anonymous", async () => {
    const error = new Error("Auth session missing");
    error.name = "AuthSessionMissingError";

    mockGetUser.mockResolvedValue({
      data: { user: null },
      error,
    });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: false,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("guest");
  });

  it("treats auth-session-missing messages as anonymous", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    });
    mockPoolQuery.mockResolvedValue({ rows: [RES_ROW], rowCount: 1 });
    mockLookupAuthUserByEmail.mockResolvedValue({
      exists: false,
      providers: [],
    });

    const state = await resolveViewState("res_123");

    expect(state.kind).toBe("guest");
  });
});
