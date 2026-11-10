// Tests for src/lib/pending-checkouts.ts — the SQL layer that backs the
// payment-intent → checkout-finalizer handoff and the abandoned-cart
// recovery cron.
//
// Coverage focus:
//   - DB-failure tolerance on upsert + get (regression: the booking flow
//     must NOT break if pending_checkouts writes fail — see the explicit
//     try/catch wrappers + "non-critical" log message). Pre-CT (2026-05-22),
//     a missing RLS insert policy 500'd the route via a digest 1610546075
//     when the mention firing hit. The wrapping was added to defend
//     against that class of bug.
//   - mapRow handles missing optional columns without crashing.
//   - normalizePets clamps 0 / negative / undefined / NaN to 0.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoist a shared mock pool so we can swap behavior per-test.
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Booking-identity stubs are deterministic functions; mock them so tests
// don't depend on hash-salt env vars.
vi.mock("@/lib/booking-identity", () => ({
  buildStayKey: () => "stay-key-stub",
  buildGuestIdentityKey: () => "guest-key-stub",
  buildBookingFingerprint: () => "fingerprint-stub",
}));

import {
  getPendingCheckout,
  listRecoverablePendingCheckouts,
  markPendingCheckoutCompleted,
  upsertPendingCheckout,
} from "./pending-checkouts";

const BASE_INPUT = {
  paymentIntentId: "pi_test_abc",
  quoteId: "quote_def",
  ratePlanId: "rp_ghi",
  stripeCustomerId: null,
  guest: {
    firstName: "Nadim",
    lastName: "Tannous",
    email: "nadim@example.com",
    phone: "+15035551234",
  },
  tracking: {
    listingId: "listing_xyz",
    listingTitle: "The Plaza 441",
    listingNickname: "Plaza 441",
    picture: null,
    propertyType: "Condo",
    city: "Mt. Crested Butte",
    checkIn: "2026-06-16",
    checkOut: "2026-06-19",
    guests: 2,
    stayTotal: 869.2,
    totalPaid: 869.2,
  },
  upsells: ["early-check-in"],
  pets: 0,
};

describe("upsertPendingCheckout — DB-failure tolerance", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("happy path: forwards values into the INSERT … ON CONFLICT UPDATE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await upsertPendingCheckout(BASE_INPUT);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("pi_test_abc"); // payment_intent_id
    expect(params[1]).toBe("quote_def"); // quote_id
    expect(JSON.parse(params[4])).toMatchObject({ email: "nadim@example.com" });
    // pets normalized to 0 via normalizePets, not pre-coerced
    expect(params[7]).toBe(0);
  });

  it("swallows db errors instead of propagating (booking flow must continue)", async () => {
    // Regression: 2026-05-22 mention-firing 500 with digest 1610546075.
    // The route's upsertPendingCheckout call MUST NOT throw, otherwise an
    // RLS misconfig / connection blip blocks the checkout entirely.
    mockQuery.mockRejectedValueOnce(new Error("RLS denied"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(upsertPendingCheckout(BASE_INPUT)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/PendingCheckout.*DB write failed/i),
      expect.any(String)
    );
    warn.mockRestore();
  });

  it("normalizes negative / undefined / NaN pets to 0", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await upsertPendingCheckout({ ...BASE_INPUT, pets: -2 });
    expect(mockQuery.mock.calls[0][1][7]).toBe(0);
    mockQuery.mockClear();

    await upsertPendingCheckout({ ...BASE_INPUT, pets: undefined });
    expect(mockQuery.mock.calls[0][1][7]).toBe(0);
    mockQuery.mockClear();

    await upsertPendingCheckout({ ...BASE_INPUT, pets: NaN });
    expect(mockQuery.mock.calls[0][1][7]).toBe(0);
  });

  // 2026-10-17: the website charges nothing for pets. This used to assert the
  // opposite — that a positive count was preserved — which is precisely the
  // path that let a pet fee reach checkout.
  it("forces a positive pets value to 0 — the website never charges for pets", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await upsertPendingCheckout({ ...BASE_INPUT, pets: 2 });
    expect(mockQuery.mock.calls[0][1][7]).toBe(0);
  });

  it("stringifies trackingContext as JSON when present", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await upsertPendingCheckout({
      ...BASE_INPUT,
      trackingContext: {
        cookies: { attribution: "google" },
        requestContext: { clientIp: "1.2.3.4" },
      },
    });
    const params = mockQuery.mock.calls[0][1];
    // tracking_context is the LAST parameter ($13)
    const ctxJson = params[12];
    expect(JSON.parse(ctxJson as string)).toEqual({
      cookies: { attribution: "google" },
      requestContext: { clientIp: "1.2.3.4" },
    });
  });
});

