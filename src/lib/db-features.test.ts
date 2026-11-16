import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendAlert } = vi.hoisted(() => ({
  mockSendAlert: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./alerts", () => ({
  sendAlert: mockSendAlert,
}));

import {
  paymentTargetColumnsExist,
  resetPaymentTargetColumnsCacheForTests,
} from "./db-features";

function makePool(rows: Array<{ column_name: string }>) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { pool: { query } as unknown as import("pg").Pool, query };
}

beforeEach(() => {
  resetPaymentTargetColumnsCacheForTests();
  mockSendAlert.mockClear();
});

describe("paymentTargetColumnsExist", () => {
  it("returns true when all three columns are present", async () => {
    const { pool, query } = makePool([
      { column_name: "payment_target_cents" },
      { column_name: "payment_recorded_cents" },
      { column_name: "payment_target_cents_set_at" },
    ]);
    expect(await paymentTargetColumnsExist(pool)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("caches the result across repeated calls (post-migration)", async () => {
    const { pool, query } = makePool([
      { column_name: "payment_target_cents" },
      { column_name: "payment_recorded_cents" },
      { column_name: "payment_target_cents_set_at" },
    ]);
    expect(await paymentTargetColumnsExist(pool)).toBe(true);
    expect(await paymentTargetColumnsExist(pool)).toBe(true);
    expect(await paymentTargetColumnsExist(pool)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("returns false and alerts once when a column is missing", async () => {
    const { pool } = makePool([
      { column_name: "payment_target_cents" },
      { column_name: "payment_recorded_cents" },
      // payment_target_cents_set_at missing
    ]);
    expect(await paymentTargetColumnsExist(pool)).toBe(false);
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert.mock.calls[0]?.[2]).toBe(
      "payment-recording-schema-missing"
    );
  });

  it("returns false and alerts once when every column is missing", async () => {
    const { pool } = makePool([]);
    expect(await paymentTargetColumnsExist(pool)).toBe(false);
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
  });

  it("returns false (and does not throw) if the probe query errors", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    const pool = { query } as unknown as import("pg").Pool;
    expect(await paymentTargetColumnsExist(pool)).toBe(false);
  });
});
