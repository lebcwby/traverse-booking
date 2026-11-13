/**
 * Damage-waiver revenue for the daily Slack digest.
 *
 * ── Where the money lives ───────────────────────────────────────────────
 *
 * SuiteOp sells the damage waiver during guest precheck and charges it
 * through OUR Stripe account. Nothing else records it: SuiteOp's MCP exposes
 * the waiver configuration (`listPrecheckSteps`: $5/$10/$20 a night by
 * bedroom tier) and the Store card beside it on Analytics > Guest Store
 * (`getUpsellPerformance`), but nothing for the waiver card, and a full
 * `getReservation` carries no waiver field. So Stripe it is.
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
 * reported $17,100 of released holds as money we earned.
 *
 * Filtering on absence instead — "not one of ours" — would have swept in the
 * deposits, the ad-hoc charges and the guest-store requests. See
 * src/lib/stripe-payment-source.ts for why that bucket exists.
 *
 * ── Which day a waiver belongs to ───────────────────────────────────────
 *
 * Two bases, and they are genuinely different numbers:
 *
 *   "check_in"     the stay's arrival date. Matches SuiteOp's Analytics >
 *                  Guest Store, which counts "against stays checking in
 *                  during this period". This is the default.
 *   "charge_date"  the day the card was charged. The fallback, used when
 *                  CRM_DATABASE_URL is unset.
 *
 * ⚠️ The gap is months, not hours. Guests pay at precheck, and a deposit
 * charged on 2026-10-28 was observed against a stay arriving 2026-12-23.
 * So a lookback window over charges cannot approximate the check-in basis —
 * the only correct shape is to start from the stays arriving that day and
 * find their charges, which is what fetchWaiverIntentsForCheckInDay does.
 *
 * ⚠️ On the check-in basis a figure can still move after it is reported: a
 * guest who prechecks late pays after they have arrived. The digest reports
 * the morning after, so it catches the common case and will undercount a
 * straggler. SuiteOp's dashboard has the same property.
 */
import type Stripe from "stripe";
import { getStripeServer } from "./stripe";
import { crmConfigured, fetchGuestyReservationIdsCheckingIn } from "./crm-db";

/** SuiteOp stamps this on everything it creates in our Stripe account. */
const ORIGINATOR = "SuiteOp";
/** The `Charge Type` value that means a damage waiver, as opposed to a
 *  Deposit hold, an ad-hoc Charge or a guest-store Request. */
const WAIVER_CHARGE_TYPE = "Waiver";
/** The metadata key carrying the Guesty reservation id. */
const PMS_RESERVATION_ID = "PMS Reservation ID";

/** Stop paging rather than risk the digest timing out; a day is ~20 intents. */
const MAX_SCANNED = 1000;
/** Reservation ids per Stripe search query. ~30 arrivals a day → 3 queries. */
const SEARCH_BATCH = 10;

export type WaiverBasis = "check_in" | "charge_date";

