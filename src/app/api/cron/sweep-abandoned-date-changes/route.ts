/**
 * Sweeps portal date changes the guest started but never paid for.
 *
 * WHY THIS EXISTS (2026-08-25, GY-fYaHGbj5 / Paul Dymond):
 * /api/account/reservations/[id]/extend moves the dates on Guesty during its
 * *quote* step, before payment, because Guesty offers no dry-run pricing for a
 * date change — moving the dates IS how you get the new price. Undoing that was
 * left entirely to a client-side rollback fired from the modal's close/back
 * buttons. Close the tab, lose signal, let the phone sleep, and nothing runs.
 *
 * Paul's reservation sat extended and unpaid for three days: Guesty showed
 * Sep 3–7 with $111.99 owed, our own row still said Sep 4–7, and the guest saw
 * the old dates in his portal and no charge on his card. It surfaced only
 * because he phoned in. The night was also blocked on the calendar the whole
 * time, unsellable and unpaid.
 *
 * ── What this job will NOT do ────────────────────────────────────────────────
 * Rolling dates back is a real write to a real booking, so it happens only when
 * every other explanation has been ruled out. It refuses when:
 *   · Guesty no longer matches the dates we set — someone edited the
 *     reservation by hand, and reverting would destroy their work.
 *   · The guest already paid. Checked against the actual PaymentIntent, not a
 *     Guesty balance. If money was taken and finalize never ran, the dates are
 *     correct and a human needs to reconcile — never roll back.
 *   · The balance is settled some other way, e.g. staff collected through
 *     GuestyPay, which is exactly how Paul's case ended. Reverting there would
 *     have cancelled a night the guest had paid for.
 * Anything uncertain is left alone and alerted. Doing nothing is recoverable;
 * reverting a paid stay is not.
 *
 * GET /api/cron/sweep-abandoned-date-changes     (cron; Bearer CRON_SECRET)
 *     ?dryRun=1     decide and report, but never write to Guesty
 *     ?limit=<n>    max rows to process (default 20)
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  getOpenAPIReservation,
  updateReservationDates,
} from "@/lib/guesty-openapi";
import { getStripeServer } from "@/lib/stripe";
import { sendAlert, renderAlertDetails } from "@/lib/alerts";
import type { PendingDateChangeRow } from "@/lib/pending-date-changes";

export const dynamic = "force-dynamic";

/** Sub-cent float noise on Guesty balances. */
const BALANCE_EPSILON = 0.5;

/** Give up rolling back after this many tries and hand it to a human. */
const MAX_ATTEMPTS = 3;

type Outcome =
  | "rolled_back"
  | "superseded"
  | "settled_externally"
  | "paid_not_finalized"
  | "rollback_failed"
  | "unreadable";

