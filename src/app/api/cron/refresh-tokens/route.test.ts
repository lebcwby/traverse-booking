import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRateLimit,
  mockSendAlert,
  mockFrom,
  mockFetch,
  mockSingle,
  mockUpsert,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockSendAlert: vi.fn(),
  mockFrom: vi.fn(),
  mockFetch: vi.fn(),
  mockSingle: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/alerts", () => ({ sendAlert: mockSendAlert }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

import { GET } from "./route";

const CRON_SECRET = "test-secret";

/** A token that is already stale, so a refresh is genuinely due. */
function staleToken() {
  mockSingle.mockResolvedValue({
    data: { expires_at: Date.now() + 60_000 },
  });
}

function req() {
  return new Request("http://localhost/api/cron/refresh-tokens", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.stubEnv("GUESTY_BEAPI_CLIENT_ID", "beapi-id");
  vi.stubEnv("GUESTY_BEAPI_CLIENT_SECRET", "beapi-secret");
  vi.stubEnv("GUESTY_CLIENT_ID", "");
  vi.stubEnv("GUESTY_CLIENT_SECRET", "");

  mockSingle.mockReset();
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ single: mockSingle }) }),
    upsert: mockUpsert,
  });
  mockSendAlert.mockReset().mockResolvedValue(undefined);
  mockRateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 3 });

  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "tok_new", expires_in: 86400 }),
    text: async () => "",
  });
  vi.stubGlobal("fetch", mockFetch);
});

describe("Guesty OAuth mint budget", () => {
  // Guesty allows 5 mints per 24h per client. Burning all 5 is a 24-hour
  // lockout with no recovery. The expiry-buffer check is not a lock: when the
  // token is genuinely stale every concurrent caller passes it.
  it("mints when the budget allows it", async () => {
    staleToken();
    await GET(req());

    expect(mockRateLimit).toHaveBeenCalledWith(
      "guesty-token-mint:beapi",
      expect.objectContaining({ limit: 4, windowMs: 24 * 60 * 60 * 1000 })
    );
    const oauthCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("oauth2/token")
    );
    expect(oauthCalls).toHaveLength(1);
  });

  it("REFUSES to mint once the budget is exhausted", async () => {
    staleToken();
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    const res = await GET(req());

    const oauthCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("oauth2/token")
    );
    expect(oauthCalls).toHaveLength(0);
    expect(res.status).toBe(500);
  });

  it("alerts loudly when it refuses — the token WILL expire", async () => {
    staleToken();
    mockRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    await GET(req());

    expect(mockSendAlert).toHaveBeenCalled();
    const [subject, body] = mockSendAlert.mock.calls[0];
    expect(String(subject)).toMatch(/mint budget exhausted/i);
    // The reader must understand this is recoverable and a lockout is not.
    expect(String(body)).toMatch(/locked out|24 hours/i);
  });

  // The budget must not be consumed by a refresh that was never needed, or a
  // healthy site would burn through it in two days.
  it("does not touch the budget when the token is still fresh", async () => {
    mockSingle.mockResolvedValue({
      data: { expires_at: Date.now() + 20 * 60 * 60 * 1000 },
    });

    await GET(req());

    expect(mockRateLimit).not.toHaveBeenCalled();
    const oauthCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("oauth2/token")
    );
    expect(oauthCalls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller before doing anything", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/refresh-tokens")
    );
    expect(res.status).toBe(401);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
