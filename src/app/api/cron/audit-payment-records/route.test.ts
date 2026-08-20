import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPoolQuery, mockGetReservation, mockSendAlert } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockGetReservation: vi.fn(),
  mockSendAlert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mockPoolQuery }) }));
vi.mock("@/lib/guesty-openapi", () => ({
  getOpenAPIReservation: mockGetReservation,
}));
vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
  renderAlertDetails: (rows: [string, unknown][]) =>
    rows.map(([k, v]) => `${k}=${v}`).join(";"),
}));

import { GET } from "./route";

const OURS = (amount: number) => ({
  amount,
  status: "SUCCEEDED",
  note: `Stripe PI pi_abc — collected via native Stripe`,
  createdAt: "2026-08-01T23:40:19.936Z",
});
/** Guesty's auto-payment-rule row: no Stripe note. */
const AUTO_RULE = (amount: number, status: string) => ({
  amount,
  status,
  note: null,
  createdAt: "2026-08-01T23:40:17.405Z",
});

function reservation(
  confirmationCode: string,
  money: Record<string, unknown>,
  status = "confirmed"
) {
  return { confirmationCode, status, money };
}

function authed(url = "http://localhost/api/cron/audit-payment-records") {
  return new Request(url, {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("audit-payment-records", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.CRON_SECRET = "test-cron-secret";
    mockPoolQuery.mockReset();
    mockGetReservation.mockReset();
    mockSendAlert.mockReset();
    mockSendAlert.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** The route paces itself between reservations; drive those timers. */
  async function run(req = authed()) {
    const promise = GET(req);
    await vi.runAllTimersAsync();
    return (await promise).json();
  }

  it("rejects an unauthenticated request", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/audit-payment-records")
    );
    expect(res.status).toBe(401);
    expect(mockGetReservation).not.toHaveBeenCalled();
  });

  it("flags the GY-hNBNy23v shape: duplicate SUCCEEDED payments", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res1", confirmation_code: "GY-hNBNy23v", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-hNBNy23v", {
        hostPayout: 678.44,
        totalPaid: 1185.8,
        balanceDue: -507.36,
        payments: [AUTO_RULE(592.9, "SUCCEEDED"), OURS(592.9)],
      })
    );

    const body = await run();

    expect(body.findingCount).toBe(1);
    expect(body.findings[0]).toMatchObject({
      confirmationCode: "GY-hNBNy23v",
      kind: "duplicate_succeeded",
      succeededCount: 2,
      unattributedCount: 1, // the note-less auto-rule row
    });
    expect(mockSendAlert).toHaveBeenCalledTimes(1);
  });

  it("does NOT flag the normal shape where the auto-rule row stays PENDING", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res2", confirmation_code: "GY-TanvWyVu", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-TanvWyVu", {
        hostPayout: 399.74,
        totalPaid: 399.74,
        balanceDue: 0,
        payments: [AUTO_RULE(399.74, "PENDING"), OURS(399.74)],
      })
    );

    const body = await run();

    expect(body.findingCount).toBe(0);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("does NOT flag a legitimate second payment of a DIFFERENT amount", async () => {
    // GY-SHHhdMpj in production: a $1738.41 stay payment plus a separate $50
    // pet fee. Two succeeded payments, but not a duplicate — flagging this
    // would train everyone to ignore the alert.
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res5", confirmation_code: "GY-SHHhdMpj", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-SHHhdMpj", {
        hostPayout: 1788.41,
        totalPaid: 1788.41,
        balanceDue: 0,
        payments: [
          AUTO_RULE(1738.41, "SUCCEEDED"),
          { amount: 50, status: "SUCCEEDED", note: "pet fee", createdAt: "x" },
        ],
      })
    );

    const body = await run();

    expect(body.findingCount).toBe(0);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("names the un-noted row as the one to void", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res1", confirmation_code: "GY-hNBNy23v", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-hNBNy23v", {
        hostPayout: 678.44,
        totalPaid: 1185.8,
        balanceDue: -507.36,
        payments: [AUTO_RULE(592.9, "SUCCEEDED"), OURS(592.9)],
      })
    );

    const body = await run();

    expect(body.findings[0].detail).toContain("NO Stripe PI note");
    expect(body.findings[0].detail).toContain("ours — Stripe PI");
  });

  it("does NOT flag a cancelled reservation's negative balance", async () => {
    // hostPayout drops to 0 on cancellation while payment stays recorded, so a
    // negative balance is the expected shape — alerting on it would be noise.
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res3", confirmation_code: "GY-EHbuUe83", status: "canceled" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation(
        "GY-EHbuUe83",
        {
          hostPayout: 0,
          totalPaid: 679.81,
          balanceDue: -679.81,
          payments: [OURS(679.81)],
        },
        "canceled"
      )
    );

    const body = await run();

    expect(body.findingCount).toBe(0);
  });

  it("flags a negative balance on a LIVE reservation", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res4", confirmation_code: "GY-live", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-live", {
        hostPayout: 500,
        totalPaid: 700,
        balanceDue: -200,
        payments: [OURS(700)],
      })
    );

    const body = await run();

    expect(body.findingCount).toBe(1);
    expect(body.findings[0].kind).toBe("negative_balance");
  });

  it("keeps sweeping when one reservation is unreadable", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [
        { guesty_id: "bad", confirmation_code: "GY-bad", status: "confirmed" },
        { guesty_id: "res1", confirmation_code: "GY-hNBNy23v", status: "confirmed" },
      ],
    });
    mockGetReservation
      .mockRejectedValueOnce(new Error("Guesty 500"))
      .mockResolvedValueOnce(
        reservation("GY-hNBNy23v", {
          hostPayout: 678.44,
          totalPaid: 1185.8,
          balanceDue: -507.36,
          payments: [AUTO_RULE(592.9, "SUCCEEDED"), OURS(592.9)],
        })
      );

    const body = await run();

    expect(body.skipped).toBe(1);
    expect(body.scanned).toBe(1);
    expect(body.findingCount).toBe(1);
  });

  it("reports without alerting under dryRun", async () => {
    mockPoolQuery.mockResolvedValue({
      rows: [{ guesty_id: "res1", confirmation_code: "GY-hNBNy23v", status: "confirmed" }],
    });
    mockGetReservation.mockResolvedValue(
      reservation("GY-hNBNy23v", {
        hostPayout: 678.44,
        totalPaid: 1185.8,
        balanceDue: -507.36,
        payments: [AUTO_RULE(592.9, "SUCCEEDED"), OURS(592.9)],
      })
    );

    const body = await run(
      authed("http://localhost/api/cron/audit-payment-records?dryRun=1")
    );

    expect(body.findingCount).toBe(1);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });
});
