import { describe, expect, it } from "vitest";
import {
  buildWeeklyDigest,
  delta,
  nightsBetween,
  renderWeeklySlackBlocks,
} from "./weekly-digest";
import { previousWeekIn, zonedRangeBounds } from "./report-day";

// Mirrors the fixture in ./booking-digest.test.ts: the money and the stay
// dates live in `tracking`, the channel in a JSON `attribution` cookie.
const cookies = (attribution?: object) => ({
  cookies: {
    ...(attribution ? { attribution: JSON.stringify(attribution) } : {}),
  },
});

const tracking = (over: Record<string, unknown> = {}) => ({
  listingTitle: "Mountain-View Cabin",
  checkIn: "2026-11-01",
  checkOut: "2026-11-04", // 3 nights
  guests: 3,
  totalPaid: 500,
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  reservation_id: "GY-abc123",
  guest: { firstName: "Kelly", lastName: "Watson" },
  tracking: tracking(),
  tracking_context: cookies({ utm_source: "google", utm_medium: "cpc" }),
  created_at: "2026-10-12T18:00:00.000Z",
  // 2026-10-12T18:00Z is 12:00 Mountain on Monday 2026-10-12.
  completed_at: "2026-10-12T18:00:00.000Z",
  ...over,
});

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2026-10-12", "2026-10-15")).toBe(3);
  });

  it("is zero for a same-day or reversed range", () => {
    expect(nightsBetween("2026-10-12", "2026-10-12")).toBe(0);
    expect(nightsBetween("2026-10-15", "2026-10-12")).toBe(0);
  });

  it("is zero rather than NaN for unparseable dates", () => {
    expect(nightsBetween("", "2026-10-15")).toBe(0);
    expect(nightsBetween("not-a-date", "also-not")).toBe(0);
  });
});

describe("delta", () => {
  it("formats movement in both directions", () => {
    expect(delta(12, 10)).toBe("+20%");
    expect(delta(8, 10)).toBe("−20%");
  });

  it("says flat rather than +0%", () => {
    expect(delta(10, 10)).toBe("flat");
  });

  it("refuses to divide by a zero or missing prior", () => {
    expect(delta(5, 0)).toBe("—");
    expect(delta(5, undefined)).toBe("—");
  });
});

describe("previousWeekIn", () => {
  it("returns the Mon-Sun week before, run on a Monday", () => {
    // 2026-10-19 is a Monday; 00:45 Mountain is 06:45Z.
    const now = new Date("2026-10-19T06:45:00.000Z");
    expect(previousWeekIn("America/Denver", now)).toEqual({
      start: "2026-10-12",
      end: "2026-10-18",
    });
  });

  it("returns the same week from any day of the current week", () => {
    const monday = previousWeekIn(
      "America/Denver",
      new Date("2026-10-19T18:00:00.000Z")
    );
    const thursday = previousWeekIn(
      "America/Denver",
      new Date("2026-10-22T18:00:00.000Z")
    );
    const sunday = previousWeekIn(
      "America/Denver",
      new Date("2026-10-25T18:00:00.000Z")
    );
    expect(thursday).toEqual(monday);
    expect(sunday).toEqual(monday);
  });

  it("crosses a month boundary correctly", () => {
    // Monday 2026-11-02 -> previous week is Mon 2026-10-26 to Sun 2026-11-01.
    const now = new Date("2026-11-02T07:45:00.000Z");
    expect(previousWeekIn("America/Denver", now)).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
    });
  });
});

describe("zonedRangeBounds", () => {
  it("spans a whole week half-open", () => {
    const { start, end } = zonedRangeBounds("2026-10-12", "2026-10-18");
    // MDT is UTC-6, so Mountain midnight is 06:00Z.
    expect(start).toBe("2026-10-12T06:00:00.000Z");
    expect(end).toBe("2026-10-19T06:00:00.000Z");
  });

  it("is 169 hours across the DST fall-back, not 168", () => {
    // US DST ends Sunday 2026-11-01, so this week gains an hour.
    const { start, end } = zonedRangeBounds("2026-10-26", "2026-11-01");
    const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
    expect(hours).toBe(169);
  });
});

