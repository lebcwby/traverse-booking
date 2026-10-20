/**
 * Civil-day boundaries in the business's own timezone.
 *
 * The daily booking digest bucketed on the UTC day, and that quietly moves
 * bookings between days. Sunday 2026-10-18 had three website bookings in
 * Mountain time — 09:27, 19:04 and 20:32 — but the two evening ones fall on
 * 2026-10-19 in UTC, so the digest would have reported Sunday as one booking
 * and filed $3,090 under Monday. Every evening booking lands on the wrong
 * day, which is most of them.
 *
 * Guests book from every timezone, but the person reading the digest is in
 * Mountain, and "yesterday" has to mean the day they actually lived through.
 *
 * No tz library: `Intl` already ships the IANA database, so the offset is
 * derived by formatting an instant in the zone and comparing it back to UTC.
 * DST is handled by construction rather than by special case — 2026-11-01 is
 * a 25-hour day in Denver and the bounds come out 25 hours apart, because
 * each boundary is resolved against the offset in force at that boundary.
 */

export const REPORT_TIMEZONE = "America/Denver";

const PARTS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = PARTS.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    PARTS.set(timeZone, f);
  }
  return f;
}

interface CivilTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function civilTimeIn(instant: Date, timeZone: string): CivilTime {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // `hour12: false` renders midnight as "24" in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Minutes the zone is offset from UTC at this instant (negative = behind). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const c = civilTimeIn(instant, timeZone);
  const asIfUtc = Date.UTC(
    c.year,
    c.month - 1,
    c.day,
    c.hour,
    c.minute,
    c.second
  );
  // Drop sub-second precision on both sides so the difference is whole minutes.
  return (asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
}

/** "YYYY-MM-DD" for an instant, as the clock in `timeZone` reads it. */
export function civilDate(instant: Date, timeZone = REPORT_TIMEZONE): string {
  const c = civilTimeIn(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`;
}

/** The civil date `days` before (or after) a "YYYY-MM-DD", calendar-correct. */
export function shiftCivilDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * The instant at which a civil date begins in `timeZone`.
 *
 * Resolved twice: the first pass uses the offset at the UTC guess, which can
 * be the wrong side of a DST transition, and the second re-resolves against
 * the offset actually in force at the computed instant.
 */
export function zonedDayStart(date: string, timeZone = REPORT_TIMEZONE): Date {
  const guess = new Date(`${date}T00:00:00.000Z`);
  const firstPass = new Date(
    guess.getTime() - offsetMinutes(guess, timeZone) * 60000
  );
  const settled = new Date(
    guess.getTime() - offsetMinutes(firstPass, timeZone) * 60000
  );
  return settled;
}

/**
 * Half-open bounds [start, end) covering one civil day in `timeZone`,
 * as ISO instants ready for a `timestamptz` comparison.
 */
export function zonedDayBounds(
  date: string,
  timeZone = REPORT_TIMEZONE
): { start: string; end: string } {
  return {
    start: zonedDayStart(date, timeZone).toISOString(),
    end: zonedDayStart(shiftCivilDate(date, 1), timeZone).toISOString(),
  };
}

/** Yesterday, as the clock in `timeZone` reads it right now. */
export function yesterdayIn(
  timeZone = REPORT_TIMEZONE,
  now: Date = new Date()
): string {
  return shiftCivilDate(civilDate(now, timeZone), -1);
}
