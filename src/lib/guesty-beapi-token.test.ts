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
vi.mock("./alerts", () => ({ sendAlert: mockSendAlert }));
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
    expect(body).toMatch(/unreadable/i);
    expect(subject).not.toMatch(/expired/i);
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
