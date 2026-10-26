/**
 * Direct-booking cancellation policy.
 *
 * A full refund is allowed only when the guest cancels 14 or more calendar
 * days before check-in. Within 14 days the stay is non-refundable. The day
 * that is exactly 14 days before check-in is still a full refund, through
 * 11:59pm America/Denver. The next Mountain morning is not.
 *
 * Days are counted in America/Denver because every Traverse property checks
 * in on Mountain time. A guest browsing from another zone and the UTC server
 * that issues the refund have to agree, including across the November DST
 * change, so this is calendar days rather than 14 × 24 hours.
 *
 * Date-only strings (`YYYY-MM-DD`, Guesty's checkInDateLocalized) are the
 * check-in calendar date. They are not parsed as UTC midnight, which would
 * land on the previous evening in Denver. A `Date` from the date picker is
 * the calendar day the guest selected (its local year/month/day), not an
 * instant. Strings with `Z` or a numeric offset are instants and are
 * converted to the Denver calendar date, so a 4:00pm Mountain check-in stays
 * on the arrival day.
 *
 * An unreadable check-in fails closed: not refundable. We would rather ask
 * the guest to contact us than issue a Stripe refund we cannot justify.
 */

import { civilDate, shiftCivilDate } from "./report-day";

export const CANCELLATION_POLICY_DAYS = 14;

export const CANCELLATION_TIMEZONE = "America/Denver";

export const CANCELLATION_POLICY_SUMMARY =
  "Free cancellation up to 14 days before check-in. Within 14 days, the reservation is non-refundable.";

/** Shown on the cancellation email and the canceled-reservation banner. */
export const CANCELLATION_NON_REFUNDABLE_NOTE =
  "Per our cancellation policy, reservations canceled within 14 days of check-in are non-refundable.";

/** Shown in the self-service cancel confirmation, refundable or not. */
export const CANCELLATION_WINDOW_COPY =
  "Cancellations made 14 or more days before check-in receive a full refund. Cancellations within 14 days of check-in are non-refundable.";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatMonthDay(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${MONTHS[month - 1]} ${day}`;
}

function calendarDaysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000
  );
}

/**
 * Check-in as a `YYYY-MM-DD` calendar date, or null when the value cannot
 * be read. See the file comment for which inputs are dates vs instants.
 */
export function resolveCheckInDate(checkIn: string | Date): string | null {
  if (checkIn instanceof Date) {
    if (Number.isNaN(checkIn.getTime())) return null;
    return `${checkIn.getFullYear()}-${pad(checkIn.getMonth() + 1)}-${pad(checkIn.getDate())}`;
  }

  const value = checkIn.trim();
  if (!value) return null;
  if (DATE_ONLY.test(value)) return value;

  // Instant: Z or a numeric offset. Convert to the Denver calendar date.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) return null;
    return civilDate(instant, CANCELLATION_TIMEZONE);
  }

  // Wall time with no zone (Guesty localized datetime). The date prefix is
  // the property's calendar date.
  const prefix = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return prefix ? prefix[1] : null;
}

/**
 * Whole Mountain calendar days from today until check-in. Negative once the
 * check-in date has passed. Null when the check-in cannot be read.
 */
export function calendarDaysBeforeCheckIn(
  checkIn: string | Date,
  now: Date = new Date()
): number | null {
  const arrival = resolveCheckInDate(checkIn);
  if (!arrival) return null;
  const today = civilDate(now, CANCELLATION_TIMEZONE);
  return calendarDaysBetween(today, arrival);
}

/** True when a cancellation at `now` is still inside the full-refund window. */
export function isFullRefundEligible(
  checkIn: string | Date,
  now: Date = new Date()
): boolean {
  const days = calendarDaysBeforeCheckIn(checkIn, now);
  return days !== null && days >= CANCELLATION_POLICY_DAYS;
}

/** Last Mountain calendar day (`YYYY-MM-DD`) that still receives a full refund. */
export function lastRefundableCalendarDate(
  checkIn: string | Date
): string | null {
  const arrival = resolveCheckInDate(checkIn);
  if (!arrival) return null;
  return shiftCivilDate(arrival, -CANCELLATION_POLICY_DAYS);
}

/**
 * Listing and checkout badge. With no dates, states the policy. With dates
 * inside the window, says non-refundable instead of promising a free cancel.
 */
export function freeCancellationLabel(
  checkIn?: string | Date | null,
  now: Date = new Date()
): string {
  if (checkIn == null || checkIn === "") {
    return `Free cancellation up to ${CANCELLATION_POLICY_DAYS} days before check-in`;
  }
  if (!isFullRefundEligible(checkIn, now)) return "Non-refundable";
  const lastDay = lastRefundableCalendarDate(checkIn);
  if (!lastDay) return "Non-refundable";
  return `Free cancellation through ${formatMonthDay(lastDay)}`;
}

/** Checkout reassurance line. Always names the outcome for these dates. */
export function checkoutCancellationText(
  checkIn: string,
  now: Date = new Date()
): string {
  if (!isFullRefundEligible(checkIn, now)) {
    return `This booking is non-refundable — you're within ${CANCELLATION_POLICY_DAYS} days of check-in.`;
  }
  const lastDay = lastRefundableCalendarDate(checkIn);
  if (!lastDay) {
    return `This booking is non-refundable — you're within ${CANCELLATION_POLICY_DAYS} days of check-in.`;
  }
  return `Cancel through ${formatMonthDay(lastDay)} for a full refund.`;
}

/**
 * Short badge for listing cards. Undated cards state the window so they
 * don't read as "always free." Dated cards inside the window say
 * non-refundable.
 */
export function listingCancellationBadge(
  checkIn?: string | null,
  now: Date = new Date()
): string {
  if (!checkIn) {
    return `Free cancellation up to ${CANCELLATION_POLICY_DAYS} days`;
  }
  return isFullRefundEligible(checkIn, now)
    ? "Free cancellation"
    : "Non-refundable";
}
