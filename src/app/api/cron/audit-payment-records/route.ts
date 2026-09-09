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
 * `balanceDue` goes negative. That much is an accounting defect rather than a
 * guest one: `totalPaid` is what owner statements and payouts read.
 *
 * ⚠️ CORRECTION (2026-09-09): this file used to say of GY-hNBNy23v "He had not
 * [been double-charged] — Stripe held a single charge." That was WRONG, and the
 * guest proved it with his card statement six weeks later. Two separate $592.90
 * captures existed: ours through Stripe, and one through GUESTYPAY 74 minutes
 * later, carrying auth 03216D. GuestyPay is a different processor, so its
 * capture is invisible in our Stripe account — which is exactly why the original
 * check "Stripe holds one charge, therefore the guest paid once" reached the
 * wrong answer. The premise in CLAUDE.md that direct bookings are safe because
 * no card is vaulted in Guesty is also wrong: `createReservationInstant` passes
 * the Stripe payment method as `ccToken`, so Guesty does have a chargeable card
 * on every direct booking, and the auto-payment rule can and does use it.
 *
 * A sweep of all 214 BE-API bookings since June found three (Welch $592.90,
 * Lance $357.19, Taub $1738.41) — each refunded on the Stripe leg only after
 * the guest complained, at 38, 6 and 28 days. `guestypay_shadow_charge` below
 * is what should have caught them.
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
 *     ?bookedDays=<n> look-back on BOOKING date for the double-charge pass
 *                     (default 14, max 180)
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
 * The recently-booked pass. Deliberately small and fixed: a double charge
 * lands within minutes of booking (74 in the Welch case), so a fortnight of
 * new reservations is generous, and keeping it fixed means the checkout-window
 * knobs can be tuned without quietly starving this one.
 */
const RECENT_BOOKING_DAYS = 14;
const RECENT_BOOKING_SCAN = 200;
/**
 * Hard ceiling on the recently-booked pass. It is generous because the pass is
 * filtered to BE-API only (see below) — roughly 3 bookings a day rather than
 * the ~39/day across all channels — so this covers months, not days.
 */
const RECENT_BOOKING_MAX = 600;

/**
 * Owner and owner-guest stays are not billed to the occupant, so a balance on
 * one is the expected shape rather than a defect. Everything else that reaches
 * check-out should be settled.
 */
const UNBILLED_SOURCES = new Set(["owner", "owner-guest"]);

interface GuestyPaymentAttempt {
  payload?: {
    ProcessorResult?: { AuthNumber?: string } | null;
    processorResult?: { AuthNumber?: string } | null;
  } | null;
}

interface GuestyPayment {
  amount?: number;
  status?: string;
  note?: string | null;
  createdAt?: string;
  /** Present when a human pressed charge; absent when automation did it. */
  createdBy?: string | null;
  /** An AuthNumber in here is proof GuestyPay actually captured the card. */
  attempts?: GuestyPaymentAttempt[];
}

/**
 * A real GuestyPay capture — a different processor from our Stripe, so the
 * money never appears in our Stripe account. The AuthNumber is the tell.
 */
function isGuestyPayCapture(p: GuestyPayment): boolean {
  return (p.attempts ?? []).some((a) => {
    const pr = a?.payload?.ProcessorResult ?? a?.payload?.processorResult;
    return Boolean(pr?.AuthNumber);
  });
}

