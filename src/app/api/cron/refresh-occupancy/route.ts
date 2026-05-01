import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();

    // All-source occupancy from full Guesty-synced reservations table.
    // Excludes owner/owner-guest blocks. Uses 365-day trailing window.
    // P70 thresholds by BR — targets ~30% of portfolio qualifying.
    const { rowCount } = await pool.query(`
      WITH booking_nights AS (
        SELECT
          r.listing_id,
          SUM(
            GREATEST(0,
              EXTRACT(DAY FROM
                LEAST(r.check_out::date, CURRENT_DATE)
                - GREATEST(r.check_in::date, CURRENT_DATE - INTERVAL '365 days')
              )
            )
          )::int as booked_nights
        FROM reservations r
        WHERE r.status = 'confirmed'
          AND r.check_out::date > CURRENT_DATE - INTERVAL '365 days'
          AND r.check_in::date < CURRENT_DATE
          AND r.source NOT IN ('owner', 'owner-guest')
        GROUP BY r.listing_id
      ),
      occ AS (
        SELECT
          bn.listing_id,
          bn.booked_nights,
          ROUND((bn.booked_nights::numeric / 365 * 100)::numeric, 1) as occ_pct
        FROM booking_nights bn
      )
      UPDATE listings l
      SET occupancy_stats = jsonb_build_object(
        'occupancy_pct', o.occ_pct,
        'booked_nights', o.booked_nights,
        'days_active', 365,
        'computed_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'is_rare_find', CASE
          WHEN COALESCE(l.bedrooms, 0) = 0 AND o.occ_pct >= 67 THEN true
          WHEN COALESCE(l.bedrooms, 0) = 1 AND o.occ_pct >= 73 THEN true
          WHEN l.bedrooms = 2 AND o.occ_pct >= 41 THEN true
          WHEN l.bedrooms = 3 AND o.occ_pct >= 36 THEN true
          WHEN l.bedrooms = 4 AND o.occ_pct >= 33 THEN true
          WHEN l.bedrooms >= 5 AND o.occ_pct >= 14 THEN true
          ELSE false
        END
      )
      FROM occ o
      WHERE l.guesty_id = o.listing_id
        AND l.active = true
    `);

    return NextResponse.json({ updated: rowCount });
  } catch (err) {
    console.error("refresh-occupancy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
