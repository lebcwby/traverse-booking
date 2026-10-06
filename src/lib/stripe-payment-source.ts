/**
 * Which of our flows, if any, created a PaymentIntent.
 *
 * Why this exists: our Stripe account is shared. SuiteOp posts damage-waiver
 * charges through the same account, and every one of them fired a
 * "PAID BOOKING MISSING PENDING CHECKOUT" email — the webhook looked for a
 * pending_checkouts row, found none (correctly, because the website never
 * created the charge) and treated it as a stranded booking. The alert key is
 * per-PaymentIntent, so the one-hour cooldown in src/lib/alerts.ts never
 * collapses them: one email per charge, indefinitely.
 *
 * This is an ALLOWLIST, deliberately, not a SuiteOp blocklist. We can enumerate
 * the three places the website mints a PaymentIntent and what each one stamps
 * on it; we cannot enumerate every third party that might ever share the
 * account. A blocklist would go quiet for SuiteOp and then start crying wolf
 * again the day someone connects the next integration.
 *
 * The three website flows and their marks:
 *   1. /api/payment-intent                 → metadata.quoteId (required; the
 *      route 400s without it) via buildPaymentIntentMetadata().
 *   2. /api/cart/payment-intent            → metadata.cartCheckout === "true".
 *   3. /api/account/reservations/[id]/extend → metadata.type === "date_change".
 *
 * Precedent for ignoring foreign charges already exists in the codebase:
 * detectDoubleCharge() and the orphan-sweep cron both skip PaymentIntents with
 * no listing/stay metadata as "not a booking charge". This only extends the
 * same judgement to the missing-pending-checkout branch, which was the one
 * place that still assumed every charge in the account was ours.
 */
export type PaymentSource =
  | "website_booking"
  | "website_cart"
  | "website_date_change"
  | "external";

export function classifyPaymentIntent(pi: {
  metadata?: Record<string, string> | null;
}): PaymentSource {
  const metadata = pi.metadata ?? {};

  // Trim before testing: a metadata value of " " is not a quote id, and
  // Stripe will happily store whitespace.
  if ((metadata.quoteId ?? "").trim() !== "") return "website_booking";
  if (metadata.cartCheckout === "true") return "website_cart";
  if (metadata.type === "date_change") return "website_date_change";

  return "external";
}