interface Finding {
  confirmationCode: string | null;
  guestyId: string;
  kind:
    | "duplicate_succeeded"
    | "guestypay_shadow_charge"
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
  // Overridable so a suspected case can be re-scanned over its own booking
  // window without a deploy — the default is what the nightly cron uses.
  const bookedDays = Math.min(
    180,
    Math.max(
      1,
      parseInt(
        url.searchParams.get("bookedDays") || String(RECENT_BOOKING_DAYS),
        10
      ) || RECENT_BOOKING_DAYS
    )
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
        // ASCENDING from `since`, so the scan starts at recently-departed and
        // imminent stays and works forward. It used to sort descending, which
        // spent the record budget on the stays furthest in the future and
        // could stop before reaching anything urgent: at a 200-record default
        // this run reached no earlier than 2026-10-30, leaving a genuine
        // double charge on a 2026-09-19 stay unscanned. Unpaid balances and
        // double charges matter most on stays that already happened or are
        // about to, so those get the budget first.
        sort: "checkOutDateLocalized",
        filters: [
          { field: "status", operator: "$eq", value: "confirmed" },
          { field: "checkOutDateLocalized", operator: "$gte", value: since },
        ],
      });
      reportedTotal = count;
      reservations.push(...results);
      if (results.length < PAGE_SIZE) break;
    }

    // ── Second pass: recently BOOKED, whatever their checkout date ────────
    // A double charge is created at booking time, not at checkout, so keying
    // it to the checkout window is the wrong axis: Stewart Taub was charged
    // twice on 14 July for a stay that does not check out until 17 Feb 2027,
    // and the checkout-ordered scan reaches him only after everything sooner.
    // Whichever direction that scan runs, one end of the ledger is starved.
    // This pass covers what the other axis structurally cannot — a small,
    // fixed window of the newest bookings, which is where a fresh double
    // charge always is. Deduplicated by id against the first pass.
    const seen = new Set(reservations.map((r) => String(r._id ?? "")));
    // Filtered to BE-API on purpose. The shadow charge needs a payment row
    // noted "Stripe PI …", and we only ever write those on our own direct
    // bookings — an OTA reservation cannot produce this defect, because the
    // ccToken that gives Guesty a chargeable card is only passed on the direct
    // path. Scanning every channel spent the budget on reservations that could
    // not match: at ~39 confirmed bookings a day across all sources, an
    // 800-record cap reached back barely three weeks and a 75-day request
    // silently missed all three known cases. BE-API alone is ~3/day.
    let recentTotal = Infinity;
    for (let skip = 0; skip < Math.min(RECENT_BOOKING_MAX, recentTotal); skip += PAGE_SIZE) {
      const { results, count } = await getOpenAPIReservationsPage({
        fields:
          "_id confirmationCode status source checkInDateLocalized checkOutDateLocalized money.hostPayout money.totalPaid money.balanceDue money.payments guest.fullName",
        limit: PAGE_SIZE,
        skip,
        sort: "-createdAt",
        filters: [
          { field: "status", operator: "$eq", value: "confirmed" },
          { field: "source", operator: "$eq", value: "BE-API" },
          {
            field: "createdAt",
            operator: "$gte",
            value: daysAgo(bookedDays),
          },
        ],
      });
      recentTotal = Number.isFinite(count) ? count : recentTotal;
      for (const r of results) {
        if (!seen.has(String(r._id ?? ""))) reservations.push(r);
      }
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

    // ── GuestyPay charged the same amount our Stripe already took ─────────
    // The signature the duplicate check above CANNOT see. On GY-hNBNy23v the
    // guest was charged $592.90 twice — once by us through Stripe, once by
    // Guesty's per-listing auto-payment rule through GuestyPay, 74 minutes
    // later. Only ONE of the two rows was SUCCEEDED: our Stripe row had been
    // CANCELLED in Guesty, which left the ledger looking balanced
    // (totalPaid == hostPayout, balanceDue 0) while the guest's card had
    // genuinely been hit twice. Every balance-based and duplicate-based test
    // here passes on that shape, which is why the three known cases surfaced
    // only when the guests themselves complained — after 6, 28 and 38 days.
    //
    // GuestyPay money never lands in our Stripe, so the amounts matching
    // across the two processors is the whole signal. A GuestyPay capture on
    // its own is normal and is NOT flagged: staff collect balances that way
    // (Paul's stay extension), and stay additions do too.
    const stripeNoted = payments.filter((p) => p.note?.includes("Stripe PI"));
    const shadow = succeeded
      .filter(isGuestyPayCapture)
      .find((g) =>
        stripeNoted.some(
          (s) =>
            num(s.amount) !== null &&
            num(g.amount) !== null &&
            Math.abs((num(s.amount) as number) - (num(g.amount) as number)) <
              0.01
        )
      );

    if (shadow) {
      const twin = stripeNoted.find(
        (s) =>
          Math.abs((num(s.amount) ?? 0) - (num(shadow.amount) ?? 0)) < 0.01
      );
      findings.push({
        ...base,
        kind: "guestypay_shadow_charge",
        detail:
          `GuestyPay captured $${shadow.amount} (auth confirmed) and a Stripe ` +
          `record exists for the same amount [${twin?.status ?? "?"}]. ` +
          `The card was very likely charged twice by two different processors. ` +
          `CHECK STRIPE for an existing refund before issuing one — all three ` +
          `known cases were already refunded on the Stripe side. Never refund ` +
          `the GuestyPay leg: it is the one the reservation is paid with.`,
      });
      continue;
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
        findings.some((f) => f.kind === "guestypay_shadow_charge")
          ? "<p><strong>GuestyPay shadow charge — the guest really was charged " +
            "twice.</strong> Unlike the duplicate above, this is two captures on " +
            "two different processors, so the second one never shows in our " +
            "Stripe. <strong>Check Stripe for an existing refund before issuing " +
            "one</strong> — every case so far was already refunded, and refunding " +
            "twice is its own incident. Refund the <em>Stripe</em> leg, never the " +
            "GuestyPay one: GuestyPay is what the reservation is actually paid " +
            "with, and reversing it leaves the stay unpaid.</p>"
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
