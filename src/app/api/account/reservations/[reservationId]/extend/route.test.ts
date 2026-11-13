import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetUser,
  mockPoolQuery,
  mockSendAlert,
  mockUpdateReservationDates,
  mockRecordPayment,
  mockRecordRefund,
  mockGetOpenAPIReservation,
  mockGetListingCalendar,
  mockPaymentIntentsCreate,
  mockRefundsCreate,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockSendAlert: vi.fn(),
  mockUpdateReservationDates: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockRecordRefund: vi.fn(),
  mockGetOpenAPIReservation: vi.fn(),
  mockGetListingCalendar: vi.fn(),
  mockPaymentIntentsCreate: vi.fn(),
  mockRefundsCreate: vi.fn(),
}));

vi.mock("@/lib/supabase-auth-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    query: mockPoolQuery,
    connect: async () => ({
      query: mockPoolQuery,
      release: vi.fn(),
    }),
  }),
}));

vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
  OPS_ALERT_INBOX: "bookings@traversehospitality.com",
}));

vi.mock("@/lib/guesty-openapi", () => ({
  updateReservationDates: mockUpdateReservationDates,
  recordPayment: mockRecordPayment,
  recordRefund: mockRecordRefund,
  getOpenAPIReservation: mockGetOpenAPIReservation,
}));

vi.mock("@/lib/guesty-beapi", () => ({
  getListingCalendar: mockGetListingCalendar,
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
    refunds: { create: mockRefundsCreate },
  }),
  buildStripeIdempotencyKey: vi.fn(() => "idem"),
}));

import { GET, POST } from "./route";

const USER = { id: "user_123", email: "guest@example.com" };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    guesty_id: "res_123",
    confirmation_code: "GY-DATE1",
    listing_id: "listing_1",
    listing_title: "Gothic Cabin",
    check_in: "2026-11-10T22:00:00.000Z",
    check_out: "2026-11-14T16:00:00.000Z",
    check_in_date_localized: "2026-11-10",
    check_out_date_localized: "2026-11-14",
    status: "confirmed",
    guest: { email: "guest@example.com", fullName: "Casey Guest" },
    user_id: "user_123",
    ...overrides,
  };
}

