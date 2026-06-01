import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getStripeServer } from "@/lib/stripe";
import {
  isAlreadySettledPaymentError,
  isTestModePaymentIntentError,
  recordPayment,
  resolveAmountVsBalance,
} from "@/lib/guesty-openapi";
import {
  buildStripeDashboardPaymentUrl,
  formatDurationMs,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";
const ALERT_AFTER_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pool;
  try {
    pool = getPool();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron] Failed to create DB pool:", msg, {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
    });
    return NextResponse.json(
      { error: "DB pool init failed", detail: msg },
      { status: 500 }
    );
  }

  let rows;
  try {
    const result = await pool.query(
      `SELECT
        r.guesty_id,
        r.confirmation_code,
        r.stripe_payment_intent_id,
        r.last_synced_at,
        r.status,
        r.check_in,
        r.check_out,
        r.guest,
        r.listing_id,
        l.title AS listing_title,
        l.nickname AS listing_nickname
     FROM reservations r
     LEFT JOIN listings l ON l.guesty_id = r.listing_id
     WHERE r.stripe_payment_intent_id IS NOT NULL
       AND r.payment_recorded_at IS NULL
       AND r.source = 'BE-API'
       AND r.last_synced_at > $1`,
      // 30-day window so a payment that gets stuck past the old 24h cutoff
      // (Guesty outage, indexing stall, etc.) is not silently dropped. Alerts
      // still fire from 15min onwards — this only extends the retry horizon.
      [Date.now() - 30 * 24 * 60 * 60 * 1000]
    );
    rows = result.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron] DB query failed:", msg);
    return NextResponse.json(
      { error: "DB query failed", detail: msg },
      { status: 500 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ message: "No pending payments", count: 0 });
  }

  const stripe = getStripeServer();
  const results: Array<{ reservationId: string; status: string }> = [];

  for (const row of rows) {
    const {
      guesty_id: reservationId,
      confirmation_code: confirmationCode,
      stripe_payment_intent_id: piId,
      last_synced_at: lastSyncedAt,
      status: reservationStatus,
      check_in: checkIn,
      check_out: checkOut,
      guest,
      listing_title: listingTitle,
      listing_nickname: listingNickname,
    } = row;

    let pi: { status?: string; amount?: number } | null = null;

    try {
      pi = await stripe.paymentIntents.retrieve(piId);
      if (pi.status !== "succeeded") {
        results.push({
          reservationId,
          status: `skipped — PI status: ${pi.status}`,
        });
        continue;
      }

      const amount = Number(pi.amount || 0) / 100;
      await recordPayment(reservationId, amount, piId);

      await pool.query(
        `UPDATE reservations SET payment_recorded_at = $1 WHERE guesty_id = $2`,
        [Date.now(), reservationId]
      );

      console.log(
        `[Cron] Recorded $${amount.toFixed(2)} payment for ${reservationId}`
      );
      results.push({ reservationId, status: "recorded" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAlreadySettledPaymentError(err)) {
        // Disambiguate "balance is 0" (truly settled) from "amount > balance"
        // (silent mis-record that hid the $3.71 discrepancy for every direct
        // booking until 2026-05-16). See guesty-openapi.ts:resolveAmountVsBalance.
        try {
          const amount = Number(pi?.amount || 0) / 100;
          const resolution = await resolveAmountVsBalance(
            reservationId,
            amount,
            piId
          );
          await pool.query(
            `UPDATE reservations SET payment_recorded_at = $1 WHERE guesty_id = $2`,
            [Date.now(), reservationId]
          );
          if (resolution.mismatch) {
            const stripeUrl = buildStripeDashboardPaymentUrl(piId);
            await sendAlert(
              `Payment amount mismatch (cron) — Stripe $${resolution.originalAmount.toFixed(2)} vs Guesty $${resolution.balanceAmount.toFixed(2)}`,
              [
                "<p>The cron-fallback payment recorder hit an amount mismatch between Stripe and Guesty's invoice balance. Guesty's books are now correct (balance is $0). The delta below is revenue that lives only in Stripe.</p>",
                renderAlertDetails([
                  ["Reservation", reservationId],
                  ["PaymentIntent", piId],
                  [
                    "Stripe captured",
                    `$${resolution.originalAmount.toFixed(2)}`,
                  ],
                  [
                    "Guesty balance (now recorded)",
                    `$${resolution.balanceAmount.toFixed(2)}`,
                  ],
                  [
                    "Delta (extra in Stripe)",
                    `$${resolution.delta.toFixed(2)}`,
                  ],
                ]),
                renderAlertLinks([
                  { label: "Stripe payment", url: stripeUrl },
                ]),
              ].join(""),
              `amount-mismatch-cron-${reservationId}`
            );
            results.push({
              reservationId,
              status: `recorded balance $${resolution.balanceAmount.toFixed(2)} (mismatch alerted)`,
            });
          } else {
            results.push({
              reservationId,
              status: "already settled in Guesty",
            });
          }
          continue;
        } catch (resolveErr) {
          // Fall through — original error is reported below
          console.warn(
            `[Cron] resolveAmountVsBalance failed for ${reservationId}:`,
            resolveErr instanceof Error ? resolveErr.message : resolveErr
          );
        }
      }
      if (isTestModePaymentIntentError(err)) {
        await pool.query(
          `UPDATE reservations SET payment_recorded_at = $1 WHERE guesty_id = $2`,
          [Date.now(), reservationId]
        );
        results.push({ reservationId, status: "skipped — test-mode PI" });
        continue;
      }
      const reservationAgeMs = Date.now() - Number(lastSyncedAt || 0);
      const shouldAlert = reservationAgeMs >= ALERT_AFTER_MS;
      const guestEmail =
        guest && typeof guest === "object" && "email" in guest
          ? String((guest as { email?: string }).email || "")
          : "";
      const resolvedListingTitle = String(
        listingTitle || listingNickname || ""
      );
      console.error("[Cron] Failed to record payment", {
        reservationId,
        confirmationCode,
        paymentIntentId: piId,
        guestEmail,
        listingTitle: resolvedListingTitle,
        checkIn,
        checkOut,
        reservationStatus,
        reservationAgeMs,
        error: msg,
      });
      results.push({
        reservationId,
        status: `${shouldAlert ? "failed" : "retrying"} — ${msg}`,
      });

      if (shouldAlert) {
        const stripePaymentUrl = buildStripeDashboardPaymentUrl(piId);
        const chargedAmount = Number(pi?.amount || 0) / 100;
        await sendAlert(
          "Cron: Payment Recording Still Failing",
          [
            "<p>Stripe charge succeeded, but Guesty payment recording is still failing after the retry window.</p>",
            renderAlertDetails([
              ["Reservation ID", reservationId],
              ["Confirmation code", confirmationCode || ""],
              ["PaymentIntent", piId],
              ["Guest email", guestEmail],
              ["Listing", resolvedListingTitle],
              ["Check-in", checkIn],
              ["Check-out", checkOut],
              ["Reservation status", reservationStatus],
              ["Stripe status", "succeeded"],
              ["Charged amount", `$${chargedAmount.toFixed(2)}`],
              ["Reservation age", formatDurationMs(reservationAgeMs)],
              ["Error", msg],
              [
                "Next action",
                "Cron will retry automatically. If this repeats, record the payment manually in Guesty.",
              ],
            ]),
            renderAlertLinks([
              { label: "Stripe payment", url: stripePaymentUrl },
            ]),
          ].join(""),
          `cron-payment-fail-${reservationId}`
        );
      }
    }
  }

  return NextResponse.json({ count: rows.length, results });
}
