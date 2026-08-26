/**
 * Payment-record audit — catches Guesty payment ledgers that disagree with what
 * we actually charged.
 *
 * WHY THIS EXISTS (2026-08-03, GY-hNBNy23v / Richard Welch):
 * Every direct booking ends up with TWO payment rows in Guesty:
 *   1. a note-less row created by the listing's auto-payment rule ("charge 100%
 *      at confirmation using guest card"), which fires ~2s before ours, and
 *   2. ours, tagged `Stripe PI <pi_...> — collected via native Stripe`.
 * Normally (1) stays PENDING and is inert — it has no vaulted card to charge,
 * so it shows in the UI as "Charge / Scheduled / Missing". But if it ever flips
 * to SUCCEEDED, Guesty counts the same money twice: `totalPaid` doubles and
 * `balanceDue` goes negative. On GY-hNBNy23v that produced a phantom -$507.36
 * credit and looked, to everyone reading the Guesty screen, exactly like the
 * guest had been double-charged $592.90. He had not — Stripe held a single
 * charge. The damage is accounting, not the guest's card: `totalPaid` is what
 * owner statements and payouts read.
 *
 * Nothing surfaced it. It was found only because someone eyeballed a balance.
 * This job is that eyeball, daily.
 *
 * Read-only. It never mutates Guesty or Stripe — a mismatch needs a human to
 * decide which record is the real one.
 *
 * GET /api/cron/audit-payment-records            (cron; Bearer CRON_SECRET)
 *     ?limit=<n>      how many reservations to scan (default 60, max 200)
 *     ?dryRun=1       report only, never alert
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getOpenAPIReservation } from "@/lib/guesty-openapi";
import { getStripeServer } from "@/lib/stripe";
import { sendAlert, renderAlertDetails } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/** Guesty payment rows we treat as money actually collected. */
const COUNTED_STATUS = "SUCCEEDED";

/** Ignore sub-cent float noise when comparing balances. */
const BALANCE_EPSILON = 0.5;

interface GuestyPayment {
  amount?: number;
  status?: string;
  note?: string | null;
  createdAt?: string;
}

