import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Token acquisition, which took /properties down twice.
 *
 * On 2026-10-09 at 01:27:50 a request reported "BEAPI token expired" and fell
 * back to the Supabase mirror. The token had been refreshed 77 minutes
 * earlier and had 22.7 hours of life left. A single transient Supabase read
 * error was indistinguishable from "no token exists".
 */

const { mockSingle, mockSendAlert, mockFetch } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockSendAlert: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("./supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
  }),
}));
// Only sendAlert is stubbed. renderAlertDetails/renderAlertLinks stay REAL so
// these tests exercise the body a human would actually receive, escaping and
// all — a mocked renderer would let a broken alert pass.
vi.mock("./alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./alerts")>()),
  sendAlert: mockSendAlert,
}));
vi.mock("./rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0 })),
}));

const HOURS = 3600_000;
const ok = (msLeft: number) => ({
  data: { access_token: "tok_live", expires_at: Date.now() + msLeft },
  error: null,
});
const readError = () => ({ data: null, error: { message: "fetch failed" } });

describe("getBEAPIToken", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockSingle.mockReset();
    mockSendAlert.mockReset().mockResolvedValue(undefined);
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    process.env.CRON_SECRET = "test-secret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function load() {
    return (await import("./guesty-beapi")).getBEAPIToken;
  }

  it("returns the cached token when it is comfortably valid", async () => {
    mockSingle.mockResolvedValue(ok(22 * HOURS));
    await expect((await load())()).resolves.toBe("tok_live");
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  // The actual 2026-10-09 failure: one bad read, then success.
  it("retries a transient read error instead of declaring the token dead", async () => {
    mockSingle
      .mockResolvedValueOnce(readError())
      .mockResolvedValue(ok(22 * HOURS));
    await expect((await load())()).resolves.toBe("tok_live");
    expect(mockSingle).toHaveBeenCalledTimes(2);
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it("survives two consecutive read errors", async () => {
    mockSingle
      .mockResolvedValueOnce(readError())
      .mockResolvedValueOnce(readError())
      .mockResolvedValue(ok(10 * HOURS));
    await expect((await load())()).resolves.toBe("tok_live");
    expect(mockSingle).toHaveBeenCalledTimes(3);
  });

  it("gives up and alerts only after every read attempt fails", async () => {
    mockSingle.mockResolvedValue(readError());
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect((await load())()).rejects.toThrow(
      /Could not obtain a BEAPI token/
    );
    // 3 attempts, then the self-heal fires and re-reads: 3 more.
    expect(mockSingle).toHaveBeenCalledTimes(6);
  });

  // The alert said "expired" for a token with 22.7h left and sent the
  // investigation down the wrong path for twenty minutes.
  it("does not claim the token expired when it was merely unreadable", async () => {
    mockSingle.mockResolvedValue(readError());
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect((await load())()).rejects.toThrow();
    const [subject, body] = mockSendAlert.mock.calls[0] ?? [];
    expect(subject).toBe("CRITICAL: BEAPI token unavailable");
    expect(body).toMatch(/the Supabase read failed all 3 attempts/i);
    expect(subject).not.toMatch(/expired/i);
  });

  // 2026-11-10: this alert fired while the token had 20.6h left and every one
  // of 626 Supabase reads that day returned 200. Naming the branch was
  // impossible after the fact — Vercel's MCP token 403s on this team scope and
  // `vercel logs` only tails live. So the cause has to ride along in the body.
  describe("carries its own diagnosis", () => {
    const bodyOf = () => String(mockSendAlert.mock.calls[0]?.[1] ?? "");

    it("distinguishes a failed read from a real expiry", async () => {
      mockSingle.mockResolvedValue(readError());
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect((await load())()).rejects.toThrow();

      const body = bodyOf();
      expect(body).toMatch(/the token itself may be perfectly valid/i);
      // The verdict must NOT send someone at OAuth for a read failure.
      expect(body).toMatch(/token was probably FINE/i);
      expect(body).not.toMatch(/token really did lapse/i);
    });

    it("says so plainly when the token genuinely lapsed", async () => {
      mockSingle.mockResolvedValue(ok(-30 * 60_000)); // expired 30 min ago
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect((await load())()).rejects.toThrow();

      const body = bodyOf();
      expect(body).toMatch(/genuinely lapsed/i);
      expect(body).toMatch(/expired 30min ago/i);
      expect(body).toMatch(/token really did lapse/i);
      expect(body).not.toMatch(/probably FINE/i);
    });

    it("reports the self-heal outcome, not just that it didn't work", async () => {
      mockSingle.mockResolvedValue(readError());
      mockFetch.mockResolvedValue({ ok: false, status: 503 });
      await expect((await load())()).rejects.toThrow();
      expect(bodyOf()).toMatch(/self-heal refresh ran and returned HTTP 503/i);
    });

    it("names a missing CRON_SECRET rather than blaming the token", async () => {
      delete process.env.CRON_SECRET;
      mockSingle.mockResolvedValue(readError());
      await expect((await load())()).rejects.toThrow();
      expect(bodyOf()).toMatch(/CRON_SECRET is not set/i);
    });

    it("names the throttle when self-heal was skipped", async () => {
      // First call trips the self-heal; the second is inside the 5-minute
      // per-instance throttle, which is the state the alert must name.
      mockSingle.mockResolvedValue(readError());
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      const getToken = await load();
      await expect(getToken()).rejects.toThrow();
      mockSendAlert.mockClear();
      await expect(getToken()).rejects.toThrow();
      expect(bodyOf()).toMatch(/self-heal refresh was SKIPPED/i);
    });

    it("flags the mirror fallback the on-call will see alongside it", async () => {
      mockSingle.mockResolvedValue(readError());
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect((await load())()).rejects.toThrow();
      expect(bodyOf()).toMatch(/catalog-served-from-mirror/);
    });

    it("puts the diagnosis in the thrown Error too, for Sentry", async () => {
      mockSingle.mockResolvedValue(readError());
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect((await load())()).rejects.toThrow(
        /Cache read: the Supabase read failed/i
      );
    });
  });

  // A token with seconds left used to pass `expiresAt > Date.now()` and die
  // mid-request.
  it("treats a token expiring within the margin as unusable", async () => {
    mockSingle.mockResolvedValue(ok(60_000)); // 1 minute left
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect((await load())()).rejects.toThrow();
  });

  it("accepts a token with more than the margin left", async () => {
    mockSingle.mockResolvedValue(ok(10 * 60_000)); // 10 minutes
    await expect((await load())()).resolves.toBe("tok_live");
  });

  it("treats an already-expired token as unusable", async () => {
    mockSingle.mockResolvedValue(ok(-60_000));
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect((await load())()).rejects.toThrow();
  });
});
