import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { recordRefund } from "@/lib/guesty-openapi";
import { sendGuestyRefundRecordFailedAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

interface PendingRow {
  guesty_id: string;
  confirmation_code: string | null;
  refund_amount: string | number | null;
  stripe_refund_id: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();

  // Pick up both never-attempted (NULL) and previously-failed (false) rows.
  // The live cancel route's catch handler writes `false` on failure, so a
  // NULL-only filter would let those rows rot forever.
  const result = await pool.query(
    `SELECT guesty_id, confirmation_code, refund_amount, stripe_refund_id
       FROM reservations
      WHERE refund_status = 'full_refund'
        AND stripe_refund_id IS NOT NULL
        AND guesty_refund_recorded IS NOT TRUE
      ORDER BY canceled_at DESC NULLS LAST
      LIMIT 100`
  );

  const rows = result.rows as PendingRow[];

  if (rows.length === 0) {
    return NextResponse.json({ scanned: 0, retried: 0, fixed: 0, failed: 0 });
  }

  let fixed = 0;
  let failed = 0;

  for (const row of rows) {
    const refundAmt = Number(row.refund_amount || 0);
    try {
      await recordRefund(
        row.guesty_id,
        refundAmt,
        `Guest self-service cancellation — Stripe refund ${row.stripe_refund_id}`
      );
      await pool.query(
        `UPDATE reservations SET guesty_refund_recorded = true WHERE guesty_id = $1`,
        [row.guesty_id]
      );
      fixed += 1;
    } catch (err) {
      console.error(
        `[Cron] reconcile-cancellation-refunds: recordRefund failed for ${row.guesty_id}`,
        err
      );
      await pool.query(
        `UPDATE reservations SET guesty_refund_recorded = false WHERE guesty_id = $1`,
        [row.guesty_id]
      );
      await sendGuestyRefundRecordFailedAlert({
        reservationId: row.guesty_id,
        confirmationCode: row.confirmation_code,
        refundAmount: refundAmt,
        stripeRefundId: row.stripe_refund_id,
        error: err instanceof Error ? err.message : "Unknown",
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    retried: rows.length,
    fixed,
    failed,
  });
}