describe("getPendingCheckout", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns null when the row doesn't exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPendingCheckout("pi_missing")).toBeNull();
  });

  it("maps a complete row into PendingCheckoutRecord shape", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          payment_intent_id: "pi_test_abc",
          quote_id: "quote_def",
          rate_plan_id: "rp_ghi",
          stripe_customer_id: "cus_123",
          guest: { firstName: "Nadim", lastName: "T", email: "n@x.com" },
          tracking: {
            listingId: "l_1",
            listingTitle: "Title",
            checkIn: "2026-06-16",
            checkOut: "2026-06-19",
            guests: 2,
          },
          upsells: ["early-check-in"],
          pets: 1,
          quote_snapshot: { total: 100 },
          stay_key: "stay-1",
          guest_identity_key: "gid-1",
          booking_fingerprint: "fp-1",
          status: "pending",
          reservation_id: null,
          last_error: null,
          created_at: "2026-05-27T00:00:00Z",
          updated_at: "2026-05-27T00:00:00Z",
          completed_at: null,
        },
      ],
    });
    const out = await getPendingCheckout("pi_test_abc");
    expect(out).not.toBeNull();
    expect(out?.paymentIntentId).toBe("pi_test_abc");
    expect(out?.stripeCustomerId).toBe("cus_123");
    expect(out?.pets).toBe(1);
    expect(out?.upsells).toEqual(["early-check-in"]);
    expect(out?.reservationId).toBeNull();
  });

  it("fills sensible defaults when nullable columns are missing", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          payment_intent_id: "pi_min",
          quote_id: "q_min",
          rate_plan_id: null,
          stripe_customer_id: null,
          guest: null,
          tracking: null,
          upsells: null,
          pets: null,
          quote_snapshot: null,
          stay_key: null,
          guest_identity_key: null,
          booking_fingerprint: null,
          status: "pending",
          reservation_id: null,
          last_error: null,
          created_at: "2026-05-27T00:00:00Z",
          updated_at: "2026-05-27T00:00:00Z",
          completed_at: null,
        },
      ],
    });
    const out = await getPendingCheckout("pi_min");
    expect(out).not.toBeNull();
    expect(out?.guest).toEqual({ firstName: "", lastName: "", email: "" });
    expect(out?.tracking.listingId).toBe("");
    expect(out?.upsells).toEqual([]);
    expect(out?.pets).toBe(0);
    expect(out?.stayKey).toBeNull();
  });

  it("returns null on db error rather than throwing", async () => {
    // Regression: GET must be as forgiving as POST. /api/payment-intent
    // wraps this in a `.catch(() => null)` but defense-in-depth — getPendingCheckout
    // already swallows + returns null directly.
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getPendingCheckout("pi_error")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("markPendingCheckoutCompleted", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("fires the UPDATE with reservation_id + completed_at", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await markPendingCheckoutCompleted("pi_test_abc", "RES-12345");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/status = 'completed'/);
    expect(sql).toMatch(/reservation_id = \$2/);
    expect(params).toEqual(["pi_test_abc", "RES-12345"]);
  });
});

