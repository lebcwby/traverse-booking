import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getStripeServer } from "@/lib/stripe";
import {
  isAlreadySettledPaymentError,
  isTestModePaymentIntentError,
  recordPayment,
  resolveAmountVsBalance,
} from "@/lib/guesty-openapi";
import { attemptReserveAndRecord } from "@/lib/checkout-finalizer";
import { paymentTargetColumnsExist } from "@/lib/db-features";
import {
  buildStripeDashboardPaymentUrl,
  formatDurationMs,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";
const ALERT_AFTER_MS = 15 * 60 * 1000;
const RETRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  const useNewProtocol = await paymentTargetColumnsExist(pool);
  if (!useNewProtocol) {
    console.warn(
      "[Cron] record-payments: payment target columns absent, running legacy path"
    );
    return legacyRecordPayments(pool);
  }

  return newTopUpRecordPayments(pool);
}

/**
 * Post-migration top-up cron. All rows with a positive shortfall are split
 * into two cohorts by `payment_target_cents_set_at`:
 *
 *   - ≤ 30 days old → run the reserve-then-record protocol (see
 *     `attemptReserveAndRecord`). On any non-`full` result the overshoot is
 *     reverted and we move on; the next pass tries again.
 *   - >  30 days old → stop retrying. Alert daily until an operator
 *     manually reconciles the ledger. No Guesty call.
 *
 * `payment_target_cents` is authoritative, so we do NOT call
 * `stripe.paymentIntents.retrieve` on this path.
 */
async function newTopUpRecordPayments(pool: ReturnType<typeof getPool>) {
  let rows: Array<{
    guesty_id: string;
    confirmation_code: string | null;
    stripe_payment_intent_id: string | null;
    payment_target_cents: number;
    payment_recorded_cents: number;
    payment_target_cents_set_at: number;
    check_in: string | null;
    check_out: string | null;
    guest: Record<string, unknown> | null;
    listing_title: string | null;
    listing_nickname: string | null;
  }>;
  try {
    const result = await pool.query(
      `SELECT
        r.guesty_id,
        r.confirmation_code,
        r.stripe_payment_intent_id,
        r.payment_target_cents,
        r.payment_recorded_cents,
        r.payment_target_cents_set_at,
        r.check_in,
        r.check_out,
        r.guest,
        l.title AS listing_title,
        l.nickname AS listing_nickname
     FROM reservations r
     LEFT JOIN listings l ON l.guesty_id = r.listing_id
     WHERE r.payment_target_cents IS NOT NULL
       AND r.payment_recorded_cents < r.payment_target_cents
       AND r.source = 'BE-API'`
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

  const now = Date.now();
  const results: Array<{ reservationId: string; status: string }> = [];

  for (const row of rows) {
    const reservationId = row.guesty_id;
    const piId = row.stripe_payment_intent_id;
    const targetCents = Number(row.payment_target_cents || 0);
    const observedCents = Number(row.payment_recorded_cents || 0);
    const setAt = Number(row.payment_target_cents_set_at || 0);
    const ageMs = now - setAt;

    if (!piId) {
      results.push({
        reservationId,
        status: "skipped — no payment intent id",
      });
      continue;
    }

    if (ageMs > RETRY_WINDOW_MS) {
      // Past the retry horizon. Stop touching Guesty; just nag the team.
      const shortfallCents = targetCents - observedCents;
      await sendAlert(
        `Guesty shortfall unresolved — $${(shortfallCents / 100).toFixed(2)} still pending on ${reservationId}`,
        [
          "<p>This reservation has had an unrecorded shortfall in Guesty for more than 30 days. The record-payments cron has stopped retrying automatically.</p>",
          "<p><strong>Manual fix:</strong> record the missing amount in Guesty, then run:</p>",
          `<pre>UPDATE reservations SET payment_recorded_cents = payment_target_cents WHERE guesty_id = '${reservationId}';</pre>`,
          renderAlertDetails([
            ["Reservation", reservationId],
            ["Confirmation code", row.confirmation_code || ""],
            ["Listing", row.listing_title || row.listing_nickname || ""],
            ["Stripe captured", `$${(targetCents / 100).toFixed(2)}`],
            ["Recorded in Guesty", `$${(observedCents / 100).toFixed(2)}`],
            ["Shortfall", `$${(shortfallCents / 100).toFixed(2)}`],
            ["Age", formatDurationMs(ageMs)],
          ]),
          renderAlertLinks([
            {
              label: "Stripe payment",
              url: buildStripeDashboardPaymentUrl(piId),
            },
          ]),
        ].join(""),
        `amount-short-stale-${reservationId}`
      );
      results.push({
        reservationId,
        status: `stale (${Math.floor(ageMs / 86_400_000)}d) — manual fix required`,
      });
      continue;
    }

    try {
      const result = await attemptReserveAndRecord({
        reservationId,
        paymentIntentId: piId,
        targetCents,
        observedCents,
      });
      if (result.outcome === "full") {
        results.push({ reservationId, status: "topped up — full" });
      } else if (result.outcome === "short") {
        results.push({
          reservationId,
          status: `topped up — still short $${(result.shortfallCents / 100).toFixed(2)}`,
        });
      } else {
        results.push({ reservationId, status: "no-op (retry next run)" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Cron] Top-up failed", { reservationId, error: msg });
      const shouldAlert = ageMs >= ALERT_AFTER_MS;
      results.push({
        reservationId,
        status: `${shouldAlert ? "failed" : "retrying"} — ${msg}`,
      });
      if (shouldAlert) {
        await sendAlert(
          "Cron: Payment Recording Still Failing",
          [
            "<p>Top-up attempt failed. The cron will keep retrying until the 30-day cutoff.</p>",
            renderAlertDetails([
              ["Reservation ID", reservationId],
              ["Confirmation code", row.confirmation_code || ""],
              ["PaymentIntent", piId],
              ["Listing", row.listing_title || row.listing_nickname || ""],
              ["Target", `$${(targetCents / 100).toFixed(2)}`],
              ["Recorded", `$${(observedCents / 100).toFixed(2)}`],
              ["Age", formatDurationMs(ageMs)],
              ["Error", msg],
            ]),
            renderAlertLinks([
              {
                label: "Stripe payment",
                url: buildStripeDashboardPaymentUrl(piId),
              },
            ]),
          ].join(""),
          `cron-payment-fail-${reservationId}`
        );
      }
    }
  }

  return NextResponse.json({ count: rows.length, results });
}

/**
 * Pre-migration behavior, preserved so a code-ahead-of-migration deploy does
 * not suddenly stop retrying stuck payments. Deletable once the migration
 * is confirmed applied in prod.
 */
async function legacyRecordPayments(pool: ReturnType<typeof getPool>) {
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
      [Date.now() - RETRY_WINDOW_MS]
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
                renderAlertLinks([{ label: "Stripe payment", url: stripeUrl }]),
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
