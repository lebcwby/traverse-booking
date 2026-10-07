import { getPool } from "@/lib/db";

/**
 * Is the reservation behind a confirmation code still holding the dates?
 *
 * The double-charge guard in /api/payment-intent skips any succeeded
 * PaymentIntent that already carries a `confirmationCode`, on the reasoning
 * that a coded PI is either (a) an active booking, "in which case the dates
 * are unavailable and the guest can't even quote them here", or (b) a
 * cancelled booking whose dates are legitimately free again.
 *
 * (a) is not true during a race. On 2026-10-07 a guest paid at 00:43:14,
 * finalize took nearly two minutes, and at 00:45:24 — fourteen seconds after
 * his own reservation GY-Z6iXznfG appeared — he paid again on a quote he was
 * already holding. He never re-quoted, so Guesty's availability never got a
 * chance to stop him. The guard skipped the coded PI, Stripe took a second
 * $793.58, and only then did Guesty refuse: "There is not availability to
 * create this reservation in these dates" — unavailable because of his own
 * booking two minutes earlier.
 *
 * The detector did not catch it either: the retry minted a NEW Stripe
 * customer, and detectDoubleCharge correlates by customer.
 *
 * So resolve the code instead of assuming. A confirmed reservation means the
 * dates are held and a second charge for the same stay is a duplicate; a
 * canceled one means the dates are genuinely free and re-booking must work.
 */
export type CodedBookingState = "active" | "canceled" | "unknown";

export async function getBookingStateForConfirmationCode(
  confirmationCode: string
): Promise<CodedBookingState> {
  const code = (confirmationCode || "").trim();
  if (!code) return "unknown";
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT status
         FROM reservations
        WHERE confirmation_code = $1
        LIMIT 1`,
      [code]
    );
    if (rows.length === 0) return "unknown";
    // 'confirmed' and 'canceled' are the only values this table carries.
    // Treat anything that is not an explicit cancellation as still holding
    // the dates — the safe direction when money is involved.
    return String(rows[0].status) === "canceled" ? "canceled" : "active";
  } catch (err) {
    console.error(
      `[stay-booking-state] lookup failed for ${code}:`,
      err instanceof Error ? err.message : err
    );
    return "unknown";
  }
}

/**
 * How recently a PaymentIntent was created, in minutes. Used to decide what
 * to do when a coded PI cannot be resolved to a reservation row.
 */
export function minutesSince(unixSeconds: number | null | undefined): number {
  if (!unixSeconds) return Number.POSITIVE_INFINITY;
  return (Date.now() - unixSeconds * 1000) / 60000;
}

/**
 * A coded PaymentIntent we could not resolve is treated as still active when
 * it is this recent. A retry-double-charge happens within minutes (fourteen
 * seconds, in the case above); a legitimate re-booking of cancelled dates
 * happens much later. Blocking is recoverable — the guest can call, and the
 * attempt raises an alert. A duplicate charge is not.
 */
export const UNRESOLVED_CODED_PI_ACTIVE_WINDOW_MINUTES = 120;