export interface WaiverSummary {
  day: string;
  /** Which day a waiver was attributed to. See the header. */
  basis: WaiverBasis;
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
  /** On the check-in basis, how many arrivals were looked at. */
  arrivalsConsidered: number | null;
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
  day: string,
  basis: WaiverBasis = "charge_date",
  arrivalsConsidered: number | null = null
): WaiverSummary {
  let count = 0;
  let grossCents = 0;
  let refundedCents = 0;
  let failedCount = 0;
  // Stripe search can return the same intent from two overlapping batches.
  const seen = new Set<string>();

  for (const pi of intents) {
    if (!isSuiteOpWaiver(pi)) continue;
    if (pi.id && seen.has(pi.id)) continue;
    if (pi.id) seen.add(pi.id);

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
    basis,
    count,
    grossCents,
    refundedCents,
    netCents: grossCents - refundedCents,
    failedCount,
    arrivalsConsidered,
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
  const heading =
    w.basis === "check_in"
      ? `*Damage waivers — stays arriving ${w.day}*`
      : `*Damage waivers — charged ${w.day}*`;

  const parts: string[] = [];

  if (w.count === 0) {
    parts.push(
      w.basis === "check_in" && w.arrivalsConsidered === 0
        ? "No arrivals."
        : "No waivers charged."
    );
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

  if (w.basis === "check_in" && w.arrivalsConsidered) {
    parts.push(`_across ${w.arrivalsConsidered} arrivals_`);
  }

  if (w.failedCount > 0) {
    parts.push(
      `⚠️ ${w.failedCount} waiver${w.failedCount === 1 ? "" : "s"} failed to charge — ${w.failedCount === 1 ? "that stay is" : "those stays are"} uncovered.`
    );
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${heading}\n${parts.join("\n")}` },
    },
  ];
}

/** Guesty ids are hex, but quote defensively so a stray character cannot
 *  break out of the search string. */
function escapeForSearch(value: string): string {
  return value.replace(/["\\]/g, "");
}

/**
 * Waiver intents belonging to the stays that arrive on `day`.
 *
 * Driven from the arrivals rather than from a window of charges, because the
 * lead time between paying and arriving runs to months — see the header.
 *
 * Stripe's Search API is eventually consistent, lagging writes by under a
 * minute. The digest reports the morning after, so that is immaterial here.
 */
export async function fetchWaiverIntentsForCheckInDay(
  day: string
): Promise<{ intents: Stripe.PaymentIntent[]; arrivals: number }> {
  const reservationIds = await fetchGuestyReservationIdsCheckingIn(day);
  if (reservationIds.length === 0) return { intents: [], arrivals: 0 };

  const stripe = getStripeServer();
  const intents: Stripe.PaymentIntent[] = [];

  for (let i = 0; i < reservationIds.length; i += SEARCH_BATCH) {
    const batch = reservationIds.slice(i, i + SEARCH_BATCH);
    const query = batch
      .map((id) => `metadata["${PMS_RESERVATION_ID}"]:"${escapeForSearch(id)}"`)
      .join(" OR ");

    for await (const pi of stripe.paymentIntents.search({
      query,
      limit: 100,
      // Refund totals live on the charge; without this they are all zero.
      expand: ["data.latest_charge"],
    })) {
      intents.push(pi);
      if (intents.length >= MAX_SCANNED) break;
    }
    if (intents.length >= MAX_SCANNED) break;
  }

  return { intents, arrivals: reservationIds.length };
}

/**
 * SuiteOp PaymentIntents created in one civil day.
 *
 * The charge-date fallback, used when CRM_DATABASE_URL is unset and the
 * arrivals for a day cannot be known. Stripe's `created` filter is in whole
 * seconds and the bounds are the same Mountain-day instants the rest of the
 * digest uses, so a waiver charged at 23:58 Mountain lands on the day the
 * guest paid it rather than the next one in UTC.
 */
export async function fetchWaiverIntentsByChargeDay(
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
    expand: ["data.latest_charge"],
  })) {
    out.push(pi);
    if (out.length >= MAX_SCANNED) break;
  }
  return out;
}

/**
 * The day's waivers, on the check-in basis when the CRM is reachable and on
 * the charge-date basis when it is not.
 *
 * Degrading rather than failing is deliberate: a waiver figure on the wrong
 * basis is still true and is labelled as such in Slack, whereas no figure at
 * all tells the reader nothing.
 */
export async function fetchWaiverSummary(
  day: string,
  dayStartIso: string,
  dayEndIso: string
): Promise<WaiverSummary> {
  if (crmConfigured()) {
    const { intents, arrivals } = await fetchWaiverIntentsForCheckInDay(day);
    return buildWaiverSummary(intents, day, "check_in", arrivals);
  }
  const intents = await fetchWaiverIntentsByChargeDay(dayStartIso, dayEndIso);
  return buildWaiverSummary(intents, day, "charge_date");
}
