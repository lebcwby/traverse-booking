import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPoolQuery,
  mockRecordRefund,
  mockSendGuestyRefundRecordFailedAlert,
} = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockRecordRefund: vi.fn(),
  mockSendGuestyRefundRecordFailedAlert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

vi.mock("@/lib/guesty-openapi", () => ({
  recordRefund: mockRecordRefund,
}));

vi.mock("@/lib/alerts", () => ({
  sendGuestyRefundRecordFailedAlert: mockSendGuestyRefundRecordFailedAlert,
}));

import { GET } from "./route";

function authedRequest() {
  return new Request(
    "http://localhost/api/cron/reconcile-cancellation-refunds",
    {
      headers: { authorization: "Bearer test_secret" },
    }
  );
}

describe("GET /api/cron/reconcile-cancellation-refunds", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test_secret";
    mockSendGuestyRefundRecordFailedAlert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/reconcile-cancellation-refunds")
    );
    expect(res.status).toBe(401);
  });

  it("retries Guesty recordRefund and marks success", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            guesty_id: "res_1",
            confirmation_code: "AAA",
            refund_amount: "57.93",
            stripe_refund_id: "re_aaa",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // mark true
    mockRecordRefund.mockResolvedValue(undefined);

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    expect(mockRecordRefund).toHaveBeenCalledWith(
      "res_1",
      57.93,
      "Guest self-service cancellation — Stripe refund re_aaa"
    );
    const updateCall = mockPoolQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/SET guesty_refund_recorded = true/);
    expect(mockSendGuestyRefundRecordFailedAlert).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      scanned: 1,
      retried: 1,
      fixed: 1,
      failed: 0,
    });
  });

  it("retry failure marks false and sends alert", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            guesty_id: "res_2",
            confirmation_code: "BBB",
            refund_amount: "100.00",
            stripe_refund_id: "re_bbb",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // mark false
    mockRecordRefund.mockRejectedValue(new Error("guesty 500"));

    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    const updateCall = mockPoolQuery.mock.calls[1];
    expect(updateCall[0]).toMatch(/SET guesty_refund_recorded = false/);
    expect(mockSendGuestyRefundRecordFailedAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "res_2",
        confirmationCode: "BBB",
        refundAmount: 100,
        stripeRefundId: "re_bbb",
      })
    );
    await expect(res.json()).resolves.toMatchObject({
      scanned: 1,
      retried: 1,
      fixed: 0,
      failed: 1,
    });
  });

  it("returns zero counts when no rows match", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await GET(authedRequest());
    expect(res.status).toBe(200);
    expect(mockRecordRefund).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      scanned: 0,
      retried: 0,
      fixed: 0,
      failed: 0,
    });
  });

  it("queries rows where guesty_refund_recorded IS NOT TRUE so failed rows are retried", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    await GET(authedRequest());
    const selectCall = mockPoolQuery.mock.calls[0];
    expect(selectCall[0]).toMatch(/guesty_refund_recorded IS NOT TRUE/);
    expect(selectCall[0]).toMatch(/refund_status = 'full_refund'/);
    expect(selectCall[0]).toMatch(/stripe_refund_id IS NOT NULL/);
  });
});
