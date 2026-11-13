import { describe, expect, it } from "vitest";
import { buildDigest, CLUSTER_SHARE, ELEVATED_24H } from "./route";

const NOW = Date.parse("2026-10-28T07:35:00Z");

/** `count` events, all at `minute` past the hour, spread over recent days. */
function events(count: number, minute: number, hoursAgo = 1) {
  return Array.from({ length: count }, (_, i) => ({
    occurred_at: new Date(
      NOW - hoursAgo * 3_600_000 - i * 60_000 * 0 - (i % 6) * 3_600_000
    )
      .toISOString()
      .replace(/T(\d{2}):\d{2}/, (_m, h) => `T${h}:${String(minute).padStart(2, "0")}`),
  }));
}

describe("buildDigest", () => {
  // The reason this is a digest and not a daily report: a mail that arrives
  // every morning to say nothing happened is the same noise in a wrapper.
  it("sends nothing on a day with no 429s", () => {
    expect(buildDigest([], NOW)).toBeNull();
  });

  it("ignores events older than 24h when deciding to send", () => {
    const old = [{ occurred_at: new Date(NOW - 3 * 86_400_000).toISOString() }];
    expect(buildDigest(old, NOW)).toBeNull();
  });

  it("reports a quiet day without the warning marker", () => {
    const d = buildDigest(events(10, 25), NOW)!;
    expect(d).not.toBeNull();
    expect(d.elevated).toBe(false);
    expect(d.subject).not.toContain("⚠️");
    expect(d.body).toContain("background level");
  });

  it("marks the subject when volume clears the elevated bar", () => {
    const d = buildDigest(events(ELEVATED_24H, 25), NOW)!;
    expect(d.elevated).toBe(true);
    expect(d.subject).toContain("⚠️");
    expect(d.subject).toContain(String(ELEVATED_24H));
  });

  // The finding this whole change rests on: minute :25 is our own cron, and
  // the previous alert text insisted it could not be us.
  it("names our own cron when the :20–:29 bucket dominates", () => {
    const d = buildDigest(events(60, 25), NOW)!;
    expect(d.peakBucket).toBe(":20–:29");
    expect(d.peakShare).toBeGreaterThanOrEqual(CLUSTER_SHARE);
    expect(d.body).toContain("sync-calendar");
    expect(d.body).toContain("REQUEST_SPACING_MS");
  });

  it("points elsewhere when the cluster is not in our window", () => {
    const d = buildDigest(events(60, 3), NOW)!;
    expect(d.peakBucket).toBe(":00–:09");
    expect(d.body).toContain("another integration");
    expect(d.body).not.toContain("REQUEST_SPACING_MS");
  });

  // Six buckets means even spread is ~17% each. Calling the largest of six
  // near-equal buckets a "cluster" would send the reader chasing nothing.
  it("refuses to call an even spread a cluster", () => {
    const spread = [0, 10, 20, 30, 40, 50].flatMap((m) => events(10, m));
    const d = buildDigest(spread, NOW)!;
    expect(d.peakShare).toBeLessThan(CLUSTER_SHARE);
    expect(d.body).toContain("No single minute-of-hour dominates");
    // The chart's legend always explains what :20–:29 would mean; what must
    // not appear is the LEAD blaming a specific job for this day's events.
    expect(d.body).not.toContain("REQUEST_SPACING_MS");
    expect(d.body).not.toContain("% of the week's 429s fall in");
  });
});
