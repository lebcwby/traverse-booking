/**
 * What a booking is actually worth, compared with the same nights last year.
 *
 * The booking alert's rate-comparison table asks a good question — "is this
 * booking new money, or would we have sold that night anyway?" — and until
 * now answered it from `calendar_days`, which is a FORWARD-looking
 * availability mirror holding 2026-10-12 → 2027-10-26 and nothing earlier.
 * Last year's side could never be populated from it, so every table rendered
 * with dashes and a bold $0 total.
 *
 * Last year's ASKING price is not the useful number anyway. What matters is
 * what the night actually earned, which lives in reservation history.
 *
 * ── The three states, and why the third one exists ──────────────────────
 *
 *   booked         The night sold last year. Only the DIFFERENCE is new
 *                  money — we would have earned something regardless.
 *
 *   vacant         The listing was live and selling, and the night went
 *                  unsold. The whole rate is incremental.
 *
 *   no_comparable  We were not selling that listing then, so there is no
 *                  honest comparison and net is null.
 *
 * The third state is the one that is easy to omit and expensive to get
 * wrong. The booking that prompted this (GY-gADdgJQC, Oct 27–30 2026, the
 * Top Floor Remodeled Studio) sits on a listing CREATED in Guesty on
 * 2025-10-10 whose first stay was 2025-11-01 — last year's equivalent nights
 * fall in the gap before it ever sold. Treating that as `vacant` would have
 * credited the booking with $355.86 of incremental revenue when the true
 * answer is "we have nothing to compare against". Twenty-four listings were
 * onboarded since June 2026, so this is the common case, not the rare one.
 *
 * A night is only `vacant` when the listing demonstrably existed as a
 * sellable unit at the time — which we take as having had at least one stay
 * begin on or before that night.
 */

export type NightState = "booked" | "vacant" | "no_comparable";

export interface LastYearNight {
  /** Realised payout for that night last year, null when nothing sold. */
  earned: number | null;
  /**
   * First check-in ever recorded for this listing, as YYYY-MM-DD. Null when
   * the listing has no history at all. Anything before this date predates
   * our management and cannot be compared.
   */
  firstStayDate: string | null;
}

export interface NightComparison {
  /** The night being booked, YYYY-MM-DD. */
  date: string;
  /** The equivalent night last year, YYYY-MM-DD. */
  lastYearDate: string;
  thisYearRate: number | null;
  lastYearEarned: number | null;
  state: NightState;
  /** Incremental revenue, or null when there is no honest comparison. */
  net: number | null;
}

/**
 * Same weekday, roughly the same point in the season — a Saturday compared
 * with a Saturday. Subtracting a calendar year would compare a Tuesday with
 * a Wednesday, which for nightly rates is the wrong comparison: weekend
 * pricing is the single biggest driver of the number.
 */
export function lastYearEquivalent(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  // 364 days = exactly 52 weeks, so the weekday is preserved.
  d.setUTCDate(d.getUTCDate() - 364);
  return d.toISOString().slice(0, 10);
}

export function compareNight(
  date: string,
  thisYearRate: number | null,
  lastYear: LastYearNight
): NightComparison {
  const lastYearDate = lastYearEquivalent(date);
  const { earned, firstStayDate } = lastYear;

  // Not under management then — no basis for a comparison, and claiming the
  // full rate as incremental would overstate every recently-onboarded unit.
  const notYetSelling = firstStayDate === null || lastYearDate < firstStayDate;

  let state: NightState;
  if (earned !== null && earned > 0) state = "booked";
  else if (notYetSelling) state = "no_comparable";
  else state = "vacant";

  let net: number | null = null;
  if (thisYearRate !== null) {
    if (state === "booked") net = round2(thisYearRate - (earned ?? 0));
    else if (state === "vacant") net = round2(thisYearRate);
    // no_comparable stays null on purpose.
  }

  return {
    date,
    lastYearDate,
    thisYearRate,
    lastYearEarned: earned,
    state,
    net,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ComparisonTotals {
  /** Nights we could compare at all. */
  comparableNights: number;
  nights: number;
  thisYearTotal: number | null;
  lastYearTotal: number | null;
  /** Null when NO night could be compared — not zero. */
  netTotal: number | null;
}

export function totalsFor(nights: NightComparison[]): ComparisonTotals {
  const comparable = nights.filter((n) => n.net !== null);
  const rated = nights.filter((n) => n.thisYearRate !== null);
  const earned = nights.filter((n) => n.lastYearEarned !== null);

  return {
    nights: nights.length,
    comparableNights: comparable.length,
    thisYearTotal: rated.length
      ? round2(rated.reduce((s, n) => s + n.thisYearRate!, 0))
      : null,
    lastYearTotal: earned.length
      ? round2(earned.reduce((s, n) => s + n.lastYearEarned!, 0))
      : null,
    // The distinction the old table lost: "nothing to compare" is not "$0".
    netTotal: comparable.length
      ? round2(comparable.reduce((s, n) => s + n.net!, 0))
      : null,
  };
}

/**
 * Is there anything worth rendering?
 *
 * The old guard asked whether any ROWS existed, and the builder always
 * produced one row per night, so an unconfigured lookup drew a full table of
 * dashes under a bold $0. A reader cannot tell that from a real result.
 */
export function hasAnythingToShow(nights: NightComparison[]): boolean {
  return nights.some(
    (n) => n.thisYearRate !== null || n.lastYearEarned !== null
  );
}

export const STATE_LABELS: Record<NightState, string> = {
  booked: "booked last year",
  vacant: "vacant last year",
  no_comparable: "not yet listed",
};
