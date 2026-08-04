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
  kind: "duplicate_succeeded" | "negative_balance";
  hostPayout: number | null;
  totalPaid: number | null;
  balanceDue: number | null;
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
  }>;
  try {
    ({ rows } = await pool.query(
    `SELECT guesty_id, confirmation_code, status
       FROM reservations
      WHERE stripe_payment_intent_id IS NOT NULL
        -- check_in/check_out are TEXT, not dates. Compare against a formatted
        -- string rather than a date literal: "text >= timestamp" is a hard
        -- 42883. ISO YYYY-MM-DD sorts correctly lexicographically.
        AND check_out >= to_char(CURRENT_DATE - INTERVAL '45 days', 'YYYY-MM-DD')
      ORDER BY check_in DESC
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

    if (succeeded.length > 1) {
      findings.push({
        confirmationCode: (reservation?.confirmationCode as string) ?? null,
        guestyId: row.guesty_id,
        kind: "duplicate_succeeded",
        hostPayout,
        totalPaid,
        balanceDue,
        succeededCount: succeeded.length,
        unattributedCount: unattributed.length,
        detail: succeeded
          .map(
            (p) =>
              `$${p.amount} ${p.status} ${p.note ? "(ours)" : "(NO NOTE — auto-rule)"} @ ${p.createdAt}`
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
          "verify in Stripe before refunding anyone.</p>",
        "<p>Most likely cause: the listing's auto-payment rule recorded a " +
          "duplicate payment alongside ours. The row with <em>no</em> Stripe PI " +
          "note is the one to void.</p>",
        ...findings.map((f) =>
          renderAlertDetails([
            ["Reservation", f.confirmationCode || f.guestyId],
            ["Issue", f.kind],
            ["Host payout", f.hostPayout],
            ["Total paid", f.totalPaid],
            ["Balance due", f.balanceDue],
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
