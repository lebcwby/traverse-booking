// Reconcile cron for cart checkouts where partial-failure rollback ran into
// a Stripe refund API failure. Picks up rows in `refund_failed` state and
// retries the refund. Runs every 10 minutes per vercel.json.
//
// We only refund the SUM of failed-line hostPayouts. Reserved lines stay
// charged. This mirrors the coordinator's primary-path logic.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getStripeServer } from "@/lib/stripe";
import {
  setCartStatus,
  updateCartLine,
  type CartCheckoutStatus,
  type CartLine,
} from "@/lib/cart/pending-cart-checkouts";
import {
  buildStripeDashboardPaymentUrl,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";

interface PendingCartRefundRow {
  cart_id: string;
  payment_intent_id: string;
  lines: CartLine[];
  total_paid: string | number;
  guest: { email?: string };
  status: CartCheckoutStatus;
  last_error: string | null;
  updated_at: Date;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT cart_id, payment_intent_id, lines, total_paid, guest, status, last_error, updated_at
       FROM pending_cart_checkouts
      WHERE status = 'refund_failed'
      ORDER BY updated_at ASC
      LIMIT 50`
  );
  const rows = result.rows as PendingCartRefundRow[];
  if (rows.length === 0) {
    return NextResponse.json({ scanned: 0, fixed: 0, failed: 0 });
  }

  const stripe = getStripeServer();
  let fixed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const failedLines = row.lines.filter(
        (l) => l.status === "failed" || l.status === "refunded"
      );
      const refundAmount = failedLines
        .filter((l) => l.status === "failed")
        .reduce((sum, l) => sum + l.hostPayout, 0);
      if (refundAmount <= 0) {
        // Nothing left to refund — push to terminal state.
        const reservedCount = row.lines.filter(
          (l) => l.status === "reserved"
        ).length;
        await setCartStatus(
          row.payment_intent_id,
          reservedCount > 0 ? "partial" : "refunded",
          { markCompleted: true }
        );
        fixed++;
        continue;
      }

      const refundAmountCents = Math.round(refundAmount * 100);
      const refund = await stripe.refunds.create({
        payment_intent: row.payment_intent_id,
        amount: refundAmountCents,
        reason: "requested_by_customer",
        metadata: {
          cartId: row.cart_id,
          partialFailure: "true",
          reconcileCron: "true",
          failedLineIds: failedLines.map((l) => l.lineId).join(","),
        },
      });

      // Mark each failed line as refunded.
      for (const l of failedLines.filter((x) => x.status === "failed")) {
        await updateCartLine(row.payment_intent_id, l.lineId, {
          status: "refunded",
          refundAmount: l.hostPayout,
        });
      }

      const reservedCount = row.lines.filter(
        (l) => l.status === "reserved"
      ).length;
      const terminal: CartCheckoutStatus =
        reservedCount === 0 ? "refunded" : "partial";
      await setCartStatus(row.payment_intent_id, terminal, {
        markCompleted: true,
        lastError: `Reconciled by cron; refund=${refund.id}`,
      });
      fixed++;
    } catch (e) {
      failed++;
      console.error(
        `[reconcile-cart-refunds] Cart ${row.cart_id} retry failed:`,
        e instanceof Error ? e.message : e
      );
      // Re-alert ops if a refund has been failing for >24h.
      const ageHours =
        (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        await sendAlert(
          "CART REFUND STILL FAILING (24h+)",
          [
            "<p>A cart refund has been failing for over 24 hours. Manual intervention required.</p>",
            renderAlertDetails([
              ["Cart ID", row.cart_id],
              ["PaymentIntent", row.payment_intent_id],
              ["Guest email", row.guest?.email || "(unknown)"],
              ["Age (hours)", ageHours.toFixed(1)],
              [
                "Last error",
                row.last_error || (e instanceof Error ? e.message : String(e)),
              ],
            ]),
            renderAlertLinks([
              {
                label: "Stripe payment",
                url: buildStripeDashboardPaymentUrl(row.payment_intent_id),
              },
            ]),
          ].join(""),
          `cart-refund-stuck-${row.cart_id}`
        );
      }
    }
  }

  return NextResponse.json({ scanned: rows.length, fixed, failed });
}
