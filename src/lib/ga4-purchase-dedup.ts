/**
 * One GA4 `purchase` per booking, keyed on transaction_id.
 *
 * ── Why ─────────────────────────────────────────────────────────────────
 *
 * GA4 deduplicates the Ecommerce *transactions* metric by `transaction_id`,
 * but it does NOT deduplicate the `purchase` **event count** — so a second
 * send inflates the event total and the revenue reported against it. Every
 * server path that can finalize a booking is retryable:
 *
 *   - the Stripe webhook retries on non-2xx, and `finalizeReservation` has
 *     its own retry loop around the Guesty call;
 *   - `/api/reservations` can finalize the same PaymentIntent the webhook is
 *     already finalizing (that race is what the advisory lock guards);
 *   - the cart coordinator sends one purchase per reserved line, and a
 *     partially-failed cart can be re-driven.
 *
 * Measured 2026-10-19: 59 real direct bookings in GA4's Sep 18 – Oct 17
 * window against 70 reported `purchase` events. Not the 2x a client+server
 * double-fire would produce, but ~19% over, and this closes the server half
 * of that gap.
 *
 * ── Atomicity ───────────────────────────────────────────────────────────
 *
 * A read-then-write check is not enough: two lambdas finalizing the same
 * booking would both read "not sent" and both send. This claims the id with
 * a single INSERT and treats a unique-violation as "someone else already
 * sent it" — the same shape the alert cooldown in src/lib/alerts.ts still
 * needs.
 *
 * ── Fails OPEN, deliberately ────────────────────────────────────────────
 *
 * If the claim cannot be written (DB down, kv_store unavailable) we SEND.
 * A duplicate purchase overstates a report; a dropped purchase loses a real
 * conversion from GA4 and from Google Ads bidding, and we have form here —
 * two BE-API purchases went missing in May 2026 to a fire-and-forget bug.
 * Over-reporting is recoverable, under-reporting is invisible.
 */
import { getSupabaseAdmin } from "./supabase-admin";

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";

function keyFor(transactionId: string) {
  return `ga4_purchase:${transactionId}`;
}

/**
 * Returns true if this call owns the send for `transactionId`.
 * False means another call already claimed it and this one must not send.
 */
export async function claimGa4Purchase(
  transactionId: string | null | undefined
): Promise<boolean> {
  // No id means we cannot dedupe at all. Send — see "fails open" above.
  if (!transactionId) return true;

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return true;

    const { error } = await supabase.from("kv_store").insert({
      key: keyFor(transactionId),
      value: { sentAt: Date.now() },
    });

    if (!error) return true;
    if (error.code === UNIQUE_VIOLATION) {
      console.warn(
        `[GA4] purchase ${transactionId} already sent — skipping duplicate.`
      );
      return false;
    }
    // Any other error: we do not know, so send.
    console.error(
      "[GA4] purchase claim failed, sending anyway:",
      error.message
    );
    return true;
  } catch (err) {
    console.error("[GA4] purchase claim threw, sending anyway:", err);
    return true;
  }
}
