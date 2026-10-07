import type Stripe from "stripe";

/**
 * Every succeeded PaymentIntent Stripe knows about for one stay.
 *
 * Correlating on the STAY (listing + check-in + check-out) rather than the
 * Stripe customer is the point. detectDoubleCharge used to list PaymentIntents
 * by `customer`, which silently misses the most common duplicate of all: a
 * guest who retries and whose retry mints a new customer id. That is exactly
 * what happened to GY-Z6iXznfG on 2026-10-07 — two $793.58 charges, two
 * customer ids, no alert.
 *
 * Shared by the pre-charge guard in /api/payment-intent and the post-charge
 * detector in the Stripe webhook so the two cannot drift. They apply different
 * rules to the result: the guard asks "may I create another charge?", the
 * detector asks "did we already take two?".
 */
export async function searchSucceededPaymentIntentsForStay(
  stripe: Stripe,
  stay: {
    listingId?: string | null;
    checkIn?: string | null;
    checkOut?: string | null;
  },
  limit = 20
): Promise<Stripe.PaymentIntent[]> {
  const { listingId, checkIn, checkOut } = stay;
  // Without a stay we cannot correlate anything — and a PaymentIntent with no
  // listing/date metadata is not one of our booking charges in the first
  // place (SuiteOp damage waivers share this Stripe account).
  if (!listingId || !checkIn || !checkOut) return [];

  // Stay fields are listing ids / formatted dates — no single quotes — so they
  // embed safely in the Search query string.
  const query =
    `status:'succeeded'` +
    ` AND metadata['listingId']:'${listingId}'` +
    ` AND metadata['checkIn']:'${checkIn}'` +
    ` AND metadata['checkOut']:'${checkOut}'`;

  const result = await stripe.paymentIntents.search({
    query,
    limit,
    expand: ["data.latest_charge"],
  });
  return result.data;
}

/** True when the charge behind a PaymentIntent has been fully refunded. */
export function isFullyRefunded(pi: Stripe.PaymentIntent): boolean {
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return false;
  return (
    charge.refunded || (charge.amount_refunded ?? 0) >= (charge.amount ?? 0)
  );
}
