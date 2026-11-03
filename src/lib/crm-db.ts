/**
 * Read-only access to the CRM's Postgres, for the one thing the booking
 * site's own database cannot answer.
 *
 * ── Why a second database at all ────────────────────────────────────────
 *
 * The daily digest attributes damage waivers the way SuiteOp's Analytics >
 * Guest Store does: against the stay's CHECK-IN date. To do that it has to
 * know when each stay arrives, and almost every waiver belongs to an OTA
 * guest. Our own `reservations` table holds 348 rows, direct bookings only.
 * The CRM mirror holds 34,297 across 38 sources — the whole portfolio.
 *
 * The join is `reservations.guesty_reservation_id`, which is exactly what
 * SuiteOp stamps on its Stripe charges as `PMS Reservation ID`.
 *
 * ⚠️ This is a different Supabase project (CRM `ceeqfhjpphlpbpioyfgd`, the
 * booking site `xmnxntlpqfoshdmlvyov`). Treat it as a foreign service, not
 * as ours: READ ONLY, one narrow query, and every caller must tolerate it
 * being unreachable. Nothing in the booking path may ever depend on it.
 *
 * Unset `CRM_DATABASE_URL` is not an error — it means the digest falls back
 * to reporting waivers by charge date, which is a worse number but still a
 * true one.
 */
import { Pool } from "pg";

let crmPool: Pool | null = null;

/** True when a CRM connection is configured at all. */
export function crmConfigured(): boolean {
  return (process.env.CRM_DATABASE_URL || "").trim().length > 0;
}

/**
 * The CRM pool, or null when unconfigured.
 *
 * `max: 1` for the same reason as the primary pool — one per worker process
 * is enough, and this one is touched once a day.
 */
export function getCrmPool(): Pool | null {
  if (!crmConfigured()) return null;
  if (!crmPool) {
    crmPool = new Pool({
      connectionString: (process.env.CRM_DATABASE_URL || "").trim(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      // A daily report must not hang the function waiting on a foreign
      // database. Fail fast and let the caller degrade.
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
    });
  }
  return crmPool;
}

/**
 * Guesty reservation ids for stays checking in on one civil day.
 *
 * Cancelled stays are excluded: SuiteOp's dashboard counts arrivals, and a
 * cancelled booking is not one. A waiver already charged against a stay that
 * later cancelled should show up as a refund, not as arrival revenue.
 *
 * `check_in` is a date column in the CRM, already in property-local terms,
 * so it is compared to the civil date string rather than to an instant.
 */
export async function fetchGuestyReservationIdsCheckingIn(
  day: string
): Promise<string[]> {
  const pool = getCrmPool();
  if (!pool) return [];

  const { rows } = await pool.query(
    `select guesty_reservation_id
       from reservations
      where check_in = $1::date
        and guesty_reservation_id is not null
        and coalesce(status, '') not in ('canceled', 'cancelled', 'declined', 'expired')`,
    [day]
  );
  return rows
    .map((r) => String((r as { guesty_reservation_id: string }).guesty_reservation_id))
    .filter((id) => id.length > 0);
}
