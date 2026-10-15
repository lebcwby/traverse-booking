/**
 * Voids Guesty auto-payment-rule rows that duplicate a payment we already
 * collected through Stripe.
 *
 * WHY (2026-10-14): on listings with the auto-payment rule enabled, every
 * direct booking gets a second, note-less payment row. It starts PENDING
 * because the only card we give Guesty is a Stripe `pm_...` that GuestyPay
 * cannot charge — then fires later, for the full original amount, once a real
 * card is vaulted (a pet fee, an added night). Survey across 319 direct
 * reservations: 4 already fired ($3,289.15, all refunded), 109 dormant
 * ($102,875.15).
 *
 * See src/lib/duplicate-payment-rows.ts for the matching rule and for why it
 * is strict — 9 PENDING rows at survey time were genuine balances owed, and
 * voiding those would lose real money.
 *
 * ── Safety ──────────────────────────────────────────────────────────────
 *
 * This WRITES to live money records, so:
 *   - dry run is the DEFAULT. `?apply=1` is required to change anything.
 *   - `?code=GY-xxxx` restricts the run to one reservation. Use this first.
 *   - every candidate is re-fetched and re-checked immediately before the
 *     write, so a stale scan cannot cause a void.
 *   - `?max=` caps writes per run (default 5, hard ceiling 50).
 *   - it never touches a SUCCEEDED row. Money that actually moved is a refund
 *     decision for a human.
 *
 * ⚠️ UNVERIFIED AT TIME OF WRITING: Guesty's docs say a cancelled amount is
 * "typically added back to the reservation's balance due". For a PENDING row
 * that never captured there should be nothing to add back — but confirm that
 * on ONE reservation with `?code=` before any bulk run. A balance reappearing
 * would put a guest back into collections for money they already paid. The
 * response reports balanceDue before and after for exactly this reason.
 *
 * ── Backlog cleared 2026-10-14 ──────────────────────────────────────────
 *
 * 78 dormant rows voided, 0 failures, 0 guests affected. One reservation
 * (GY-kipRQPJf) had its balance move 0 → −188.99: the fare had been adjusted
 * down after booking, so the guest had already overpaid and the dormant row
 * was masking it. The void revealed a pre-existing overpayment rather than
 * creating one. Negative is the safe direction; POSITIVE would mean a guest
 * back in collections for money they already paid.
 *
 * GET /api/cron/void-duplicate-payments      (Bearer CRON_SECRET)
 *     ?apply=1        actually cancel (default: dry run)
 *     ?code=GY-xxxx   restrict to one reservation
 *     ?limit=<n>      reservations to scan (default 200, max 1000)
 *     ?max=<n>        max writes this run (default 5, max 50)
 *
 * Scheduled daily to catch new bookings on rule-enabled listings. The
 * schedule passes ?apply=1&max=10 — a cap low enough that a bad day is small
 * and loud, and the batch aborts on the first unexpected result regardless.
 */
import { NextResponse } from "next/server";
import {
  cancelReservationPayment,
  getOpenAPIReservationsPage,
} from "@/lib/guesty-openapi";
import {
  findDormantDuplicate,
  type GuestyPaymentRow,
} from "@/lib/duplicate-payment-rows";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = 50;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Candidate {
  reservationId: string;
  code: string;
  paymentId: string;
  amount: number;
  balanceDueBefore: number;
}