function post(body: Record<string, unknown>, reservationId = "res_123") {
  const request = new NextRequest(
    `http://localhost/api/account/reservations/${reservationId}/extend`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
  return POST(request, { params: Promise.resolve({ reservationId }) });
}

function moneyCalls() {
  return [
    mockUpdateReservationDates,
    mockRecordPayment,
    mockRecordRefund,
    mockGetOpenAPIReservation,
    mockGetListingCalendar,
    mockPaymentIntentsCreate,
    mockRefundsCreate,
  ];
}

describe("POST /api/account/reservations/[reservationId]/extend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T18:00:00.000Z"));
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
    mockSendAlert.mockResolvedValue(undefined);
  });

  it("stores a request and alerts the team without touching money or Guesty", async () => {
    mockPoolQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);
      if (statement.includes("FROM reservations")) return { rows: [makeRow()] };
      if (statement.includes("INSERT INTO date_change_requests")) {
        return { rows: [{ id: "req_1" }] };
      }
      return { rows: [] };
    });

    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-18",
      note: "Can we arrive Thursday?",
      paymentIntentId: "pi_should_be_ignored",
      expectedAmount: 400,
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      requestId: "req_1",
      status: "pending",
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-18",
      note: "Can we arrive Thursday?",
    });

    const sql = mockPoolQuery.mock.calls.map((call) => String(call[0]));
    expect(
      sql.some((statement) => /UPDATE reservations/i.test(statement))
    ).toBe(false);
    expect(sql).toContain("BEGIN");
    expect(sql).toContain("COMMIT");
    expect(
      sql.some((statement) => statement.includes("SET status = 'superseded'"))
    ).toBe(true);
    const insert = mockPoolQuery.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO date_change_requests")
    );
    expect(insert).toBeTruthy();
    expect(insert?.[1]).toEqual([
      "res_123",
      "GY-DATE1",
      "guest@example.com",
      "Casey Guest",
      "listing_1",
      "Gothic Cabin",
      "2026-11-10",
      "2026-11-14",
      "2026-11-12",
      "2026-11-18",
      "Can we arrive Thursday?",
    ]);

    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).toHaveBeenCalledWith(
      "Date change request — GY-DATE1",
      expect.stringContaining("Can we arrive Thursday?"),
      "date-change-request-req_1",
      { to: "bookings@traversehospitality.com" }
    );
    expect(mockSendAlert.mock.calls[0][1]).toContain("date_change_requests");

    for (const call of moneyCalls()) {
      expect(call).not.toHaveBeenCalled();
    }
  });

  it.each([
    "quote",
    "payment-intent",
    "finalize",
    "finalize-no-charge",
    "finalize-refund",
    "rollback",
    "info",
  ])(
    "refuses action %s and does not charge, refund, or modify the stay",
    async (action) => {
      const res = await post({
        action,
        newCheckIn: "2026-11-12",
        newCheckOut: "2026-11-20",
        expectedAmount: 250,
        paymentIntentId: "pi_live",
        refundAmount: 80,
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("date_change_is_request_only");
      expect(body.error).toMatch(/Nothing was charged, refunded, or changed/);
      expect(mockPoolQuery).not.toHaveBeenCalled();
      expect(mockSendAlert).not.toHaveBeenCalled();
      for (const call of moneyCalls()) {
        expect(call).not.toHaveBeenCalled();
      }
    }
  );

  it("refuses a request body that omits the action", async () => {
    const res = await post({
      newCheckIn: "2026-11-12",
      newCheckOut: "2026-11-20",
    });
    expect(res.status).toBe(409);
    expect(mockPoolQuery).not.toHaveBeenCalled();
    for (const call of moneyCalls()) expect(call).not.toHaveBeenCalled();
  });

  it("requires a signed-in guest", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("no"),
    });
    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-18",
    });
    expect(res.status).toBe(401);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it("does not store a request for a reservation the guest does not own", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-18",
    });
    expect(res.status).toBe(404);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("rejects a request for the dates already booked", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [makeRow()] });
    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-10",
      requestedCheckOut: "2026-11-14",
    });
    expect(res.status).toBe(400);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("rejects a stay that has already ended", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        makeRow({
          check_in_date_localized: "2026-10-20",
          check_out_date_localized: "2026-10-25",
        }),
      ],
    });
    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-01",
      requestedCheckOut: "2026-11-04",
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "This stay has already ended.",
    });
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("reads a date-only localized stay instead of the UTC instant", async () => {
    const row = makeRow({
      check_in: "2026-11-10T00:00:00.000Z",
      check_out: "2026-11-14T00:00:00.000Z",
      check_in_date_localized: "2026-11-10",
      check_out_date_localized: "2026-11-14",
    });
    mockPoolQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql);
      if (statement.includes("FROM reservations")) return { rows: [row] };
      if (statement.includes("INSERT INTO date_change_requests")) {
        return { rows: [{ id: "req_local" }] };
      }
      return { rows: [] };
    });

    const res = await post({
      action: "request",
      requestedCheckIn: "2026-11-12",
      requestedCheckOut: "2026-11-16",
    });
    expect(res.status).toBe(200);
    const insert = mockPoolQuery.mock.calls.find((call) =>
      String(call[0]).includes("INSERT INTO date_change_requests")
    );
    const params = insert?.[1] as string[];
    expect(params[6]).toBe("2026-11-10");
    expect(params[7]).toBe("2026-11-14");
  });
});

describe("GET pending date-change request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("returns the open request and does not call Stripe or Guesty", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "req_open",
            requested_check_in: "2026-11-12",
            requested_check_out: "2026-11-18",
            note: "Thursday",
            created_at: "2026-10-26T18:05:00.000Z",
          },
        ],
      });

    const request = new NextRequest(
      "http://localhost/api/account/reservations/res_123/extend"
    );
    const res = await GET(request, {
      params: Promise.resolve({ reservationId: "res_123" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      request: {
        id: "req_open",
        requestedCheckIn: "2026-11-12",
        requestedCheckOut: "2026-11-18",
        note: "Thursday",
        createdAt: "2026-10-26T18:05:00.000Z",
      },
    });
    for (const call of moneyCalls()) expect(call).not.toHaveBeenCalled();
  });
});