interface Result {
  reservationId: string;
  confirmationCode: string | null;
  outcome: Outcome;
  detail: string;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20)
  );

  const pool = getPool();

  let rows: PendingDateChangeRow[];
  try {
    ({ rows } = await pool.query(
      `SELECT id, reservation_id, confirmation_code,
              original_check_in, original_check_out,
              new_check_in, new_check_out,
              stripe_payment_intent_id, status, attempts, expires_at
         FROM pending_date_changes
        WHERE status = 'pending' AND expires_at < now()
        ORDER BY expires_at ASC
        LIMIT $1`,
      [limit]
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A watchdog that dies quietly is worse than none — everyone assumes the
    // calendar is clean because nothing alerted.
    console.error("[DateChangeSweep] query failed:", message);
    if (!dryRun) {
      await sendAlert(
        "DATE-CHANGE SWEEP FAILED TO RUN",
        `<p>The abandoned date-change sweeper could not read its queue, so <strong>no sweep ran</strong>. Reservations may be sitting extended and unpaid with their calendar blocked.</p><p>Error: <code>${message}</code></p>`,
        "date-change-sweep-broken"
      ).catch(() => {});
    }
    return NextResponse.json({ error: "sweep query failed", message }, { status: 500 });
  }

  const results: Result[] = [];

  for (const row of rows) {
    const rid = row.reservation_id;

    // ── Read Guesty's current truth ────────────────────────────────────────
    let reservation: Record<string, unknown> | null = null;
    try {
      reservation = (await getOpenAPIReservation(rid)) as Record<string, unknown>;
    } catch (err) {
      // Leave the row pending so the next run retries. An unreadable
      // reservation is not permission to guess.
      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "unreadable",
        detail: `Could not read reservation from Guesty: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const currentIn = String(reservation?.checkInDateLocalized ?? "");
    const currentOut = String(reservation?.checkOutDateLocalized ?? "");
    const money = (reservation?.money ?? {}) as Record<string, unknown>;
    const balanceDue = num(money.balanceDue);
    const status = String(reservation?.status ?? "").toLowerCase();

    // ── Refusal 1: someone else has since edited the reservation ───────────
    // Our rollback would overwrite whatever they set. Their edit is newer and
    // was made deliberately by a person; ours is a timer.
    if (currentIn !== row.new_check_in || currentOut !== row.new_check_out) {
      await resolve(pool, row.id, "superseded");
      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "superseded",
        detail:
          `Guesty now reads ${currentIn}–${currentOut}, not the ${row.new_check_in}–${row.new_check_out} we set. ` +
          `Someone changed it after us; left untouched.`,
      });
      continue;
    }

    // ── Refusal 2: the guest actually paid ─────────────────────────────────
    // Stripe is the arbiter, not Guesty's balance. If money moved and finalize
    // never ran, the extended dates are the CORRECT state — the bug is the
    // missing record, and rolling back would take away a night they bought.
    if (row.stripe_payment_intent_id) {
      try {
        const pi = await getStripeServer().paymentIntents.retrieve(
          row.stripe_payment_intent_id
        );
        if (pi.status === "succeeded" || (pi.amount_received ?? 0) > 0) {
          await resolve(pool, row.id, "paid_not_finalized");
          results.push({
            reservationId: rid,
            confirmationCode: row.confirmation_code,
            outcome: "paid_not_finalized",
            detail:
              `Stripe took $${((pi.amount_received ?? 0) / 100).toFixed(2)} on ${row.stripe_payment_intent_id} ` +
              `but the change was never finalized. Dates are right; the payment record is missing.`,
          });
          if (!dryRun) {
            await sendAlert(
              `PAID DATE CHANGE NEVER FINALIZED — ${row.confirmation_code || rid}`,
              [
                "<p>A guest paid for a date change and the finalize step never ran. " +
                  "The new dates are correct on Guesty and <strong>must not be rolled back</strong>. " +
                  "What is missing is the payment record and our own copy of the stay.</p>",
                renderAlertDetails([
                  ["Reservation", row.confirmation_code || rid],
                  ["Stripe payment", row.stripe_payment_intent_id],
                  ["Stripe took", `$${((pi.amount_received ?? 0) / 100).toFixed(2)}`],
                  ["Dates on Guesty", `${currentIn} → ${currentOut}`],
                  ["Dates before the change", `${row.original_check_in} → ${row.original_check_out}`],
                  ["Guesty balance", balanceDue],
                ]),
              ].join(""),
              `date-change-paid-unfinalized-${rid}`
            );
          }
          continue;
        }
      } catch (err) {
        // Cannot confirm the payment either way — refuse to act.
        results.push({
          reservationId: rid,
          confirmationCode: row.confirmation_code,
          outcome: "unreadable",
          detail: `Could not read ${row.stripe_payment_intent_id}: ${err instanceof Error ? err.message : String(err)}. Left pending.`,
        });
        continue;
      }
    }

    // ── Refusal 3: the balance was settled some other way ──────────────────
    // Staff collecting through GuestyPay is exactly how GY-fYaHGbj5 ended, and
    // it leaves no trace in our Stripe. A zero balance on an extended stay
    // means the extension was paid for — keep it, and fix our own record.
    if (balanceDue !== null && balanceDue <= BALANCE_EPSILON && status !== "canceled") {
      await resolve(pool, row.id, "settled_externally");
      await syncLocalDates(pool, rid, currentIn, currentOut);
      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "settled_externally",
        detail:
          `Balance is $${balanceDue.toFixed(2)} — the extension was paid for outside our Stripe flow. ` +
          `Kept the dates and updated our record to ${currentIn}–${currentOut}.`,
      });
      continue;
    }

    // ── Nothing left but an abandoned change: put the dates back ───────────
    if (dryRun) {
      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "rolled_back",
        detail: `[dryRun] would roll ${currentIn}–${currentOut} back to ${row.original_check_in}–${row.original_check_out}`,
      });
      continue;
    }

    try {
      await updateReservationDates(
        rid,
        row.original_check_in,
        row.original_check_out
      );
      await resolve(pool, row.id, "rolled_back");
      await syncLocalDates(pool, rid, row.original_check_in, row.original_check_out);
      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "rolled_back",
        detail: `Put back to ${row.original_check_in}–${row.original_check_out}; calendar freed.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;

      await pool.query(
        `UPDATE pending_date_changes
            SET attempts = $2,
                last_error = $3,
                status = CASE WHEN $4 THEN 'rollback_failed' ELSE status END,
                resolved_at = CASE WHEN $4 THEN now() ELSE resolved_at END
          WHERE id = $1`,
        [row.id, attempts, message, exhausted]
      );

      results.push({
        reservationId: rid,
        confirmationCode: row.confirmation_code,
        outcome: "rollback_failed",
        detail: `Attempt ${attempts}/${MAX_ATTEMPTS} failed: ${message}`,
      });

      if (exhausted) {
        await sendAlert(
          `DATE CHANGE STUCK — ${row.confirmation_code || rid} extended and unpaid`,
          [
            "<p>A guest started a date change, never paid, and we could not put " +
              "the dates back. The reservation is currently <strong>longer than " +
              "the guest paid for</strong> and the extra night is blocked on the " +
              "calendar.</p>",
            "<p>Put the dates back in Guesty by hand, or collect the balance if " +
              "the guest does want the change.</p>",
            renderAlertDetails([
              ["Reservation", row.confirmation_code || rid],
              ["Dates on Guesty now", `${currentIn} → ${currentOut}`],
              ["Should be", `${row.original_check_in} → ${row.original_check_out}`],
              ["Balance showing", balanceDue],
              ["Attempts", attempts],
              ["Last error", message],
            ]),
          ].join(""),
          `date-change-rollback-stuck-${rid}`
        );
      }
    }
  }

  return NextResponse.json({
    dryRun,
    considered: rows.length,
    results,
  });
}

async function resolve(
  pool: ReturnType<typeof getPool>,
  id: string,
  status: string
) {
  await pool.query(
    `UPDATE pending_date_changes
        SET status = $2, resolved_at = now()
      WHERE id = $1`,
    [id, status]
  );
}

/**
 * Keep our own row in step with Guesty. The guest portal reads these columns,
 * and Paul Dymond kept seeing his old dates for three days precisely because
 * nothing wrote them back — there is no reservations sync to catch it later.
 */
async function syncLocalDates(
  pool: ReturnType<typeof getPool>,
  reservationId: string,
  checkIn: string,
  checkOut: string
) {
  try {
    await pool.query(
      `UPDATE reservations
          SET check_in = $2, check_out = $3
        WHERE guesty_id = $1`,
      [reservationId, checkIn, checkOut]
    );
  } catch (err) {
    console.error(
      "[DateChangeSweep] local date sync failed:",
      err instanceof Error ? err.message : err
    );
  }
}
