import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetUser,
  mockPoolQuery,
  mockCancelOpenAPIReservation,
  mockRecordRefund,
  mockRefundCreate,
  mockSendAlert,
  mockSendGuestyRefundRecordFailedAlert,
  mockSendCancellationEmail,
  mockGetEffectiveServerConsent,
  mockParseGA4SessionId,
  mockTrackCancellationServerSide,
  mockTrackRefundServerSide,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPoolQuery: vi.fn(),
  mockCancelOpenAPIReservation: vi.fn(),
  mockRecordRefund: vi.fn(),
  mockRefundCreate: vi.fn(),
  mockSendAlert: vi.fn(),
  mockSendGuestyRefundRecordFailedAlert: vi.fn(),
  mockSendCancellationEmail: vi.fn(),
  mockGetEffectiveServerConsent: vi.fn(),
  mockParseGA4SessionId: vi.fn(),
  mockTrackCancellationServerSide: vi.fn(),
  mockTrackRefundServerSide: vi.fn(),
}));

vi.mock("@/lib/supabase-auth-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

vi.mock("@/lib/guesty-openapi", () => ({
  cancelOpenAPIReservation: mockCancelOpenAPIReservation,
  recordRefund: mockRecordRefund,
}));

vi.mock("@/lib/stripe", () => ({
  getStripeServer: () => ({
    refunds: { create: mockRefundCreate },
  }),
  buildStripeIdempotencyKey: vi.fn(() => "idem_refund_key"),
}));

vi.mock("@/lib/alerts", () => ({
  sendAlert: mockSendAlert,
  sendGuestyRefundRecordFailedAlert: mockSendGuestyRefundRecordFailedAlert,
}));

vi.mock("@/lib/emails/cancellation-email", () => ({
  sendCancellationEmail: mockSendCancellationEmail,
}));

vi.mock("@/lib/consent", () => ({
  getEffectiveServerConsent: mockGetEffectiveServerConsent,
}));

vi.mock("@/lib/server-tracking", () => ({
  parseGA4SessionId: mockParseGA4SessionId,
  trackCancellationServerSide: mockTrackCancellationServerSide,
  trackRefundServerSide: mockTrackRefundServerSide,
}));

import { POST } from "./route";

const USER = { id: "user_123", email: "guest@example.com" };

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    guesty_id: "res_123",
    confirmation_code: "ABC123",
    guest: { email: "guest@example.com", fullName: "Sarah O'Brien" },
    listing_id: "listing_1",
    listing: { title: "Modern Loft" },
    check_in: "2026-04-20",
    check_out: "2026-04-23",
    status: "confirmed",
    user_id: "user_123",
    stripe_payment_intent_id: "pi_123",
    canceled_at: null,
    guesty_canceled_at: null,
    refund_status: null,
    refund_amount: null,
    stripe_refund_id: null,
    guesty_refund_recorded: null,
    cancellation_email_sent_at: null,
    money: { totalPaid: 712.45 },
    listing_title: "Modern Loft",
    listing_picture:
      "https://res.cloudinary.com/x/image/upload/t_default_thumb/foo.jpg",
    ...overrides,
  };
}

function postReq(reservationId = "res_123") {
  const request = new NextRequest(
    `http://localhost/api/account/reservations/${reservationId}/cancel`,
    { method: "POST", headers: { cookie: "_ga=GA1.1.123.456" } }
  );
  return POST(request, {
    params: Promise.resolve({ reservationId }),
  });
}

