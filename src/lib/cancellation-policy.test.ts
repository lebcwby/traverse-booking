import { describe, expect, it } from "vitest";
import {
  CANCELLATION_POLICY_DAYS,
  calendarDaysBeforeCheckIn,
  checkoutCancellationText,
  freeCancellationLabel,
  isFullRefundEligible,
  lastRefundableCalendarDate,
  listingCancellationBadge,
  resolveCheckInDate,
} from "./cancellation-policy";

/**
 * Check-in is 2026-10-26, a Monday. Exactly 14 calendar days before is
 * 2026-10-12. October 2026 is still MDT (UTC−6); DST ends 2026-11-01.
 */
const CHECK_IN = "2026-10-26";

describe("14-day cancellation cutoff", () => {
  it("refunds at 15 days out", () => {
    // 2026-10-11 is 15 calendar days before Oct 26, including late evening.
    const now = new Date("2026-10-12T05:59:00.000Z"); // Oct 11, 11:59pm MDT
    expect(calendarDaysBeforeCheckIn(CHECK_IN, now)).toBe(15);
    expect(isFullRefundEligible(CHECK_IN, now)).toBe(true);
  });

  it("refunds at 14 days out, through 11:59pm Mountain", () => {
    const morning = new Date("2026-10-12T06:00:00.000Z"); // Oct 12, 12:00am MDT
    const lastMinute = new Date("2026-10-13T05:59:00.000Z"); // Oct 12, 11:59pm MDT
    expect(calendarDaysBeforeCheckIn(CHECK_IN, morning)).toBe(14);
    expect(isFullRefundEligible(CHECK_IN, morning)).toBe(true);
    expect(calendarDaysBeforeCheckIn(CHECK_IN, lastMinute)).toBe(14);
    expect(isFullRefundEligible(CHECK_IN, lastMinute)).toBe(true);
    expect(lastRefundableCalendarDate(CHECK_IN)).toBe("2026-10-12");
  });

  it("does not refund at 13 days out, from 12:00am Mountain", () => {
    // Same UTC date as the last refundable minute, one minute later.
    const now = new Date("2026-10-13T06:00:00.000Z"); // Oct 13, 12:00am MDT
    expect(civilTodayIs(now, "2026-10-13")).toBe(true);
    expect(calendarDaysBeforeCheckIn(CHECK_IN, now)).toBe(13);
    expect(isFullRefundEligible(CHECK_IN, now)).toBe(false);
  });

  it("does not refund at 2 days out", () => {
    const now = new Date("2026-10-24T18:00:00.000Z"); // Oct 24, 12:00pm MDT
    expect(calendarDaysBeforeCheckIn(CHECK_IN, now)).toBe(2);
    expect(isFullRefundEligible(CHECK_IN, now)).toBe(false);
  });

  it("counts calendar days across the November DST change, not 14×24 hours", () => {
    // Check-in Nov 8. 14 calendar days before is Oct 25. The span includes
    // the DST fallback (Nov 1), so it is 337 hours, not 336.
    const checkIn = "2026-11-08";
    const stillRefundable = new Date("2026-10-26T05:59:00.000Z"); // Oct 25, 11:59pm MDT
    const notRefundable = new Date("2026-10-26T06:00:00.000Z"); // Oct 26, 12:00am MDT
    expect(calendarDaysBeforeCheckIn(checkIn, stillRefundable)).toBe(14);
    expect(isFullRefundEligible(checkIn, stillRefundable)).toBe(true);
    expect(calendarDaysBeforeCheckIn(checkIn, notRefundable)).toBe(13);
    expect(isFullRefundEligible(checkIn, notRefundable)).toBe(false);
    expect(CANCELLATION_POLICY_DAYS).toBe(14);
  });
});

describe("check-in date parsing", () => {
  const now = new Date("2026-10-12T18:00:00.000Z"); // Oct 12, noon MDT

  it("treats a date-only string as the calendar date, not UTC midnight", () => {
    expect(resolveCheckInDate("2026-10-26")).toBe("2026-10-26");
    expect(isFullRefundEligible("2026-10-26", now)).toBe(true);
  });

  it("converts a 4pm Mountain instant to the arrival day", () => {
    // 4:00pm MDT = 22:00 UTC, still Oct 26 in Denver.
    expect(resolveCheckInDate("2026-10-26T22:00:00.000Z")).toBe("2026-10-26");
    expect(isFullRefundEligible("2026-10-26T22:00:00.000Z", now)).toBe(true);
  });

  it("uses the date picker's local calendar day", () => {
    const picked = new Date(2026, 9, 26, 12, 0, 0);
    expect(resolveCheckInDate(picked)).toBe("2026-10-26");
    expect(isFullRefundEligible(picked, now)).toBe(true);
  });

  it("fails closed when the check-in cannot be read", () => {
    expect(resolveCheckInDate("not-a-date")).toBeNull();
    expect(isFullRefundEligible("not-a-date", now)).toBe(false);
    expect(calendarDaysBeforeCheckIn("", now)).toBeNull();
  });
});

describe("guest-facing labels", () => {
  const onThe14thDay = new Date("2026-10-12T18:00:00.000Z");
  const onThe13thDay = new Date("2026-10-13T18:00:00.000Z");

  it("names the last refundable day when the stay is still free to cancel", () => {
    expect(freeCancellationLabel(CHECK_IN, onThe14thDay)).toBe(
      "Free cancellation through Oct 12"
    );
    expect(checkoutCancellationText(CHECK_IN, onThe14thDay)).toBe(
      "Cancel through Oct 12 for a full refund."
    );
    expect(listingCancellationBadge(CHECK_IN, onThe14thDay)).toBe(
      "Free cancellation"
    );
  });

  it("says non-refundable inside the window, including at 2 days", () => {
    const twoDays = new Date("2026-10-24T18:00:00.000Z");
    expect(freeCancellationLabel(CHECK_IN, onThe13thDay)).toBe(
      "Non-refundable"
    );
    expect(freeCancellationLabel(CHECK_IN, twoDays)).toBe("Non-refundable");
    expect(listingCancellationBadge(CHECK_IN, onThe13thDay)).toBe(
      "Non-refundable"
    );
    expect(listingCancellationBadge(CHECK_IN, twoDays)).toBe("Non-refundable");
    expect(checkoutCancellationText(CHECK_IN, twoDays)).toContain(
      "non-refundable"
    );
  });

  it("states the window when no check-in is selected", () => {
    expect(freeCancellationLabel(null, onThe13thDay)).toBe(
      "Free cancellation up to 14 days before check-in"
    );
    expect(listingCancellationBadge(null, onThe13thDay)).toBe(
      "Free cancellation up to 14 days"
    );
    expect(listingCancellationBadge(undefined, onThe13thDay)).toBe(
      "Free cancellation up to 14 days"
    );
  });
});

function civilTodayIs(now: Date, iso: string): boolean {
  return (
    calendarDaysBeforeCheckIn(CHECK_IN, now) === expectedDays(iso, CHECK_IN)
  );
}

function expectedDays(today: string, checkIn: string): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = checkIn.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}