interface Finding {
  confirmationCode: string | null;
  guestyId: string;
  kind:
    | "duplicate_succeeded"
    | "negative_balance"
    | "unpaid_balance"
    | "unrecorded_payment";
  hostPayout: number | null;
  totalPaid: number | null;
  balanceDue: number | null;
  /** What Stripe actually received. null = could not be read. */
  stripeReceived?: number | null;
  succeededCount: number;
  /** Succeeded rows with no Stripe note — the auto-payment-rule shadow rows. */
  unattributedCount: number;
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
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10) || 60)
  );
  const dryRun = url.searchParams.get("dryRun") === "1";

  const pool = getPool();

  // Only bookings we took money for. Recently-departed stays are included on
  // purpose: a bad ledger matters right up until the owner is paid out.
  // A watchdog that dies quietly is worse than no watchdog: everyone assumes
  // the ledger is clean because nothing alerted. Surface our own failure.
  // (This guard exists because the first version of this query compared the
  // TEXT check_out column to a date literal and 500'd on every run.)
  let rows: Array<{
    guesty_id: string;
    confirmation_code: string | null;
    status: string | null;
    stripe_payment_intent_id: string | null;
  }>;
  try {
    ({ rows } = await pool.query(
    `SELECT guesty_id, confirmation_code, status, stripe_payment_intent_id
       FROM reservations
      WHERE stripe_payment_intent_id IS NOT NULL
        -- check_in/check_out are TEXT, not dates. Compare against a formatted
        -- string rather than a date literal: "text >= timestamp" is a hard
        -- 42883. ISO YYYY-MM-DD sorts correctly lexicographically.
        AND check_out >= to_char(CURRENT_DATE - INTERVAL '45 days', 'YYYY-MM-DD')
      -- SOONEST first, not furthest-future. A bad ledger does its damage at
      -- payout time, so imminent and just-departed stays are the urgent ones.
      -- (Ordering DESC here silently excluded the very reservation that
      -- motivated this job — GY-hNBNy23v, Sep 2026 — because the top N by
      -- check_in were all 2027 bookings.)
      ORDER BY check_in ASC
      LIMIT $1`,
      [limit]
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PaymentAudit] reservation query failed:", message);
    if (!dryRun) {
      await sendAlert(
        "PAYMENT LEDGER AUDIT FAILED TO RUN",
        `<p>The daily payment-ledger audit could not query reservations, so <strong>no ledger check ran</strong>. Duplicate-payment problems would go unnoticed until this is fixed.</p><p>Error: <code>${message}</code></p>`,
        "payment-record-audit-broken"
      ).catch(() => {});
    }
    return NextResponse.json({ error: "audit query failed", message }, { status: 500 });
  }

  const findings: Finding[] = [];
  let scanned = 0;
  let skipped = 0;

  for (const row of rows) {
    let reservation: Record<string, unknown> | null = null;
    try {
      reservation = (await getOpenAPIReservation(
        row.guesty_id
      )) as Record<string, unknown>;
    } catch {
      // A single unreadable reservation must not abort the sweep.
      skipped++;
      continue;
    }
    scanned++;

    const money = (reservation?.money ?? {}) as Record<string, unknown>;
    const payments = Array.isArray(money.payments)
      ? (money.payments as GuestyPayment[])
      : [];
    const succeeded = payments.filter((p) => p.status === COUNTED_STATUS);
    // Our own rows always carry the Stripe PI note; anything else that
    // succeeded came from Guesty's side.
    const unattributed = succeeded.filter((p) => !p.note?.includes("Stripe PI"));

    const hostPayout = num(money.hostPayout);
    const totalPaid = num(money.totalPaid);
    const balanceDue = num(money.balanceDue);
    const isCanceled =
      String(reservation?.status ?? row.status ?? "").toLowerCase() ===
      "canceled";

    // A second SUCCEEDED payment is NOT itself suspicious — pet fees, stay
    // extensions and date changes all legitimately add one (GY-SHHhdMpj has a
    // $1738.41 stay payment plus a $50 pet fee and is perfectly fine). The
    // duplicate signature is two succeeded payments for the SAME amount, which
    // is what the auto-payment rule produces when it mirrors our charge.
    const byAmount = new Map<number, GuestyPayment[]>();
    for (const p of succeeded) {
      const amt = num(p.amount);
      if (amt === null) continue;
      byAmount.set(amt, [...(byAmount.get(amt) ?? []), p]);
    }
    const duplicated = [...byAmount.values()].filter((g) => g.length > 1).flat();

    if (duplicated.length > 0) {
      findings.push({
        confirmationCode: (reservation?.confirmationCode as string) ?? null,
        guestyId: row.guesty_id,
        kind: "duplicate_succeeded",
        hostPayout,
        totalPaid,
        balanceDue,
        succeededCount: succeeded.length,
        unattributedCount: unattributed.length,
        // Label by the same rule attribution uses, so the alert points at the
        // exact row to void: the one WITHOUT our Stripe PI note.
        detail: duplicated
          .map(
            (p) =>
              `$${p.amount} ${p.status} ${
                p.note?.includes("Stripe PI")
                  ? "(ours — Stripe PI)"
                  : "(NO Stripe PI note — likely the auto-rule row to void)"
              } @ ${p.createdAt}`
          )
          .join(" · "),
      });
      continue; // already reported; don't double-report on balance too
    }

    // A cancelled reservation legitimately shows hostPayout 0 with money still
    // recorded against it, so a negative balance there is expected shape, not a
    // defect. Only flag live bookings.
    if (
      !isCanceled &&
      balanceDue !== null &&
      balanceDue < -BALANCE_EPSILON
    ) {
      findings.push({
        confirmationCode: (reservation?.confirmationCode as string) ?? null,
        guestyId: row.guesty_id,
        kind: "negative_balance",
        hostPayout,
        totalPaid,
        balanceDue,
        succeededCount: succeeded.length,
        unattributedCount: unattributed.length,
        detail: `Guest appears over-paid by $${Math.abs(balanceDue).toFixed(2)}`,
      });
    }

    // Money owed that we never collected. Every row reaching this sweep has a
    // Stripe PI, i.e. we took payment ourselves at booking and the stay should
    // be paid in full — so a POSITIVE balance is not a payment plan or an
    // OTA hotel-collect booking, it is money that quietly went uncollected.
    //
    // Two producers seen so far, and they are NOT the same problem:
    //
    //  1. An uncollected fee that Guesty auto-applies to the invoice but our
    //     checkout never charged. The first sweep found three reservations
    //     short by exactly $50, each carrying a Pet Fee line Guesty had added
    //     on its own (GY-z9ai4HsW, GY-XfNL7u3G, GY-cZNjjLNX). This is the
    //     common case and it is a quiet revenue leak.
    //  2. An abandoned portal date change: the quote step in
    //     /api/account/reservations/[id]/extend writes new dates to Guesty
    //     BEFORE the guest pays, and only a client-side rollback undoes them.
    //     Close the tab and Guesty is left extended and unpaid while our row
    //     still shows the old stay. That is GY-fYaHGbj5 (2026-08-25), caught
    //     only because the guest phoned in.
    //
    // The invoice lines tell them apart, so the alert points there rather than
    // asserting a cause.
    if (
      !isCanceled &&
      balanceDue !== null &&
      balanceDue > BALANCE_EPSILON
    ) {
      // A Guesty balance is NOT evidence the guest owes money. Of the first
      // three found, two had already paid in full and only Guesty's ledger was
      // short: recordPayment hit Guesty's "amount > balance" error, re-recorded
      // at the balance Guesty had at that instant, and the pet fee landed on
      // the invoice afterwards — leaving a balance the guest does not owe.
      // Telling ops to "collect it" would have charged those two a second time.
      //
      // Stripe is the arbiter. Only the shortfall against what Stripe actually
      // received is real money owed.
      let stripeReceived: number | null = null;
      if (row.stripe_payment_intent_id) {
        try {
          const pi = await getStripeServer().paymentIntents.retrieve(
            row.stripe_payment_intent_id
          );
          stripeReceived = (pi.amount_received ?? 0) / 100;
        } catch {
          // Leave null — an unreadable PI must not turn into a "go collect".
        }
      }

      const paidInFull =
        stripeReceived !== null &&
        hostPayout !== null &&
        stripeReceived >= hostPayout - BALANCE_EPSILON;

      findings.push({
        confirmationCode: (reservation?.confirmationCode as string) ?? null,
        guestyId: row.guesty_id,
        kind: paidInFull ? "unrecorded_payment" : "unpaid_balance",
        hostPayout,
        totalPaid,
        balanceDue,
        stripeReceived,
        succeededCount: succeeded.length,
        unattributedCount: unattributed.length,
        detail: paidInFull
          ? `DO NOT COLLECT — Stripe already received $${stripeReceived!.toFixed(2)}, ` +
            `covering the full $${hostPayout!.toFixed(2)}. Guesty's ledger is ` +
            `$${balanceDue.toFixed(2)} short, so the fix is to record the missing ` +
            `amount in Guesty, not to charge the guest.`
          : stripeReceived === null
            ? `$${balanceDue.toFixed(2)} shows as owed, but the Stripe payment ` +
              `could not be read to confirm it. Check Stripe by hand before ` +
              `charging anyone.`
            : `$${balanceDue.toFixed(2)} genuinely uncollected — Stripe received ` +
              `$${stripeReceived.toFixed(2)} against a $${hostPayout?.toFixed(2)} ` +
              `invoice. Compare Guesty's invoice lines with what we charged: a fee ` +
              `Guesty added on its own (pet fee is the usual one) needs collecting, ` +
              `whereas dates longer than ours mean an abandoned portal date change.`,
      });
    }

    // Be polite to the Open API — this is a background sweep, not a user path.
    await new Promise((r) => setTimeout(r, 250));
  }

  if (findings.length > 0 && !dryRun) {
    // Keyed on the finding set, so a standing unresolved issue re-alerts daily
    // rather than being silenced forever by the cooldown, but a clean-up is
    // reflected immediately.
    const key = `payment-record-audit-${findings
      .map((f) => f.confirmationCode || f.guestyId)
      .sort()
      .join(",")
      .slice(0, 120)}`;

    await sendAlert(
      `PAYMENT LEDGER MISMATCH — ${findings.length} reservation(s)`,
      [
        "<p>Guesty's payment ledger disagrees with what we charged. This is an " +
          "<strong>accounting</strong> problem, not necessarily a guest-card one — " +
          "verify in Stripe before refunding or charging anyone.</p>",
        // The two failure modes need opposite responses, so only show the
        // guidance for the kinds that actually fired.
        findings.some((f) => f.kind !== "unpaid_balance")
          ? "<p><strong>Over-paid / duplicate:</strong> most likely the listing's " +
            "auto-payment rule recorded a duplicate payment alongside ours. The " +
            "row with <em>no</em> Stripe PI note is the one to void. The guest " +
            "was probably charged only once — confirm in Stripe first.</p>"
          : "",
        findings.some((f) => f.kind === "unpaid_balance")
          ? "<p><strong>Unpaid balance:</strong> Stripe received less than the " +
            "Guesty invoice, so this is genuinely uncollected. Compare Guesty's " +
            "invoice lines with what we charged. A fee Guesty added on its own " +
            "— a <em>pet fee</em> is the one we keep seeing — just needs " +
            "collecting. Dates on Guesty that run longer than ours instead mean " +
            "a guest abandoned a date change in the portal: collect the " +
            "difference, or put the dates back and free the calendar.</p>"
          : "",
        findings.some((f) => f.kind === "unrecorded_payment")
          ? "<p><strong>Unrecorded payment — do NOT charge these guests.</strong> " +
            "Stripe already holds the full invoice amount; only Guesty's ledger " +
            "is short, so the balance on screen is money the guest does not owe. " +
            "It happens when Guesty rejects our record as larger than the " +
            "then-current balance and a fee lands on the invoice afterwards. Fix " +
            "it by recording the missing amount in Guesty against the existing " +
            "Stripe payment.</p>"
          : "",
        ...findings.map((f) =>
          renderAlertDetails([
            ["Reservation", f.confirmationCode || f.guestyId],
            ["Issue", f.kind],
            ["Host payout", f.hostPayout],
            ["Total paid", f.totalPaid],
            ["Balance due", f.balanceDue],
            ["Stripe received", f.stripeReceived ?? "(unread)"],
            ["Succeeded payments", f.succeededCount],
            ["…of which un-attributed", f.unattributedCount],
            ["Detail", f.detail],
          ])
        ),
      ].join(""),
      key
    );
  }

  return NextResponse.json({
    scanned,
    skipped,
    findingCount: findings.length,
    findings,
    dryRun,
  });
}
