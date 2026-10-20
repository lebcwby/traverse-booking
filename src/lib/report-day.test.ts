import { describe, expect, it } from "vitest";
import {
  REPORT_TIMEZONE,
  civilDate,
  shiftCivilDate,
  yesterdayIn,
  zonedDayBounds,
  zonedDayStart,
} from "./report-day";

describe("civilDate", () => {
  // The case that motivated this: a booking at 20:32 Mountain on Sunday is
  // 02:32 UTC on Monday. Bucketing on UTC files it under the wrong day.
  it("reads an evening Mountain booking as that evening, not the next day", () => {
    expect(civilDate(new Date("2026-10-19T02:32:59.904Z"))).toBe("2026-10-18");
    expect(civilDate(new Date("2026-10-19T01:04:35.774Z"))).toBe("2026-10-18");
    expect(civilDate(new Date("2026-10-18T15:27:59.212Z"))).toBe("2026-10-18");
  });

  it("still agrees with UTC for a midday booking", () => {
    expect(civilDate(new Date("2026-10-18T18:00:00Z"))).toBe("2026-10-18");
  });
});

describe("shiftCivilDate", () => {
  it("walks the calendar, not a fixed number of hours", () => {
    expect(shiftCivilDate("2026-10-18", -1)).toBe("2026-10-17");
    expect(shiftCivilDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftCivilDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("zonedDayBounds", () => {
  it("starts and ends at Mountain midnight, not UTC midnight", () => {
    const { start, end } = zonedDayBounds("2026-10-18");
    // MDT is UTC-6, so the day runs 06:00 UTC to 06:00 UTC.
    expect(start).toBe("2026-10-18T06:00:00.000Z");
    expect(end).toBe("2026-10-19T06:00:00.000Z");
  });

  it("captures all three of Sunday 2026-10-18's bookings", () => {
    const { start, end } = zonedDayBounds("2026-10-18");
    const bookings = [
      "2026-10-18T15:27:59.212Z",
      "2026-10-19T01:04:35.774Z",
      "2026-10-19T02:32:59.904Z",
    ];
    for (const b of bookings) {
      expect(b >= start && b < end).toBe(true);
    }
    // Monday's booking must NOT be in Sunday's window.
    expect("2026-10-19T21:37:44.535Z" < end).toBe(false);
  });

  it("is half-open, so midnight belongs to exactly one day", () => {
    const sunday = zonedDayBounds("2026-10-18");
    const monday = zonedDayBounds("2026-10-19");
    expect(sunday.end).toBe(monday.start);
  });

  // 2026-11-01 is when US DST ends: a 25-hour day in Denver. Getting this
  // wrong loses or double-counts an hour of bookings once a year.
  it("handles the 25-hour day when DST ends", () => {
    const { start, end } = zonedDayBounds("2026-11-01");
    const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
    expect(hours).toBe(25);
    expect(start).toBe("2026-11-01T06:00:00.000Z"); // still MDT (UTC-6)
    expect(end).toBe("2026-11-02T07:00:00.000Z"); // now MST (UTC-7)
  });

  it("handles the 23-hour day when DST begins", () => {
    const { start, end } = zonedDayBounds("2026-03-08");
    const hours = (Date.parse(end) - Date.parse(start)) / 3_600_000;
    expect(hours).toBe(23);
  });

  it("is correct deep in standard time too", () => {
    expect(zonedDayBounds("2026-12-15").start).toBe("2026-12-15T07:00:00.000Z");
  });
});

describe("zonedDayStart", () => {
  it("accepts an explicit zone", () => {
    expect(zonedDayStart("2026-10-18", "UTC").toISOString()).toBe(
      "2026-10-18T00:00:00.000Z"
    );
  });
});

describe("yesterdayIn", () => {
  // The cron fires at 08:35 UTC, which is 02:35 Mountain — still "today" in
  // Denver but already past midnight in UTC. Yesterday must be the Mountain
  // yesterday, or the digest reports a day that is not yet over.
  it("returns the Mountain yesterday when the cron fires at 08:35 UTC", () => {
    expect(yesterdayIn(REPORT_TIMEZONE, new Date("2026-10-19T08:35:00Z"))).toBe(
      "2026-10-18"
    );
  });

  it("does not drift just before Mountain midnight", () => {
    expect(yesterdayIn(REPORT_TIMEZONE, new Date("2026-10-19T05:59:00Z"))).toBe(
      "2026-10-17"
    );
  });
});
