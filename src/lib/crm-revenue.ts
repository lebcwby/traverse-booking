/**
 * Last year's REALISED nightly revenue, read from the CRM database.
 *
 * The booking app's own Supabase holds only the reservations that came
 * through this website — 339 rows, the earliest check-in 2026-05-14. There is
 * no last year in it to compare against. The full portfolio history lives in
 * the CRM: 34,143 reservations back to 2019 across every channel, 16,564 of
 * them confirmed and priced before 2026, covering 210 listings.
 *
 * So this module opens a SECOND, read-only pool against that database. It is
 * entirely optional: with CRM_DATABASE_URL unset, every function here returns
 * empty and the rate-comparison table renders exactly as it does today — this
 * year's rate, a dash for last year, and a dash for net. Nothing regresses if
 * the variable is never set; the last-year column simply stays blank.
 *
 * ── Why not PriceLabs ───────────────────────────────────────────────────
 *
 * PriceLabs was the obvious candidate and cannot do this job. It issues no
 * self-serve API key; the only integration available to us is an MCP
 * connector, which lives in a Claude session and is unreachable from a Vercel
 * cron. Even with a key it would be the wrong number: PriceLabs knows asking
 * prices and market comps, not what a specific night of ours actually earned.
 *
 * ── The basis: base booking fare ────────────────────────────────────────
 *
 * `money_subtotal` is the accommodation fare — before the cleaning fee and
 * before taxes. That is deliberate. This year's side of the comparison is a
 * nightly rate out of `calendar_days`, which is also a bare accommodation
 * rate, so the two sides measure the same thing.
 *
 * `money_total` would not work. It is fee- and tax-inclusive on direct
 * bookings and something closer to a payout on channel bookings — on one
 * Christmas reservation checked while building this, money_total/night came
 * to $252.81 against a $333.75 base fare, i.e. BELOW the fare it supposedly
 * contains. Comparing a bare rate against a figure with mixed semantics would
 * make the sign of "net" meaningless.
 *
 * ── The allocation, and its one real limitation ─────────────────────────
 *
 * A reservation carries one subtotal for the whole stay, so a per-night
 * figure means dividing by nights. That is FLAT: a Friday-to-Monday stay
 * spreads its weekend premium evenly across all three nights, so an
 * individual night can read high or low by a few dollars even though the
 * stay totals correctly.
 *
 * A per-night breakdown would be better and does not exist to be had:
 * `financials_jsonb` and `raw_jsonb` are both NULL on every historical row
 * (all 1,545 confirmed reservations checked in the autumn 2025 window). Flat
 * allocation is the best available, not the convenient choice.
 */

import { Pool } from "pg";

let crmPool: Pool | null = null;

export function crmConfigured(): boolean {
  return Boolean(process.env.CRM_DATABASE_URL?.trim());
}

// Same trailing-whitespace guard as src/lib/db.ts: Vercel's env storage has
// been observed to keep a stray \n, which makes pg look for a database
// literally named "postgres\n".
function getCrmPool(): Pool {
  if (!crmPool) {
    crmPool = new Pool({
      connectionString: process.env.CRM_DATABASE_URL!.trim(),
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return crmPool;
}

export interface ListingHistory {
  /** Base fare earned per night, keyed YYYY-MM-DD. Absent = sold nothing. */
  earnedByDate: Map<string, number>;
  /**
   * Earliest confirmed check-in ever for this listing, YYYY-MM-DD, or null
   * when it has no history at all. Nights before this predate our selling it,
   * and compareNight() refuses to call them "vacant".
   */
  firstStayDate: string | null;
}

const EMPTY: ListingHistory = { earnedByDate: new Map(), firstStayDate: null };

/**
 * Both halves of last year's picture in one round trip.
 *
 * The earnings and the first-stay date have to agree with each other: a night
 * with no earnings means "vacant" only if the listing was already selling,
 * and that judgment is only sound if both facts come from the same source at
 * the same moment.
 */
export async function fetchListingHistory(
  guestyListingId: string,
  dates: string[]
): Promise<ListingHistory> {
  if (!crmConfigured() || !guestyListingId || dates.length === 0) return EMPTY;

  try {
    const { rows } = await getCrmPool().query<{
      night: string | null;
      earned: string | null;
      first_stay: string | null;
    }>(
      `with target as (
         select $2::date[] as nights
       ),
       sold as (
         select n::text as night,
                sum(r.money_subtotal / r.nights) as earned
           from unnest((select nights from target)) as n
           join reservations r
             on r.guesty_listing_id = $1
            and r.status::text = 'confirmed'
            and r.money_subtotal > 0
            and r.nights > 0
            and n >= r.check_in and n < r.check_out
          group by n
       ),
       history as (
         select min(check_in)::text as first_stay
           from reservations
          where guesty_listing_id = $1
            and status::text = 'confirmed'
            and money_subtotal > 0
       )
       select sold.night, sold.earned::text as earned, history.first_stay
         from history left join sold on true`,
      [guestyListingId, dates]
    );

    const earnedByDate = new Map<string, number>();
    let firstStayDate: string | null = null;

    for (const row of rows) {
      // history is a one-row CTE, so first_stay repeats on every row; the
      // left join means it is still present when nothing sold.
      if (row.first_stay) firstStayDate = row.first_stay;
      if (row.night && row.earned !== null) {
        earnedByDate.set(row.night, Math.round(Number(row.earned) * 100) / 100);
      }
    }

    return { earnedByDate, firstStayDate };
  } catch (err) {
    // An enrichment must never take the booking alert down with it. A blank
    // last-year column is a bad email; a thrown error is no email at all.
    console.error(`[CRMRevenue] history query failed for ${guestyListingId}:`, err);
    return EMPTY;
  }
}
