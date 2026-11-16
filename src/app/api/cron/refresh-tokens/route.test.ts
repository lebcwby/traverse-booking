import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRateLimit,
  mockSendAlert,
  mockFrom,
  mockFetch,
  mockSingle,
  mockUpsert,
  mockAdvisoryLocksEffective,
  mockWithAdvisoryLock,
  mockPoolQuery,
} = vi.hoisted(() => ({
  mockRateLimit: vi.fn(),
  mockSendAlert: vi.fn(),
  mockFrom: vi.fn(),
  mockFetch: vi.fn(),
  mockSingle: vi.fn(),
  mockUpsert: vi.fn(),
  mockAdvisoryLocksEffective: vi.fn(),
  mockWithAdvisoryLock: vi.fn(),
  mockPoolQuery: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/alerts", () => ({ sendAlert: mockSendAlert }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));
vi.mock("@/lib/db", () => ({
  advisoryLocksEffective: mockAdvisoryLocksEffective,
  withAdvisoryLock: mockWithAdvisoryLock,
  getPool: () => ({ query: mockPoolQuery }),
}));

import { GET } from "./route";

const CRON_SECRET = "test-secret";

/** A token that is already stale, so a refresh is genuinely due. */
function staleToken() {
  mockSingle.mockResolvedValue({
    data: { expires_at: Date.now() + 60_000 },
  });
}

/** A token that has 20h of life left — comfortably inside the 6h buffer. */
function freshToken() {
  mockSingle.mockResolvedValue({
    data: { expires_at: Date.now() + 20 * 60 * 60 * 1000 },
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
  vi.stubEnv("BEAPI_MINT_V2", "");

  mockSingle.mockReset();
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ single: mockSingle }) }),
    upsert: mockUpsert,
  });
  mockSendAlert.mockReset().mockResolvedValue(undefined);
  mockRateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 3 });
  mockAdvisoryLocksEffective.mockReset().mockReturnValue(true);
  // By default pass-through: run the body with no lock.
  mockWithAdvisoryLock
    .mockReset()
    .mockImplementation(async (_key: string, fn: () => Promise<unknown>) =>
      fn()
    );
  // 0 successful mints in the last 24h — the default is "budget available".
  mockPoolQuery.mockReset().mockResolvedValue({ rows: [{ count: "0" }] });

  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ access_token: "tok_new", expires_in: 86400 }),
    text: async () => "",
  });
  vi.stubGlobal("fetch", mockFetch);
});

// ─── V1 (legacy) tests, kept intact ─────────────────────────────────────

describe("Guesty OAuth mint budget — V1 (legacy path)", () => {
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
    freshToken();

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

// ─── V2 tests (flag-gated) ───────────────────────────────────────────────

describe("Guesty OAuth mint budget — V2 (BEAPI_MINT_V2=1)", () => {
  beforeEach(() => {
    vi.stubEnv("BEAPI_MINT_V2", "1");
  });

  it("refuses to run when advisoryLocksEffective() is false", async () => {
    // Hard-assert: a pooled (:6543) connection makes pg_advisory_lock a no-op,
    // which quietly reverts V2 to V1's concurrency guarantees without
    // changing the branch. The whole point of V2 is the lock, so this must
    // throw loudly rather than silently degrade. This is the "test that
    // fails if it runs on the pooled one" called for in the Phase 2 brief.
    mockAdvisoryLocksEffective.mockReturnValue(false);
    staleToken();

    const res = await GET(req());

    expect(res.status).toBe(500);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockWithAdvisoryLock).not.toHaveBeenCalled();
    // Must mention the fix: SHARED_DATABASE_URL_DIRECT / port 5432.
    const body = await res.json();
    expect(String(body.beapi.error)).toMatch(
      /SHARED_DATABASE_URL_DIRECT|session-mode|5432/i
    );
  });

  it("acquires the advisory lock keyed per token type", async () => {
    staleToken();

    await GET(req());

    expect(mockWithAdvisoryLock).toHaveBeenCalled();
    const [lockKey] = mockWithAdvisoryLock.mock.calls[0];
    expect(lockKey).toBe("guesty-mint:beapi");
  });

  it("counts SUCCESSFUL mints in token_mint_log, not attempts", async () => {
    staleToken();

    await GET(req());

    // The budget check must be a SELECT COUNT over token_mint_log, so a
    // 429 that never reaches the insert is free of charge.
    const budgetCall = mockPoolQuery.mock.calls.find((c) =>
      /select\s+count[\s\S]*token_mint_log/i.test(String(c[0]))
    );
    expect(budgetCall).toBeTruthy();
    expect(budgetCall![1]).toEqual(["beapi"]);
    // And rateLimit (V1 budget) must NOT be touched.
    expect(mockRateLimit).not.toHaveBeenCalled();
  });

  it("logs a row ONLY after OAuth + upsert succeed", async () => {
    staleToken();

    await GET(req());

    const insertCall = mockPoolQuery.mock.calls.find((c) =>
      /insert into public\.token_mint_log/i.test(String(c[0]))
    );
    expect(insertCall).toBeTruthy();
    const [, params] = insertCall!;
    expect(params[0]).toBe("beapi");
    // trigger source: "manual" because the test request has no vercel-cron UA.
    expect(params[2]).toBe("manual");
  });

  it("does NOT log a row when OAuth 429s — V2's whole point", async () => {
    staleToken();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "",
      json: async () => ({}),
    });

    await GET(req());

    const insertCall = mockPoolQuery.mock.calls.find((c) =>
      /insert into public\.token_mint_log/i.test(String(c[0]))
    );
    expect(insertCall).toBeFalsy();
  });

  it("REFUSES to mint once 4 successful mints are on the log in 24h", async () => {
    staleToken();
    // First pool call is the budget SELECT — 4 rows already.
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (/select\s+count[\s\S]*token_mint_log/i.test(sql)) {
        return { rows: [{ count: "4" }] };
      }
      return { rows: [] };
    });

    const res = await GET(req());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(500);
    expect(mockSendAlert).toHaveBeenCalled();
    const [subject] = mockSendAlert.mock.calls[0];
    expect(String(subject)).toMatch(/mint budget exhausted/i);
  });

  it("re-reads inside the lock and skips mint when a peer already minted", async () => {
    // First Supabase read inside the lock returns a FRESH token (a peer
    // minted while we were waiting). The lock-body skips, no OAuth fires.
    freshToken();

    await GET(req());

    expect(mockFetch).not.toHaveBeenCalled();
    const insertCall = mockPoolQuery.mock.calls.find((c) =>
      /insert into public\.token_mint_log/i.test(String(c[0]))
    );
    expect(insertCall).toBeFalsy();
  });

  it("end-of-refresh verify FAILS when the row is still stale", async () => {
    // First Supabase read (inside lock) says stale → mint. OAuth succeeds,
    // upsert "succeeds" (in the mock). But the verify SELECT returns a row
    // that still looks stale — e.g. a stray write landed on top. The cron
    // must return HTTP 500 rather than claim success on a stale table.
    const stale = { data: { expires_at: Date.now() + 60_000 } };
    const stillStale = { data: { expires_at: Date.now() + 60_000 } };
    mockSingle
      .mockResolvedValueOnce(stale) // inside lock, triggers mint
      .mockResolvedValueOnce(stillStale); // end-of-refresh verify

    const res = await GET(req());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(String(body.beapi.error)).toMatch(/end-of-refresh/i);
  });
});
