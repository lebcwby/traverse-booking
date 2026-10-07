import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

import {
  getBookingStateForConfirmationCode,
  minutesSince,
  UNRESOLVED_CODED_PI_ACTIVE_WINDOW_MINUTES,
} from "./stay-booking-state";

describe("getBookingStateForConfirmationCode", () => {
  beforeEach(() => mockQuery.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("reports a confirmed reservation as active — it still holds the dates", async () => {
    mockQuery.mockResolvedValue({ rows: [{ status: "confirmed" }] });
    await expect(
      getBookingStateForConfirmationCode("GY-Z6iXznfG")
    ).resolves.toBe("active");
  });

  it("reports a canceled reservation as canceled — the dates are free again", async () => {
    mockQuery.mockResolvedValue({ rows: [{ status: "canceled" }] });
    await expect(getBookingStateForConfirmationCode("GY-abc")).resolves.toBe(
      "canceled"
    );
  });

  it("treats an unrecognised status as active, the safe direction for money", async () => {
    mockQuery.mockResolvedValue({ rows: [{ status: "inquiry" }] });
    await expect(getBookingStateForConfirmationCode("GY-abc")).resolves.toBe(
      "active"
    );
  });

  it("returns unknown when no reservation row matches", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(getBookingStateForConfirmationCode("GY-nope")).resolves.toBe(
      "unknown"
    );
  });

  it("returns unknown for an empty code without querying", async () => {
    await expect(getBookingStateForConfirmationCode("")).resolves.toBe(
      "unknown"
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns unknown rather than throwing when the query comes back malformed", async () => {
    // A malformed driver response reaches the same catch as a dropped
    // connection: `rows` is absent, so reading it throws inside the try.
    // Deliberately not a mock that throws — vitest surfaces an error raised
    // inside a mock implementation as a test failure even when the code under
    // test catches it, which hides the behaviour being asserted here.
    mockQuery.mockResolvedValue(null as never);
    const state = await getBookingStateForConfirmationCode("GY-abc");
    expect(state).toBe("unknown");
  });
});

describe("minutesSince", () => {
  it("measures a recent PaymentIntent in minutes", () => {
    const fourteenSecondsAgo = Math.floor((Date.now() - 14_000) / 1000);
    expect(minutesSince(fourteenSecondsAgo)).toBeLessThan(1);
  });

  it("treats a missing created timestamp as infinitely old", () => {
    expect(minutesSince(null)).toBe(Number.POSITIVE_INFINITY);
    expect(minutesSince(undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  // The guard blocks an unresolvable coded PI only inside this window. The
  // real duplicate arrived 14 seconds after the first booking; a legitimate
  // re-booking of cancelled dates arrives far later.
  it("puts the real double-charge well inside the block window", () => {
    const fourteenSecondsAgo = Math.floor((Date.now() - 14_000) / 1000);
    expect(minutesSince(fourteenSecondsAgo)).toBeLessThan(
      UNRESOLVED_CODED_PI_ACTIVE_WINDOW_MINUTES
    );
  });

  it("puts a day-old charge outside it", () => {
    const yesterday = Math.floor((Date.now() - 24 * 3600_000) / 1000);
    expect(minutesSince(yesterday)).toBeGreaterThan(
      UNRESOLVED_CODED_PI_ACTIVE_WINDOW_MINUTES
    );
  });
});
