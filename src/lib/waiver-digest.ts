/**
 * Damage-waiver revenue for the daily Slack digest.
 *
 * ── Where the money lives ───────────────────────────────────────────────
 *
 * SuiteOp sells the damage waiver during guest precheck and charges it
 * through OUR Stripe account — the same one the website uses. There is no
 * other record of it: SuiteOp's MCP exposes the waiver *configuration*
 * (`listPrecheckSteps`: $5/$10/$20 a night by bedroom tier) and the Store
 * card beside it on Analytics > Guest Store (`getUpsellPerformance`), but
 * nothing for the waiver card itself, and a full `getReservation` carries no
 * waiver field. So Stripe it is.
 *
 * ── Identifying one ─────────────────────────────────────────────────────
 *
 * SuiteOp stamps every charge it creates with `Originator: "SuiteOp"` and a
 * `Charge Type`. Both must be checked. Over the 31 days to 2026-11-03 that
 * account held 421 SuiteOp PaymentIntents in five types:
 *
 *   Waiver   276 succeeded   $4,850   automatic capture  ← this is ours
 *   Deposit   92 canceled   $17,100   manual capture
 *   Deposit    9 held        $1,550   manual capture
 *   Charge    13 succeeded   $1,365   ad-hoc staff charges
 *   Request   19 succeeded     $495   guest-store requests
 *
 * ⚠️ Deposits are AUTHORIZATION HOLDS, not revenue — manual capture, and
 * almost all end `canceled` because the hold is released after checkout.
 * Summing SuiteOp's charges without splitting on `Charge Type` would have
 * reported $17,100 of released holds as money we earned. They are
 * deliberately not in this digest at all.
 *
 * Filtering on absence instead — "not one of ours" — would have swept in the
 * deposits, the ad-hoc charges and the guest-store requests. See
 * src/lib/stripe-payment-source.ts for why that bucket exists.
 *
 * ── Which day a waiver belongs to ───────────────────────────────────────
 *
 * This counts by the day the CARD WAS CHARGED, which is what "waivers paid"
 * means and what the rest of the digest does.
 *
 * ⚠️ It therefore will NOT tie exactly to SuiteOp's Analytics > Guest Store,
 * which counts a waiver against the stay's CHECK-IN date. Guests pay at
 * precheck, often days before arrival, so the two agree over a long window
 * and disagree on any given day. Expect the monthly totals to be close —
 * $4,850 here for Oct 3–Nov 3 against SuiteOp's $4,329 for Oct 1–31 — and
 * do not treat a daily difference as a bug.
 */
import type Stripe from "stripe";
import { getStripeServer } from "./stripe";

/** SuiteOp stamps this on everything it creates in our Stripe account. */
const ORIGINATOR = "SuiteOp";
/** The `Charge Type` value that means a damage waiver, as opposed to a
 *  Deposit hold, an ad-hoc Charge or a guest-store Request. */
const WAIVER_CHARGE_TYPE = "Waiver";

/** Stop paging rather than risk the digest timing out; a day is ~20 intents. */
const MAX_SCANNED = 1000;

export interface WaiverSummary {
  day: string;
  /** Waivers that actually charged. */
  count: number;
  grossCents: number;
  refundedCents: number;
  netCents: number;
  /**
   * Waivers SuiteOp tried to charge and could not. Worth surfacing: the stay
   * goes ahead uncovered, and nothing else in our stack would mention it.
   */
  failedCount: number;
}

function isSuiteOpWaiver(pi: Stripe.PaymentIntent): boolean {
  const m = pi.metadata ?? {};
  return m.Originator === ORIGINATOR && m["Charge Type"] === WAIVER_CHARGE_TYPE;
}

/** Refunds live on the charge, not the intent, hence the expand at the call site. */
function refundedCentsOf(pi: Stripe.PaymentIntent): number {
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return 0;
  return charge.amount_refunded ?? 0;
}

export function buildWaiverSummary(
  intents: Stripe.PaymentIntent[],
  day: string
): WaiverSummary {
  let count = 0;
  let grossCents = 0;
  let refundedCents = 0;
  let failedCount = 0;

  for (const pi of intents) {
    if (!isSuiteOpWaiver(pi)) continue;
    if (pi.status === "succeeded") {
      count += 1;
      grossCents += pi.amount_received || pi.amount || 0;
      refundedCents += refundedCentsOf(pi);
    } else if (pi.status !== "canceled") {
      // requires_payment_method and friends: SuiteOp asked for the money and
      // did not get it. `canceled` is a waiver deliberately withdrawn, which
      // is not a failure anyone needs to chase.
      failedCount += 1;
    }
  }

  return {
    day,
    count,
    grossCents,
    refundedCents,
    netCents: grossCents - refundedCents,
    failedCount,
  };
}

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Slack blocks for the waiver line. One block, always rendered — a zero is
 * information on a day with arrivals, and silence would be ambiguous.
 */
export function renderWaiverBlocks(
  w: WaiverSummary
): Record<string, unknown>[] {
  const parts: string[] = [];

  if (w.count === 0) {
    parts.push("No waivers charged.");
  } else {
    parts.push(
      `${w.count} waiver${w.count === 1 ? "" : "s"} · ${money(w.netCents)}`
    );
    if (w.refundedCents > 0) {
      parts.push(
        `_${money(w.grossCents)} charged, ${money(w.refundedCents)} refunded_`
      );
    }
  }

  if (w.failedCount > 0) {
    parts.push(
      `⚠️ ${w.failedCount} waiver${w.failedCount === 1 ? "" : "s"} failed to charge — ${w.failedCount === 1 ? "that stay is" : "those stays are"} uncovered.`
    );
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Damage waivers — ${w.day}*\n${parts.join("\n")}`,
      },
    },
  ];
}

/**
 * SuiteOp PaymentIntents created in one civil day.
 *
 * Stripe's `created` filter is in whole seconds and the bounds are the same
 * Mountain-day instants the rest of the digest uses, so a waiver charged at
 * 23:58 Mountain lands on the day the guest paid it rather than the next
 * one in UTC.
 */
export async function fetchWaiverIntents(
  dayStartIso: string,
  dayEndIso: string
): Promise<Stripe.PaymentIntent[]> {
  const stripe = getStripeServer();
  const gte = Math.floor(Date.parse(dayStartIso) / 1000);
  const lt = Math.floor(Date.parse(dayEndIso) / 1000);

  const out: Stripe.PaymentIntent[] = [];
  for await (const pi of stripe.paymentIntents.list({
    created: { gte, lt },
    limit: 100,
    // Refund totals live on the charge; without this they are all zero.
    expand: ["data.latest_charge"],
  })) {
    out.push(pi);
    if (out.length >= MAX_SCANNED) break;
  }
  return out;
}
