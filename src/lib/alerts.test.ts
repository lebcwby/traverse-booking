import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

import {
  buildStripeDashboardPaymentUrl,
  claimAlert,
  DEFAULT_CADENCE_HOURS,
  formatDurationMs,
  PER_ENTITY_CADENCE_HOURS,
  renderAlertDetails,
  renderAlertLinks,
  resolveAlertIncident,
  wasAlertSentRecently,
} from "./alerts";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
});

describe("alerts helpers", () => {
  it("builds live and test Stripe dashboard links correctly", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_123";
    expect(buildStripeDashboardPaymentUrl("pi_live")).toBe(
      "https://dashboard.stripe.com/payments/pi_live"
    );

    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(buildStripeDashboardPaymentUrl("pi_test")).toBe(
      "https://dashboard.stripe.com/test/payments/pi_test"
    );
  });

  it("formats duration values for alerts", () => {
    expect(formatDurationMs(5 * 60 * 1000)).toBe("5m");
    expect(formatDurationMs(125 * 60 * 1000)).toBe("2h 5m");
    expect(formatDurationMs(26 * 60 * 60 * 1000)).toBe("1d 2h");
  });

  it("renders escaped detail tables and link lists", () => {
    const details = renderAlertDetails([
      ["Guest email", "guest@example.com"],
      ["Error", "<script>alert(1)</script>"],
      ["Blank", ""],
    ]);
    const links = renderAlertLinks([
      {
        label: "Stripe payment",
        url: "https://dashboard.stripe.com/payments/pi_123",
      },
      { label: "Ignore me", url: "" },
    ]);

    expect(details).toContain("guest@example.com");
    expect(details).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(details).not.toContain(">Blank<");
    expect(links).toContain("Stripe payment");
    expect(links).toContain("https://dashboard.stripe.com/payments/pi_123");
  });
});

describe("claimAlert — atomic cross-instance dedup", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("claims on a fresh key (RETURNING a single row)", async () => {
    // Use a unique key per test to bypass the in-memory shortcut that
    // sendAlert installs after a claimed send.
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_new: true, reminder_count: 1 }],
    });
    const result = await claimAlert(
      "unique-fresh-key-1",
      DEFAULT_CADENCE_HOURS
    );
    expect(result).toMatchObject({
      claimed: true,
      isNew: true,
      reminderCount: 1,
    });
    // The predicate must forward the cadence array verbatim — getting the
    // array indexing wrong is the whole way this helper could re-introduce
    // the 2026-11-10 07:14:49Z pattern.
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe("unique-fresh-key-1");
    expect(params[1]).toEqual(DEFAULT_CADENCE_HOURS);
  });

  it("stays silent when the cadence predicate filters out the UPDATE", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await claimAlert(
      "unique-silent-key-1",
      DEFAULT_CADENCE_HOURS
    );
    expect(result).toMatchObject({
      claimed: false,
      reason: "inside-cadence",
    });
  });

  it("degrades to a best-effort SEND on DB error", async () => {
    // A thrown pg query must not swallow alerts: a Supabase outage should
    // tolerate duplicate emails, never zero emails.
    mockQuery.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    const result = await claimAlert(
      "unique-db-error-key-1",
      DEFAULT_CADENCE_HOURS
    );
    expect(result).toMatchObject({
      claimed: true,
      reason: "db-error",
    });
  });

  it("threads reminder_count back to the caller for subject prefixing", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ is_new: false, reminder_count: 3 }],
    });
    const result = await claimAlert(
      "unique-reminder-key-1",
      DEFAULT_CADENCE_HOURS
    );
    expect(result.reminderCount).toBe(3);
  });

  it("per-entity cadence is distinct from incident cadence", () => {
    // Regression guard: these two constants are the semantic contract between
    // alerts.ts and the per-PI callers (recover-checkouts, orphan-sweep).
    // Flipping them would quietly reinstate the hourly per-PI email flood.
    expect(DEFAULT_CADENCE_HOURS).toEqual([1, 4, 24]);
    expect(PER_ENTITY_CADENCE_HOURS).toEqual([24, 24]);
  });
});

describe("resolveAlertIncident", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("issues the explicit resolve update", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await resolveAlertIncident("some-key");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(String(sql)).toMatch(/update\s+public\.alert_incidents/i);
    expect(String(sql)).toMatch(/set resolved_at = now\(\)/i);
    expect(params[0]).toBe("some-key");
  });

  it("swallows DB errors — resolution is best-effort", async () => {
    mockQuery.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(resolveAlertIncident("x")).resolves.toBeUndefined();
  });
});

describe("wasAlertSentRecently", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("returns false when there's no open row", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await wasAlertSentRecently("some-key", 60_000)).toBe(false);
  });

  it("returns true when last_sent_at is inside the window", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ last_sent_at: new Date(Date.now() - 1_000) }],
    });
    expect(await wasAlertSentRecently("some-key", 60_000)).toBe(true);
  });

  it("returns false when last_sent_at is older than the window", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ last_sent_at: new Date(Date.now() - 120_000) }],
    });
    expect(await wasAlertSentRecently("some-key", 60_000)).toBe(false);
  });
});
