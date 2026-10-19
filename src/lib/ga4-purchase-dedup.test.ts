import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockInsert, mockFrom };
});

vi.mock("./supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { claimGa4Purchase } from "./ga4-purchase-dedup";

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockClear();
});

describe("claimGa4Purchase", () => {
  it("claims an unseen transaction and allows the send", async () => {
    await expect(claimGa4Purchase("GY-rNZRDKkN")).resolves.toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("kv_store");
    expect(mockInsert.mock.calls[0][0].key).toBe("ga4_purchase:GY-rNZRDKkN");
  });

  // The whole point: GA4 does not dedupe the purchase EVENT count, so a
  // webhook retry would otherwise inflate both events and revenue.
  it("refuses a second send for the same transaction", async () => {
    mockInsert.mockResolvedValue({ error: { code: "23505" } });
    await expect(claimGa4Purchase("GY-rNZRDKkN")).resolves.toBe(false);
  });

  it("uses an INSERT, not a read-then-write", async () => {
    // A SELECT-then-INSERT loses the race between two lambdas finalizing the
    // same booking. The unique-violation path is what makes this atomic.
    await claimGa4Purchase("GY-abc");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  describe("fails OPEN — a dropped purchase is worse than a duplicate", () => {
    it("sends when the claim write errors for any other reason", async () => {
      mockInsert.mockResolvedValue({
        error: { code: "08006", message: "connection failure" },
      });
      await expect(claimGa4Purchase("GY-abc")).resolves.toBe(true);
    });

    it("sends when the claim throws", async () => {
      mockInsert.mockRejectedValue(new Error("boom"));
      await expect(claimGa4Purchase("GY-abc")).resolves.toBe(true);
    });

    it("sends when there is no transaction id to dedupe on", async () => {
      await expect(claimGa4Purchase(null)).resolves.toBe(true);
      await expect(claimGa4Purchase("")).resolves.toBe(true);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("keys per transaction, so two different bookings both send", async () => {
    await claimGa4Purchase("GY-one");
    await claimGa4Purchase("GY-two");
    const keys = mockInsert.mock.calls.map((c) => c[0].key);
    expect(keys).toEqual(["ga4_purchase:GY-one", "ga4_purchase:GY-two"]);
  });
});
