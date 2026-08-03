import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollForRecoveredReservation } from "./booking-recovery";

const OK = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;
const NOT_FOUND = () =>
  ({ ok: false, status: 404, json: async () => ({}) }) as unknown as Response;

describe("pollForRecoveredReservation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Runs the poll to completion while auto-advancing the backoff timers. */
  async function runPoll(opts: Parameters<typeof pollForRecoveredReservation>[0]) {
    const promise = pollForRecoveredReservation(opts);
    await vi.runAllTimersAsync();
    return promise;
  }

  it("returns the reservation as soon as one appears", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(OK({ reservationId: null }))
      .mockResolvedValueOnce(OK({ reservationId: null }))
      .mockResolvedValueOnce(
        OK({ reservationId: "res_123", confirmationCode: "GY-abc" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPoll({
      paymentIntentId: "pi_1",
      lookupToken: "tok",
    });

    expect(result).toEqual({
      reservationId: "res_123",
      confirmationCode: "GY-abc",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("resolves null when the reservation never lands before the timeout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(OK({ reservationId: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPoll({
      paymentIntentId: "pi_1",
      lookupToken: "tok",
      timeoutMs: 30_000,
    });

    expect(result).toBeNull();
  });

  it("keeps polling through 404s and network errors rather than giving up", async () => {
    // A cleaned pending row (404) or a blip must not end the watch — the
    // recovery crons may still be mid-flight.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(NOT_FOUND())
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(OK({ reservationId: "res_late" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPoll({
      paymentIntentId: "pi_1",
      lookupToken: "tok",
    });

    expect(result?.reservationId).toBe("res_late");
  });

  it("does not poll without a usable token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // "fallback" is what POST /api/pending-checkout returns when the signing
    // secret is missing; the lookup endpoint would just 401 forever.
    expect(
      await runPoll({ paymentIntentId: "pi_1", lookupToken: "fallback" })
    ).toBeNull();
    expect(
      await runPoll({ paymentIntentId: "pi_1", lookupToken: "" })
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the payment intent and token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(OK({ reservationId: "res_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await runPoll({ paymentIntentId: "pi_abc", lookupToken: "tok+1" });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("paymentIntentId=pi_abc");
    expect(url).toContain(`token=${encodeURIComponent("tok+1")}`);
  });
});