describe("buildWeeklyDigest", () => {
  it("totals value and nights and averages them", () => {
    const d = buildWeeklyDigest(
      [
        row(), // 500, 3 nights
        row({
          tracking: tracking({
            totalPaid: 300,
            checkIn: "2026-12-01",
            checkOut: "2026-12-03", // 2 nights
          }),
        }),
      ] as never,
      "2026-10-12",
      "2026-10-18"
    );
    expect(d.totals.bookings).toBe(2);
    expect(d.totals.value).toBe(800);
    expect(d.totals.nights).toBe(5);
    expect(d.avgValue).toBe(400);
    expect(d.avgNights).toBe(2.5);
  });

  it("zero-fills every day of the week, Monday first", () => {
    const d = buildWeeklyDigest([row()] as never, "2026-10-12", "2026-10-18");
    expect(d.byDay).toHaveLength(7);
    expect(d.byDay[0].day).toBe("2026-10-12");
    expect(d.byDay[6].day).toBe("2026-10-18");
    // The single booking completed midday Monday Mountain time.
    expect(d.byDay[0].count).toBe(1);
    expect(d.byDay.slice(1).every((x) => x.count === 0)).toBe(true);
  });

  it("buckets a late-evening Mountain booking on its own day, not the next", () => {
    // 2026-10-14T03:30Z is 21:30 Mountain on Tuesday 2026-10-13. Bucketing on
    // UTC would wrongly put it on Wednesday.
    const d = buildWeeklyDigest(
      [row({ completed_at: "2026-10-14T03:30:00.000Z" })] as never,
      "2026-10-12",
      "2026-10-18"
    );
    expect(d.byDay[1].day).toBe("2026-10-13");
    expect(d.byDay[1].count).toBe(1);
    expect(d.byDay[2].count).toBe(0);
  });

  it("ranks channels by count then value", () => {
    const bing = {
      tracking_context: cookies({ utm_source: "bing", utm_medium: "cpc" }),
    };
    const d = buildWeeklyDigest(
      [row(), row(), row(bing)] as never,
      "2026-10-12",
      "2026-10-18"
    );
    expect(d.bySource).toHaveLength(2);
    expect(d.bySource[0]).toMatchObject({ source: "google / cpc", count: 2 });
    expect(d.bySource[1]).toMatchObject({ source: "bing / cpc", count: 1 });
  });

  it("carries a prior week through for comparison, and tolerates its absence", () => {
    const withPrior = buildWeeklyDigest(
      [row()] as never,
      "2026-10-12",
      "2026-10-18",
      [row(), row()] as never
    );
    expect(withPrior.prior?.bookings).toBe(2);

    const without = buildWeeklyDigest([row()] as never, "2026-10-12", "2026-10-18");
    expect(without.prior).toBeNull();
  });
});

describe("renderWeeklySlackBlocks", () => {
  it("renders an explicit empty state rather than an empty table", () => {
    const d = buildWeeklyDigest([], "2026-10-12", "2026-10-18");
    const payload = renderWeeklySlackBlocks(d) as {
      text: string;
      blocks: unknown[];
    };
    expect(payload.text).toContain("none");
    expect(JSON.stringify(payload)).toContain("No website bookings");
  });

  it("puts the range and totals in the fallback text", () => {
    const d = buildWeeklyDigest([row()] as never, "2026-10-12", "2026-10-18");
    const payload = renderWeeklySlackBlocks(d) as { text: string };
    expect(payload.text).toContain("Oct 12");
    expect(payload.text).toContain("Oct 18");
    expect(payload.text).toContain("1 bookings");
  });

  it("shows week-on-week movement only when a prior week exists", () => {
    const withPrior = renderWeeklySlackBlocks(
      buildWeeklyDigest([row(), row()] as never, "2026-10-12", "2026-10-18", [
        row(),
      ] as never)
    );
    expect(JSON.stringify(withPrior)).toContain("vs prior week");

    const without = renderWeeklySlackBlocks(
      buildWeeklyDigest([row()] as never, "2026-10-12", "2026-10-18")
    );
    expect(JSON.stringify(without)).not.toContain("vs prior week");
  });
});
