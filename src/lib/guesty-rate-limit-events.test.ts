import { describe, expect, it } from "vitest";
import { renderSummary, summarize } from "./guesty-rate-limit-events";

/** An ISO timestamp `minutesAgo` before the fixed `now`. */
const NOW = Date.parse("2026-10-14T12:00:00.000Z");
const at = (iso: string) => ({ occurred_at: iso });

describe("summarize", () => {
  it("returns zeroes for no events", () => {
    const s = summarize([], NOW);
    expect(s).toEqual({
      lastHour: 0,
      lastWeek: 0,
      minuteBuckets: [0, 0, 0, 0, 0, 0],
    });
  });

  it("counts the last hour separately from the last week", () => {
    const s = summarize(
      [
        at("2026-10-14T11:30:00.000Z"), // 30 min ago
        at("2026-10-14T11:59:00.000Z"), // 1 min ago
        at("2026-10-13T09:00:00.000Z"), // yesterday
        at("2026-10-09T09:00:00.000Z"), // 5 days ago
      ],
      NOW
    );
    expect(s.lastHour).toBe(2);
    expect(s.lastWeek).toBe(4);
  });

  it("excludes anything older than the window", () => {
    const s = summarize([at("2026-09-01T09:00:00.000Z")], NOW);
    expect(s.lastWeek).toBe(0);
  });

  it("ignores an unparseable timestamp rather than counting it as epoch", () => {
    const s = summarize(
      [at("not a date"), at("2026-10-14T11:30:00.000Z")],
      NOW
    );
    expect(s.lastWeek).toBe(1);
  });

  // This is the diagnostic the whole module exists for: our own traffic has no
  // reason to favour a minute, a cron does.
  it("buckets by minute of hour so a cron cluster is visible", () => {
    const s = summarize(
      [
        at("2026-10-14T09:02:00.000Z"),
        at("2026-10-14T10:04:00.000Z"),
        at("2026-10-14T11:09:00.000Z"),
        at("2026-10-13T08:01:00.000Z"),
        at("2026-10-14T10:37:00.000Z"),
      ],
      NOW
    );
    // Four events in :00–:09, one in :30–:39.
    expect(s.minuteBuckets[0]).toBe(4);
    expect(s.minuteBuckets[3]).toBe(1);
    expect(s.minuteBuckets.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("puts :59 in the last bucket, not out of range", () => {
    const s = summarize([at("2026-10-14T11:59:00.000Z")], NOW);
    expect(s.minuteBuckets[5]).toBe(1);
  });
});

describe("renderSummary", () => {
  it("renders nothing when there is no history to show", () => {
    expect(
      renderSummary({
        lastHour: 0,
        lastWeek: 0,
        minuteBuckets: [0, 0, 0, 0, 0, 0],
      })
    ).toBe("");
  });

  it("states both counts and draws a bar per bucket", () => {
    const html = renderSummary({
      lastHour: 6,
      lastWeek: 40,
      minuteBuckets: [30, 2, 2, 2, 2, 2],
    });
    expect(html).toContain("6 in the last hour");
    expect(html).toContain("40 in the last 7 days");
    expect(html).toContain(":00–:09");
    expect(html).toContain(":50–:59");
    // The dominant bucket must be visually dominant.
    const bars = [...html.matchAll(/█+/g)].map((m) => m[0].length);
    expect(Math.max(...bars)).toBeGreaterThan(Math.min(...bars));
  });

  it("names the shared-account reading so the alert is not misread as a scraper", () => {
    const html = renderSummary({
      lastHour: 1,
      lastWeek: 9,
      minuteBuckets: [9, 0, 0, 0, 0, 0],
    });
    expect(html).toMatch(/cron on the shared\s+Guesty account/);
    expect(html).toMatch(/not at this site/);
  });

  it("does not divide by zero when every bucket is empty but a count exists", () => {
    // Possible if events are all outside the bucketed window edge cases.
    expect(() =>
      renderSummary({
        lastHour: 0,
        lastWeek: 3,
        minuteBuckets: [0, 0, 0, 0, 0, 0],
      })
    ).not.toThrow();
  });
});
