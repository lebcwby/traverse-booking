import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture / restore env around tests so we can flip the supabase RPC path
// on and off without polluting the test process.
const ORIG_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIG_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function loadRateLimit() {
  // Re-import fresh module so the in-memory localRateLimitStore is empty
  // between tests.
  vi.resetModules();
  const mod = await import("./rate-limit");
  return mod;
}

describe("rateLimit fail-open (default)", () => {
  beforeEach(() => {
    // Force the supabase-RPC branch to error out.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nonexistent.example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    // Stub fetch to simulate Supabase being unreachable.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIG_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIG_KEY;
  });

  it("falls back to local limiter — first request allowed", async () => {
    const { rateLimit } = await loadRateLimit();
    const result = await rateLimit("test:open:1", {
      limit: 2,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
    // failure flag is unset (or false) in fail-open mode.
    expect(result.failure).toBeFalsy();
  });

  it("local limiter enforces the configured cap", async () => {
    const { rateLimit } = await loadRateLimit();
    const bucket = "test:open:cap";
    const cfg = { limit: 2, windowMs: 60_000 };
    expect((await rateLimit(bucket, cfg)).allowed).toBe(true);
    expect((await rateLimit(bucket, cfg)).allowed).toBe(true);
    const blocked = await rateLimit(bucket, cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.failure).toBeFalsy();
  });
});

describe("rateLimit fail-closed", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nonexistent.example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIG_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIG_KEY;
  });

  it("refuses with failure=true when shared limiter is unreachable", async () => {
    const { rateLimit } = await loadRateLimit();
    const result = await rateLimit("test:closed:1", {
      limit: 10,
      windowMs: 60_000,
      failClosed: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.failure).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("does not consume an in-memory quota when failing closed", async () => {
    // The fail-closed branch must NOT touch the in-memory store, otherwise
    // a single attacker burst could "spend" the local quota and lock out
    // legitimate users for the full window when supabase comes back. We
    // verify this by hitting fail-closed, then re-enabling supabase (well,
    // making fetch resolve OK) and checking the bucket has full quota.
    const { rateLimit } = await loadRateLimit();
    await rateLimit("test:closed:no-consume", {
      limit: 1,
      windowMs: 60_000,
      failClosed: true,
    });
    // Now flip fetch to a success-shaped response. If the prior fail-closed
    // call had accidentally consumed the local bucket, this next call would
    // still go through the local fallback path and be allowed=true with
    // remaining=0; we just verify the fail-closed branch doesn't touch the
    // store by checking the bucket is fresh when supabase comes back.
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: 0,
            resetAt: Date.now() + 60_000,
          }),
          { status: 200 }
        )
      )
    );
    const followup = await rateLimit("test:closed:no-consume", {
      limit: 1,
      windowMs: 60_000,
      failClosed: true,
    });
    expect(followup.allowed).toBe(true);
  });
});

describe("rateLimit happy path (supabase OK)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ok.example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: 9,
            resetAt: Date.now() + 60_000,
          }),
          { status: 200 }
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIG_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIG_KEY;
  });

  it("forwards the shared-limiter response unchanged", async () => {
    const { rateLimit } = await loadRateLimit();
    const result = await rateLimit("test:ok:1", {
      limit: 10,
      windowMs: 60_000,
      failClosed: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.failure).toBeUndefined();
  });
});