// 2026-11-10: pi_3UZX3uFlSHWQrCQq1wzui10S had $477.44 captured, no
// reservation, and silently dropped out of this query at the 48-hour mark —
// ~25 minutes before the fix that would have rescued it (#126) deployed.
// The age cap now applies to abandoned `pending` carts only. These tests
// guard the SHAPE of the predicate, so a future "simplification" back to one
// blanket `created_at >` filter fails here rather than in production.
describe("listRecoverablePendingCheckouts — recovery window", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // The status group is the only place an age filter is allowed to live.
  const statusGroup = (sql: string) => {
    const match = sql.match(/AND\s*\(([\s\S]*?)\)\s*ORDER BY/);
    if (!match) throw new Error("no parenthesized status group in predicate");
    return match[1];
  };

  it("never age-caps a paid row, and still age-caps an abandoned cart", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listRecoverablePendingCheckouts();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];

    const group = statusGroup(sql);
    const branches = group.split(/\bOR\b/);
    const paid = branches.filter((b) => b.includes("paid_pending_reservation"));
    const abandoned = branches.filter(
      (b) => b.includes("'pending'") && !b.includes("paid_pending_reservation")
    );

    expect(paid).toHaveLength(1);
    expect(abandoned).toHaveLength(1);
    // Captured money is retried forever; an abandoned cart expires.
    expect(paid[0]).not.toMatch(/interval/);
    expect(abandoned[0]).toMatch(/created_at > now\(\) - interval '2 days'/);
  });

  it("bounds a paid row by its stay date, not its age", async () => {
    // Guesty refuses a quote whose checkIn is before today in the listing's
    // timezone, so a paid row for a past stay can never finalize and must
    // stop consuming BEAPI calls. pi_3UHMk9FlSHWQrCQq1KcrL7Fe ($217.63, a
    // 2026-09-20 stay) is the row this clause exists to drop.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listRecoverablePendingCheckouts();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];

    const paid = statusGroup(sql)
      .split(/\bOR\b/)
      .find((b) => b.includes("paid_pending_reservation"))!;

    expect(paid).toMatch(/tracking->>'checkIn'/);
    expect(paid).toMatch(/America\/Denver/);
    // A missing checkIn must NOT silently drop the row — bias toward
    // recovering a booking the guest already paid for.
    expect(paid).toMatch(/9999-12-31/);
  });

  it("keeps the age filter out of the top-level conjunction", async () => {
    // Regression guard: an `AND created_at > ...` sitting outside the status
    // group would re-cap paid rows no matter how the group is written.
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listRecoverablePendingCheckouts();
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql.replace(statusGroup(sql), "")).not.toMatch(/interval/);
  });

  it("excludes rows that already have a reservation and honors the limit", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await listRecoverablePendingCheckouts(5);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/reservation_id IS NULL/);
    expect(params).toEqual([5]);
  });

  it("maps returned rows through mapRow", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          payment_intent_id: "pi_stuck",
          quote_id: "q_stuck",
          guest: { firstName: "", lastName: "", email: "guest@example.com" },
          tracking: { listingId: "l_1", checkIn: "2026-12-13" },
          status: "paid_pending_reservation",
          reservation_id: null,
          created_at: "2026-11-08T14:27:14Z",
          updated_at: "2026-11-08T14:27:14Z",
        },
      ],
    });
    const out = await listRecoverablePendingCheckouts();
    expect(out).toHaveLength(1);
    expect(out[0].paymentIntentId).toBe("pi_stuck");
    expect(out[0].status).toBe("paid_pending_reservation");
    expect(out[0].guest.firstName).toBe("");
  });
});

describe("interactions between behaviors", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("after an upsert failure, a subsequent get still works (separate try/catch)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockQuery.mockRejectedValueOnce(new Error("rls denied"));
    await upsertPendingCheckout(BASE_INPUT);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getPendingCheckout("pi_test_abc")).toBeNull();
    warn.mockRestore();
  });
});
