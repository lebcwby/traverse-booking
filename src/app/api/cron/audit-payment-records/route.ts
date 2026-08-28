/**
 * Payment-record audit — catches Guesty payment ledgers that disagree with what
 * was actually collected.
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
 * WHY IT NOW ENUMERATES FROM GUESTY (2026-08-26, GY-H5JutVsw / Melissa Bell):
 * It used to read our own `reservations` table, which holds ONLY direct BE-API
 * bookings — 185 rows. Every manually-created and OTA reservation was therefore
 * invisible to it. GY-H5JutVsw was created by hand in Guesty (source "website",
 * platform "manual") for a same-day one-night stay; Guesty's auto-payment rules
 * do not fire on hand-created reservations, so nothing was ever charged. Not a
 * failed attempt — no attempt at all. The guest stayed, left, and was only
 * charged ten days after checkout when someone happened to notice.
 *
 * A sweep of 100 departed stays showed the shape of it: every channel source
 * auto-charges reliably (airbnb2 50/51, Booking.com 8/8, HomeAway 6/6, VRBO
 * 5/5, BE-API 6/6) while `website` and `manual` were 0 for 4. Both of those
 * were eventually paid, but only because a person noticed. This job is now that
 * person.
 *
 * Read-only. It never mutates Guesty or Stripe — a mismatch needs a human to
 * decide which record is the real one.
 *
 * GET /api/cron/audit-payment-records            (cron; Bearer CRON_SECRET)
 *     ?limit=<n>      reservations to scan (default 200, max 500)
 *     ?days=<n>       look-back window on check-out (default 45, max 180)
 *     ?dryRun=1       report only, never alert
 */
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getOpenAPIReservationsPage } from "@/lib/guesty-openapi";
import { getStripeServer } from "@/lib/stripe";
import { sendAlert, renderAlertDetails } from "@/lib/alerts";

export const dynamic = "force-dynamic";

/** Guesty payment rows we treat as money actually collected. */
const COUNTED_STATUS = "SUCCEEDED";

/** Ignore sub-cent float noise when comparing balances. */
const BALANCE_EPSILON = 0.5;

/** Guesty caps page size; anything larger is silently truncated. */
const PAGE_SIZE = 100;

/**
 * Owner and owner-guest stays are not billed to the occupant, so a balance on
 * one is the expected shape rather than a defect. Everything else that reaches
 * check-out should be settled.
 */
const UNBILLED_SOURCES = new Set(["owner", "owner-guest"]);

interface GuestyPayment {
  amount?: number;
  status?: string;
  note?: string | null;
  createdAt?: string;
  /** Present when a human pressed charge; absent when automation did it. */
  createdBy?: string | null;
}

