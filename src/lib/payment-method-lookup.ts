import { getStripeServer } from "@/lib/stripe";

/**
 * Normalised summary of the card + timing info we care about for a
 * reservation's payment, used on the confirmation page and the trip
 * detail page.
 */
export interface PaymentMethodLookup {
  brand: string | null;
  last4: string | null;
  /** ISO 8601 timestamp when the card was charged. */
  paidAt: string | null;
  /** Stripe-hosted receipt page URL. */
  receiptUrl: string | null;
}

/**
 * Pull the first SUCCEEDED non-hold payment's paidAt from Guesty's
 * money.payments array. Used as a fallback when a Stripe PI isn't
 * available (older pre-finalizer reservations).
 */
export function extractPaidAtFromMoney(
  money: Record<string, unknown> | null | undefined
): string | null {
  if (!money) return null;
  const payments = (money as { payments?: unknown }).payments;
  if (!Array.isArray(payments)) return null;
  for (const p of payments) {
    if (!p || typeof p !== "object") continue;
    const payment = p as {
      status?: unknown;
      isAuthorizationHold?: unknown;
      paidAt?: unknown;
    };
    if (payment.status !== "SUCCEEDED") continue;
    if (payment.isAuthorizationHold) continue;
    if (typeof payment.paidAt === "string") return payment.paidAt;
  }
  return null;
}

/**
 * Fetch the card brand, last4, paid timestamp, and Stripe-hosted receipt
 * URL for a reservation's PaymentIntent. Silently returns null on any
 * failure — payment method info is a nice-to-have, not load-bearing, so
 * an expired key or a rate-limited Stripe call must not break the caller.
 */
export async function lookupReservationPaymentMethod({
  stripePaymentIntentId,
  money,
}: {
  stripePaymentIntentId: string | null;
  money: Record<string, unknown> | null | undefined;
}): Promise<PaymentMethodLookup | null> {
  const paidAt = extractPaidAtFromMoney(money);

  if (!stripePaymentIntentId) {
    if (paidAt) return { brand: null, last4: null, paidAt, receiptUrl: null };
    return null;
  }

  try {
    const stripe = getStripeServer();
    const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId, {
      expand: ["payment_method", "latest_charge"],
    });

    let brand: string | null = null;
    let last4: string | null = null;
    let receiptUrl: string | null = null;

    const pm = pi.payment_method;
    if (pm && typeof pm !== "string" && pm.card) {
      brand = pm.card.brand ?? null;
      last4 = pm.card.last4 ?? null;
    }

    // Fall back to latest_charge.payment_method_details if the payment_method
    // object isn't expanded (can happen on older PIs where the PM was detached).
    // Also pulls the Stripe-hosted receipt URL, which only exists on the charge.
    let stripePaidAt: string | null = paidAt;
    if (pi.latest_charge && typeof pi.latest_charge !== "string") {
      const charge = pi.latest_charge;
      if (charge.payment_method_details?.card) {
        const card = charge.payment_method_details.card;
        brand ??= card.brand ?? null;
        last4 ??= card.last4 ?? null;
      }
      receiptUrl = charge.receipt_url ?? null;
      if (typeof charge.created === "number") {
        stripePaidAt = new Date(charge.created * 1000).toISOString();
      }
    }

    if (!brand && !last4 && !stripePaidAt && !receiptUrl) return null;
    return { brand, last4, paidAt: stripePaidAt, receiptUrl };
  } catch (err) {
    console.warn(
      "[payment-method-lookup] Stripe PI retrieve failed:",
      err instanceof Error ? err.message : err
    );
    if (paidAt) return { brand: null, last4: null, paidAt, receiptUrl: null };
    return null;
  }
}