function moneyOf(r: Record<string, unknown>) {
  const money = (r.money ?? {}) as Record<string, unknown>;
  return {
    payments: (money.payments ?? []) as GuestyPaymentRow[],
    balanceDue: Number(money.balanceDue ?? 0),
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const apply = url.searchParams.get("apply") === "1";
  const onlyCode = url.searchParams.get("code")?.trim() || null;
  // Default is a recent window — the scheduled run only needs to catch new
  // bookings. The ceiling is high enough to sweep the whole history in one
  // pass for a backlog run (319 direct reservations as of 2026-10-14, and it
  // only grows), because a cap below the total silently leaves rows unvoided:
  // the first backlog pass used 300 and missed ~19.
  const limit = Math.min(
    1000,
    Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200)
  );
  const max = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("max") || "5", 10) || 5)
  );

  const candidates: Candidate[] = [];
  const skipped: Array<{ code: string; reason: string }> = [];
  let scanned = 0;

  try {
    const filters: Array<Record<string, unknown>> = onlyCode
      ? [{ field: "confirmationCode", operator: "$eq", value: onlyCode }]
      : [{ field: "source", operator: "$eq", value: "BE-API" }];

    for (let skip = 0; skip < limit; skip += PAGE) {
      const { results } = await getOpenAPIReservationsPage({
        fields: "_id confirmationCode status source money createdAt",
        limit: Math.min(PAGE, limit - skip),
        skip,
        sort: "-createdAt",
        filters,
      });
      if (!results.length) break;

      for (const r of results) {
        scanned += 1;
        const { payments, balanceDue } = moneyOf(r);
        const verdict = findDormantDuplicate(payments, balanceDue);
        const code = String(r.confirmationCode ?? "");
        if (!verdict.duplicate) {
          // Only worth reporting when there was something to consider.
          if (payments.length > 1)
            skipped.push({ code, reason: verdict.reason });
          continue;
        }
        candidates.push({
          reservationId: String(r._id),
          code,
          paymentId: verdict.paymentId!,
          amount: verdict.amount!,
          balanceDueBefore: balanceDue,
        });
      }

      if (results.length < PAGE) break;
      // The Guesty quota is shared account-wide — see
      // src/lib/guesty-rate-limit-events.ts.
      await sleep(1200);
    }
  } catch (err) {
    console.error("[void-duplicate-payments] scan failed:", err);
    return NextResponse.json(
      { error: "Scan failed", detail: String(err) },
      { status: 503 }
    );
  }

  if (!apply) {
    return NextResponse.json({
      mode: "dryRun",
      scanned,
      candidateCount: candidates.length,
      wouldVoid: candidates.map((c) => ({
        code: c.code,
        amount: c.amount,
        paymentId: c.paymentId,
      })),
      totalAmount: Number(
        candidates.reduce((s, c) => s + c.amount, 0).toFixed(2)
      ),
      skippedSample: skipped.slice(0, 15),
      note: "Nothing was changed. Re-run with ?apply=1 to cancel. Use ?code=GY-xxxx to prove it on one reservation first.",
    });
  }

  const voided: Array<Record<string, unknown>> = [];
  const failed: Array<Record<string, unknown>> = [];

  /**
   * Set as soon as a void does something unexpected; aborts the rest of the
   * batch.
   *
   * ⚠️ This used to be checked only AFTER the whole batch finished. On the
   * 2026-10-14 backlog run a balance moved on GY-kipRQPJf and 13 further voids
   * had already gone through before anything noticed. They were individually
   * safe — each one re-checks its own guards — but "we found out at the end"
   * is not a stop condition. Check after every write, abort on the first
   * surprise, and let a human look before the remaining candidates are
   * touched.
   */
  let abortReason: string | null = null;

  for (const c of candidates.slice(0, max)) {
    if (abortReason) break;
    try {
      // Re-fetch and re-check immediately before writing. The scan may be
      // minutes old by now, and a row that started capturing in the meantime
      // must not be cancelled.
      const { results } = await getOpenAPIReservationsPage({
        fields: "_id confirmationCode status money",
        limit: 1,
        filters: [
          { field: "confirmationCode", operator: "$eq", value: c.code },
        ],
      });
      const fresh = results?.[0];
      if (!fresh) {
        failed.push({ code: c.code, error: "reservation no longer readable" });
        continue;
      }
      const { payments, balanceDue } = moneyOf(fresh);
      const recheck = findDormantDuplicate(payments, balanceDue);
      if (!recheck.duplicate || recheck.paymentId !== c.paymentId) {
        failed.push({
          code: c.code,
          error: `state changed since scan — ${recheck.reason}`,
        });
        continue;
      }

      await cancelReservationPayment(c.reservationId, c.paymentId);

      // Read back, so the response can prove what the cancel actually did to
      // the balance rather than assuming.
      await sleep(800);
      const after = await getOpenAPIReservationsPage({
        fields: "_id confirmationCode money",
        limit: 1,
        filters: [
          { field: "confirmationCode", operator: "$eq", value: c.code },
        ],
      });
      const afterMoney = after.results?.[0]
        ? moneyOf(after.results[0])
        : { payments: [], balanceDue: NaN };

      const balanceChanged = !Number.isNaN(afterMoney.balanceDue)
        ? Math.abs(afterMoney.balanceDue - c.balanceDueBefore) > 0.005
        : null;

      voided.push({
        code: c.code,
        amount: c.amount,
        paymentId: c.paymentId,
        balanceDueBefore: c.balanceDueBefore,
        balanceDueAfter: afterMoney.balanceDue,
        balanceChanged,
      });

      // Abort the batch on the first surprise, before touching anything else.
      if (balanceChanged === true) {
        abortReason =
          `${c.code}: balanceDue moved ${c.balanceDueBefore} → ${afterMoney.balanceDue} ` +
          `after voiding $${c.amount.toFixed(2)}. A row that never captured should leave ` +
          `the balance untouched. Stopped before the remaining candidates.`;
      } else if (balanceChanged === null) {
        // Could not read the balance back, so we cannot say the void was
        // clean. Treat unverifiable the same as unexpected.
        abortReason =
          `${c.code}: could not read balanceDue back after the void, so the ` +
          `result is unverified. Stopped rather than continue blind.`;
      }
    } catch (err) {
      console.error("[void-duplicate-payments] cancel failed:", c.code, err);
      failed.push({ code: c.code, error: String(err) });
    }
    await sleep(1200);
  }

  // Candidates this run deliberately did not touch, either because the batch
  // aborted or because `max` capped it.
  const untouched =
    Math.max(
      0,
      Math.min(candidates.length, max) - voided.length - failed.length
    ) + Math.max(0, candidates.length - max);

  if (voided.length || failed.length) {
    await sendAlert(
      abortReason
        ? "🛑 Duplicate-payment sweep ABORTED — unexpected result, check now"
        : "Voided duplicate Guesty payment rows",
      `Cancelled <strong>${voided.length}</strong> dormant auto-payment-rule row(s) that duplicated a payment already collected via Stripe.` +
        (failed.length ? ` ${failed.length} failed.` : "") +
        (abortReason
          ? `<br/><br/>🛑 <strong>The sweep stopped early.</strong><br/>${abortReason}` +
            `<br/><br/>${untouched} candidate(s) were left untouched. Nothing further ` +
            `will be voided until someone looks. A balance moving in the POSITIVE ` +
            `direction is the dangerous one — it puts a guest back into collections ` +
            `for money they already paid. Negative means the reservation is overpaid ` +
            `and the guest may be owed a refund.`
          : "<br/><br/>All balances unchanged, as expected.") +
        `<br/><br/><pre>${JSON.stringify({ voided, failed }, null, 2)}</pre>`,
      // No cooldown key reuse between the two cases: an abort must never be
      // suppressed because a routine run alerted within the dedup window.
      abortReason ? "void-duplicate-payments-abort" : "void-duplicate-payments"
    );
  }

  return NextResponse.json({
    mode: "apply",
    scanned,
    candidateCount: candidates.length,
    attempted: voided.length + failed.length,
    voidedCount: voided.length,
    voided,
    failed,
    abortedEarly: Boolean(abortReason),
    abortReason,
    untouched,
  });
}