interface Finding {
  confirmationCode: string | null;
  guestyId: string;
  kind:
    | "duplicate_succeeded"
    | "negative_balance"
    | "unpaid_balance"
    | "unrecorded_payment";
  source: string | null;
  checkOut: string | null;
  hostPayout: number | null;
  totalPaid: number | null;
  balanceDue: number | null;
  /** What Stripe actually received. null = no PI on file, or unreadable. */
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

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200)
  );
  const days = Math.min(
    180,
    Math.max(1, parseInt(url.searchParams.get("days") || "45", 10) || 45)
  );
  const dryRun = url.searchParams.get("dryRun") === "1";

  // ── Enumerate from Guesty, not from our own table ──────────────────────
  // Our `reservations` table holds only direct BE-API bookings, so reading it
  // is what made hand-created and OTA reservations invisible for months.
  const since = daysAgo(days);
  const reservations: Record<string, unknown>[] = [];
  let reportedTotal = 0;
  try {
    for (let skip = 0; skip < limit; skip += PAGE_SIZE) {
      const { results, count } = await getOpenAPIReservationsPage({
        fields:
          "_id confirmationCode status source checkInDateLocalized checkOutDateLocalized money.hostPayout money.totalPaid money.balanceDue money.payments guest.fullName",
        limit: Math.min(PAGE_SIZE, limit - skip),
        skip,
        sort: "-checkOutDateLocalized",
        filters: [
          { field: "status", operator: "$eq", value: "confirmed" },
          { field: "checkOutDateLocalized", operator: "$gte", value: since },
        ],
      });
      reportedTotal = count;
      reservations.push(...results);
      if (results.length < PAGE_SIZE) break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A watchdog that dies quietly is worse than no watchdog: everyone assumes
    // the ledger is clean because nothing alerted. Surface our own failure.
    console.error("[PaymentAudit] Guesty enumeration failed:", message);
    if (!dryRun) {
      await sendAlert(
        "PAYMENT LEDGER AUDIT FAILED TO RUN",
        `<p>The daily payment-ledger audit could not enumerate reservations from Guesty, so <strong>no ledger check ran</strong>. Uncollected and duplicated payments would go unnoticed until this is fixed.</p><p>Error: <code>${message}</code></p>`,
        "payment-record-audit-broken"
      ).catch(() => {});
    }
    return NextResponse.json(
      { error: "audit enumeration failed", message },
      { status: 500 }
    );
  }

  // ── One lookup for every Stripe PI we hold ─────────────────────────────
  // Only direct bookings have one. It is what lets us tell "the guest still
  // owes this" apart from "the guest paid and Guesty under-recorded it".
  const piByGuestyId = new Map<string, string>();
  try {
    const ids = reservations.map((r) => String(r._id)).filter(Boolean);
    if (ids.length) {
      const { rows } = await getPool().query(
        `SELECT guesty_id, stripe_payment_intent_id
           FROM reservations
          WHERE guesty_id = ANY($1) AND stripe_payment_intent_id IS NOT NULL`,
        [ids]
      );
      for (const r of rows) piByGuestyId.set(r.guesty_id, r.stripe_payment_intent_id);
    }
  } catch (err) {
    // Losing the PI map costs us the Stripe cross-check, not the whole sweep.
    console.error(
      "[PaymentAudit] local PI lookup failed:",
      err instanceof Error ? err.message : err
    );
  }

  const findings: Finding[] = [];
  const stamp = today();
  let scanned = 0;

  for (const reservation of reservations) {
    scanned++;
    const guestyId = String(reservation._id ?? "");
    const code = (reservation.confirmationCode as string) ?? null;
    const source = (reservation.source as string) ?? null;
    const checkOut = (reservation.checkOutDateLocalized as string) ?? null;

    const money = (reservation.money ?? {}) as Record<string, unknown>;
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

    const base = {
      confirmationCode: code,
      guestyId,
      source,
      checkOut,
      hostPayout,
      totalPaid,
      balanceDue,
      succeededCount: succeeded.length,
      unattributedCount: unattributed.length,
    };

    // ── Duplicate: two succeeded payments for the SAME amount ─────────────
    // A second succeeded payment is NOT itself suspicious — pet fees, stay
    // extensions and date changes all legitimately add one (GY-SHHhdMpj has a
    // $1738.41 stay payment plus a $50 pet fee and is perfectly fine). The
    // duplicate signature is two for the same amount, which is what the
    // auto-payment rule produces when it mirrors our charge.
    const byAmount = new Map<number, GuestyPayment[]>();
    for (const p of succeeded) {
      const amt = num(p.amount);
      if (amt === null) continue;
      byAmount.set(amt, [...(byAmount.get(amt) ?? []), p]);
    }
    const duplicated = [...byAmount.values()].filter((g) => g.length > 1).flat();

    if (duplicated.length > 0) {
      findings.push({
        ...base,
        kind: "duplicate_succeeded",
        detail:
          `${duplicated.length} succeeded payments share an amount: ` +
          duplicated
            .map((p) => `$${p.amount} @ ${p.createdAt}`)
            .join(" · "),
      });
      continue; // already reported; don't double-report on balance too
    }

    // ── Over-paid ─────────────────────────────────────────────────────────
    if (balanceDue !== null && balanceDue < -BALANCE_EPSILON) {
      findings.push({
        ...base,
        kind: "negative_balance",
        detail: `Guest appears over-paid by $${Math.abs(balanceDue).toFixed(2)}`,
      });
      continue;
    }

    // ── Money owed ────────────────────────────────────────────────────────
    // Only meaningful once the stay is OVER. A confirmed future booking with a
    // balance is a payment schedule doing its job, and flagging those would
    // bury the real ones — that risk arrived with Guesty enumeration, since our
    // own table only ever held bookings paid in full at checkout.
    const departed = checkOut !== null && checkOut <= stamp;
    if (
      departed &&
      balanceDue !== null &&
      balanceDue > BALANCE_EPSILON &&
      !UNBILLED_SOURCES.has(String(source))
    ) {
      // A Guesty balance is NOT evidence the guest owes money. Two of the first
      // three found had already paid in full and only Guesty's ledger was
      // short: recordPayment hit Guesty's "amount > balance" error,
      // re-recorded at the balance Guesty held at that instant, and the pet fee
      // landed on the invoice afterwards. Telling ops to "collect it" would
      // have charged those two a second time. Stripe is the arbiter.
      let stripeReceived: number | null = null;
      const pi = piByGuestyId.get(guestyId);
      if (pi) {
        try {
          const intent = await getStripeServer().paymentIntents.retrieve(pi);
          stripeReceived = (intent.amount_received ?? 0) / 100;
        } catch {
          // Leave null — an unreadable PI must not become a "go collect".
        }
      }

      const paidInFull =
        stripeReceived !== null &&
        hostPayout !== null &&
        stripeReceived >= hostPayout - BALANCE_EPSILON;

      // Nothing was ever attempted, as opposed to something having failed.
      // That is the hand-created-reservation signature and it needs different
      // words, because "the payment didn't go through" sends someone hunting
      // for a decline that does not exist.
      const neverAttempted = payments.length === 0;

      findings.push({
        ...base,
        kind: paidInFull ? "unrecorded_payment" : "unpaid_balance",
        stripeReceived,
        detail: paidInFull
          ? `DO NOT COLLECT — Stripe already received $${stripeReceived!.toFixed(2)}, ` +
            `covering the full $${hostPayout!.toFixed(2)}. Guesty's ledger is ` +
            `$${balanceDue.toFixed(2)} short, so the fix is to record the missing ` +
            `amount in Guesty, not to charge the guest.`
          : `$${balanceDue.toFixed(2)} uncollected after check-out (${checkOut}, source "${source}"). ` +
            (neverAttempted
              ? "There is NO payment record at all — nothing was attempted, rather than " +
                "something having failed. That is the signature of a reservation created " +
                "by hand in Guesty, where the auto-payment rules do not fire. Charge the " +
                "card on file."
              : pi
                ? `Stripe received $${(stripeReceived ?? 0).toFixed(2)} against a $${hostPayout?.toFixed(2)} invoice.`
                : "No Stripe payment on file, so check Guesty's own payment records before charging."),
      });
    }
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
      `PAYMENT LEDGER — ${findings.length} reservation(s) need a look`,
      [
        "<p>Guesty's payment ledger disagrees with what was collected. Verify in " +
          "Stripe before charging or refunding anyone.</p>",
        // The failure modes need opposite responses, so each block of guidance
        // shows only when that kind actually fired.
        findings.some(
          (f) => f.kind === "duplicate_succeeded" || f.kind === "negative_balance"
        )
          ? "<p><strong>Over-paid / duplicate:</strong> most likely the listing's " +
            "auto-payment rule recorded a duplicate alongside ours. The row with " +
            "<em>no</em> Stripe PI note is the one to void. The guest was probably " +
            "charged only once — confirm in Stripe first.</p>"
          : "",
        findings.some((f) => f.kind === "unpaid_balance")
          ? "<p><strong>Uncollected after check-out:</strong> the stay is over and " +
            "money is still owed. Where there is no payment record at all, nothing " +
            "was ever attempted — that is a reservation created by hand in Guesty, " +
            "which the auto-payment rules do not cover. Charge the card on file, " +
            "and charge it at creation next time.</p>"
          : "",
        findings.some((f) => f.kind === "unrecorded_payment")
          ? "<p><strong>Unrecorded payment — do NOT charge these guests.</strong> " +
            "Stripe already holds the full invoice amount; only Guesty's ledger is " +
            "short, so the balance on screen is money the guest does not owe. Fix it " +
            "by recording the missing amount in Guesty against the existing Stripe " +
            "payment.</p>"
          : "",
        ...findings.map((f) =>
          renderAlertDetails([
            ["Reservation", f.confirmationCode || f.guestyId],
            ["Issue", f.kind],
            ["Source", f.source ?? "(unknown)"],
            ["Check-out", f.checkOut ?? "(unknown)"],
            ["Host payout", f.hostPayout],
            ["Total paid", f.totalPaid],
            ["Balance due", f.balanceDue],
            ["Stripe received", f.stripeReceived ?? "(no Stripe payment)"],
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
    windowDays: days,
    matchingFilterInGuesty: reportedTotal,
    stripePisMatched: piByGuestyId.size,
    findingCount: findings.length,
    findings,
    dryRun,
  });
}