describe("POST /api/account/reservations/[reservationId]/cancel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
    mockGetEffectiveServerConsent.mockReturnValue(null);
    mockParseGA4SessionId.mockReturnValue(undefined);
    mockTrackCancellationServerSide.mockResolvedValue(undefined);
    mockTrackRefundServerSide.mockResolvedValue(undefined);
    mockSendAlert.mockResolvedValue(undefined);
    mockSendGuestyRefundRecordFailedAlert.mockResolvedValue(undefined);
    mockSendCancellationEmail.mockResolvedValue(undefined);
    mockRecordRefund.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ data: { user: USER }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Auth + ownership ─────────────────────────────────────────────

  it("returns 401 when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Unauthorized"),
    });
    const response = await postReq();
    expect(response.status).toBe(401);
  });

  it("returns 404 when the user does not own the reservation", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        makeRow({
          user_id: "other_user",
          guest: { email: "other@example.com", fullName: "Someone Else" },
        }),
      ],
    });
    const response = await postReq();
    expect(response.status).toBe(404);
    expect(mockCancelOpenAPIReservation).not.toHaveBeenCalled();
    expect(mockRefundCreate).not.toHaveBeenCalled();
    // Only the SELECT was issued — no UPDATE
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  // ─── Fresh-request branches ───────────────────────────────────────

  it("full refund happy path", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] }) // SELECT
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "refund_pending",
          },
        ],
      }) // claim
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      }) // guesty_canceled_at update
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            refund_status: "full_refund",
            stripe_refund_id: "re_123",
            refund_amount: "57.93",
          },
        ],
      }) // stripe persistence
      .mockResolvedValueOnce({ rowCount: 1 }) // guesty_refund_recorded = true
      .mockResolvedValueOnce({ rowCount: 1 }); // cancellation_email_sent_at

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    mockRefundCreate.mockResolvedValue({ id: "re_123", amount: 5793 });

    const response = await postReq();
    expect(response.status).toBe(200);

    // Claim wrote refund_status='refund_pending' atomically
    const claimCall = mockPoolQuery.mock.calls[1];
    expect(claimCall[0]).toMatch(
      /UPDATE reservations[\s\S]+SET[\s\S]+canceled/
    );
    expect(claimCall[1]).toEqual(["res_123", "refund_pending"]);

    expect(mockCancelOpenAPIReservation).toHaveBeenCalledWith("res_123");
    expect(mockRefundCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_123",
        metadata: {
          reservationId: "res_123",
          reason: "guest_self_service_cancellation",
        },
      },
      { idempotencyKey: "idem_refund_key" }
    );
    expect(mockRecordRefund).toHaveBeenCalledWith(
      "res_123",
      57.93,
      "Guest self-service cancellation — Stripe refund re_123"
    );
    expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
    expect(mockSendCancellationEmail.mock.calls[0][0].refundStatus).toBe(
      "full_refund"
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      reservationId: "res_123",
      refundStatus: "full_refund",
      refundAmount: 57.93,
      stripeRefundId: "re_123",
      guestyRefundRecorded: true,
    });
  });

  it("non-refundable (inside 14 days) skips Stripe and recordRefund, sends email", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [makeRow({ check_in: "2026-03-10" })], // 1 calendar day out
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "non_refundable",
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // cancellation_email_sent_at

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);

    const response = await postReq();
    expect(response.status).toBe(200);

    // Claim wrote non_refundable
    expect(mockPoolQuery.mock.calls[1][1]).toEqual([
      "res_123",
      "non_refundable",
    ]);
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockRecordRefund).not.toHaveBeenCalled();
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        refundStatus: "non_refundable",
        refundAmount: 0,
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      refundStatus: "non_refundable",
      refundAmount: 0,
      stripeRefundId: null,
      guestyRefundRecorded: null,
    });
  });

  it("refund eligible but no Stripe PI on file → pending_manual", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [makeRow({ stripe_payment_intent_id: null })],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "pending_manual",
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ refundStatus: "pending_manual" })
    );
  });

  it("Stripe refund failure → refund_status='failed', email still sent, 200 returned", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "refund_pending",
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // failed status persistence
      .mockResolvedValueOnce({ rowCount: 1 }); // cancellation_email_sent_at

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    mockRefundCreate.mockRejectedValue(new Error("card_declined"));

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockRecordRefund).not.toHaveBeenCalled();
    // sendAlert is called for the internal cancellation alert AND the stripe failure alert
    expect(mockSendAlert).toHaveBeenCalled();
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ refundStatus: "failed" })
    );
    await expect(response.json()).resolves.toMatchObject({
      refundStatus: "failed",
      refundAmount: 0,
    });
  });

  it("Guesty recordRefund failure → guesty_refund_recorded=false + alert + email still sent", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "refund_pending",
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            refund_status: "full_refund",
            stripe_refund_id: "re_123",
            refund_amount: "57.93",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // guesty_refund_recorded = false
      .mockResolvedValueOnce({ rowCount: 1 });

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    mockRefundCreate.mockResolvedValue({ id: "re_123", amount: 5793 });
    mockRecordRefund.mockRejectedValue(new Error("guesty 500"));

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockSendGuestyRefundRecordFailedAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: "res_123",
        confirmationCode: "ABC123",
        refundAmount: 57.93,
        stripeRefundId: "re_123",
      })
    );
    expect(mockSendCancellationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ refundStatus: "full_refund" })
    );
    await expect(response.json()).resolves.toMatchObject({
      refundStatus: "full_refund",
      guestyRefundRecorded: false,
    });
  });

  it("Guesty cancel fails on fresh request → reverts and returns 500", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "refund_pending",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // revert UPDATE

    mockCancelOpenAPIReservation.mockRejectedValue(new Error("Guesty down"));

    const response = await postReq();
    expect(response.status).toBe(500);
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
    // Third call should be the revert UPDATE
    const revertCall = mockPoolQuery.mock.calls[2];
    expect(revertCall[0]).toMatch(/SET[\s\S]+status = 'confirmed'/);
    expect(revertCall[0]).toMatch(/canceled_at = NULL/);
    expect(revertCall[0]).toMatch(/refund_status = NULL/);
    expect(revertCall[0]).toMatch(/guesty_canceled_at IS NULL/);
  });

  // ─── Resume / readback ────────────────────────────────────────────

  it("resumes after local claim but before Guesty cancel", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          makeRow({
            status: "canceled",
            canceled_at: "2026-03-09T11:59:00.000Z",
            refund_status: "refund_pending",
            guesty_canceled_at: null,
          }),
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            refund_status: "full_refund",
            stripe_refund_id: "re_123",
            refund_amount: "57.93",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // guesty_refund_recorded
      .mockResolvedValueOnce({ rowCount: 1 }); // email

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    mockRefundCreate.mockResolvedValue({ id: "re_123", amount: 5793 });

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockCancelOpenAPIReservation).toHaveBeenCalledTimes(1);
    expect(mockRefundCreate).toHaveBeenCalledTimes(1);
    expect(mockSendCancellationEmail).toHaveBeenCalledTimes(1);
  });

  it("resumes after Stripe success but before Guesty recordRefund", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({
        rows: [
          makeRow({
            status: "canceled",
            canceled_at: "2026-03-09T11:59:00.000Z",
            refund_status: "full_refund",
            refund_amount: "57.93",
            stripe_refund_id: "re_123",
            guesty_canceled_at: "2026-03-09T11:59:30.000Z",
            guesty_refund_recorded: null,
          }),
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // guesty_refund_recorded = true
      .mockResolvedValueOnce({ rowCount: 1 }); // email

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockCancelOpenAPIReservation).not.toHaveBeenCalled();
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockRecordRefund).toHaveBeenCalledWith(
      "res_123",
      57.93,
      "Guest self-service cancellation — Stripe refund re_123"
    );
  });

  it("completed-duplicate POST returns 200 snapshot, no side effects", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        makeRow({
          status: "canceled",
          canceled_at: "2026-03-08T11:59:00.000Z",
          refund_status: "full_refund",
          refund_amount: "57.93",
          stripe_refund_id: "re_123",
          guesty_canceled_at: "2026-03-08T11:59:30.000Z",
          guesty_refund_recorded: true,
          cancellation_email_sent_at: "2026-03-08T12:00:00.000Z",
        }),
      ],
    });

    const response = await postReq();
    expect(response.status).toBe(200);
    expect(mockCancelOpenAPIReservation).not.toHaveBeenCalled();
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockRecordRefund).not.toHaveBeenCalled();
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
    expect(mockSendAlert).not.toHaveBeenCalled();
    expect(mockTrackCancellationServerSide).not.toHaveBeenCalled();
    // Only the SELECT happened
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      refundStatus: "full_refund",
      refundAmount: 57.93,
      stripeRefundId: "re_123",
      guestyRefundRecorded: true,
    });
  });

  it("Resend failure → 200, email_sent_at stays NULL, alert fires", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            canceled_at: "2026-03-09T12:00:00.000Z",
            refund_status: "refund_pending",
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ guesty_canceled_at: "2026-03-09T12:00:00.000Z" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            refund_status: "full_refund",
            stripe_refund_id: "re_123",
            refund_amount: "57.93",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // guesty_refund_recorded

    mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    mockRefundCreate.mockResolvedValue({ id: "re_123", amount: 5793 });
    mockSendCancellationEmail.mockRejectedValue(new Error("Resend down"));

    const response = await postReq();
    expect(response.status).toBe(200);
    // The cancellation_email_sent_at UPDATE must NOT have been called
    // (the SELECT also references the column, so match against `SET cancellation_email_sent_at`)
    const emailUpdates = mockPoolQuery.mock.calls.filter((c) =>
      /SET\s+cancellation_email_sent_at/.test(String(c[0]))
    );
    expect(emailUpdates).toHaveLength(0);
    // A failure alert should have been sent (key contains "cancellation-email-failed")
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringMatching(/cancellation-email-failed/)
    );
  });

  // Clock is Oct 12, 2026 at noon Mountain (18:00Z, MDT). Check-in dates
  // below are calendar days before that, which is what the policy counts.
  describe("14-day refund cutoff", () => {
    const noonOnOct12 = new Date("2026-10-12T18:00:00.000Z");

    function prime(
      checkIn: string,
      refundStatus: "refund_pending" | "non_refundable",
      extra: Record<string, unknown> = {}
    ) {
      const row = makeRow({ check_in: checkIn, ...extra });
      if (refundStatus === "non_refundable") {
        mockPoolQuery
          .mockResolvedValueOnce({ rows: [row] })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                canceled_at: "2026-10-12T18:00:00.000Z",
                refund_status: "non_refundable",
              },
            ],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ guesty_canceled_at: "2026-10-12T18:00:00.000Z" }],
          })
          .mockResolvedValueOnce({ rowCount: 1 });
      } else {
        mockPoolQuery
          .mockResolvedValueOnce({ rows: [row] })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                canceled_at: "2026-10-12T18:00:00.000Z",
                refund_status: "refund_pending",
              },
            ],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ guesty_canceled_at: "2026-10-12T18:00:00.000Z" }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                refund_status: "full_refund",
                stripe_refund_id: "re_123",
                refund_amount: "57.93",
              },
            ],
          })
          .mockResolvedValueOnce({ rowCount: 1 })
          .mockResolvedValueOnce({ rowCount: 1 });
        mockRefundCreate.mockResolvedValue({ id: "re_123", amount: 5793 });
      }
      mockCancelOpenAPIReservation.mockResolvedValue(undefined);
    }

    it("15 days out issues a full Stripe refund", async () => {
      vi.setSystemTime(noonOnOct12);
      prime("2026-10-27", "refund_pending");
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "refund_pending",
      ]);
      expect(mockRefundCreate).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toMatchObject({
        refundStatus: "full_refund",
      });
    });

    it("14 days out still issues a full Stripe refund", async () => {
      vi.setSystemTime(noonOnOct12);
      prime("2026-10-26", "refund_pending");
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "refund_pending",
      ]);
      expect(mockRefundCreate).toHaveBeenCalledTimes(1);
    });

    it("14 days out at 11:59pm Mountain is still refundable", async () => {
      vi.setSystemTime(new Date("2026-10-13T05:59:00.000Z"));
      prime("2026-10-26", "refund_pending");
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "refund_pending",
      ]);
      expect(mockRefundCreate).toHaveBeenCalledTimes(1);
    });

    it("13 days out does not auto-refund", async () => {
      vi.setSystemTime(new Date("2026-10-13T06:00:00.000Z"));
      prime("2026-10-26", "non_refundable");
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "non_refundable",
      ]);
      expect(mockRefundCreate).not.toHaveBeenCalled();
      expect(mockRecordRefund).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        refundStatus: "non_refundable",
        refundAmount: 0,
      });
    });

    it("2 days out does not auto-refund", async () => {
      vi.setSystemTime(noonOnOct12);
      prime("2026-10-14", "non_refundable");
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "non_refundable",
      ]);
      expect(mockRefundCreate).not.toHaveBeenCalled();
      expect(mockRecordRefund).not.toHaveBeenCalled();
    });

    it("prefers check_in_date_localized over a UTC instant that shifts the day", async () => {
      // The instant is UTC midnight Oct 26, which is Oct 25 in Denver (13
      // days — not refundable). The localized date is the real arrival day
      // and is still 14 days out.
      vi.setSystemTime(noonOnOct12);
      prime("2026-10-26T00:00:00.000Z", "refund_pending", {
        check_in_date_localized: "2026-10-26",
      });
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockPoolQuery.mock.calls[1][1]).toEqual([
        "res_123",
        "refund_pending",
      ]);
      expect(mockRefundCreate).toHaveBeenCalledTimes(1);
    });

    it("does not refund extension charges inside the 14-day window", async () => {
      vi.setSystemTime(noonOnOct12);
      prime("2026-10-14", "non_refundable", {
        money: {
          totalPaid: 712.45,
          dateChanges: [
            {
              type: "charge",
              paymentIntentId: "pi_ext",
              amount: 80,
              refunded: false,
            },
          ],
        },
      });
      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockRefundCreate).not.toHaveBeenCalled();
    });

    it("still refunds extension charges when the cancellation is a full refund", async () => {
      vi.setSystemTime(noonOnOct12);
      const row = makeRow({
        check_in: "2026-10-27",
        money: {
          totalPaid: 712.45,
          dateChanges: [
            {
              type: "charge",
              paymentIntentId: "pi_ext",
              amount: 80,
              refunded: false,
            },
          ],
        },
      });
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              canceled_at: "2026-10-12T18:00:00.000Z",
              refund_status: "refund_pending",
            },
          ],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ guesty_canceled_at: "2026-10-12T18:00:00.000Z" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              refund_status: "full_refund",
              stripe_refund_id: "re_123",
              refund_amount: "57.93",
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // dateChanges jsonb
        .mockResolvedValueOnce({ rowCount: 1 }) // guesty_refund_recorded
        .mockResolvedValueOnce({ rowCount: 1 }); // email
      mockCancelOpenAPIReservation.mockResolvedValue(undefined);
      mockRefundCreate.mockResolvedValue({ id: "re_ext", amount: 8000 });

      const response = await postReq();
      expect(response.status).toBe(200);
      expect(mockRefundCreate).toHaveBeenCalledTimes(2);
      expect(mockRefundCreate.mock.calls[1][0].payment_intent).toBe("pi_ext");
    });
  });

  it("legacy/manual canceled row (status=canceled, refund_status=NULL) returns 400", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        makeRow({
          status: "canceled",
          canceled_at: "2025-11-01T00:00:00.000Z",
          refund_status: null,
        }),
      ],
    });

    const response = await postReq();
    expect(response.status).toBe(400);
    expect(mockCancelOpenAPIReservation).not.toHaveBeenCalled();
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockSendCancellationEmail).not.toHaveBeenCalled();
  });
});
