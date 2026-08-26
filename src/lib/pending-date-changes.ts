/**
 * Server-side memory for in-flight portal date changes.
 *
 * The extend flow moves the dates on Guesty during its *quote* step, before the
 * guest pays, because Guesty has no dry-run pricing for a date change. Until
 * this table existed the only thing that undid that was a client-side rollback
 * fired from the modal's close/back buttons — so a closed tab left Guesty
 * extended and unpaid with no record anywhere that a change had been started.
 *
 * Every function here is best-effort: bookkeeping must never break the guest's
 * date change. A failure to write the row is logged and swallowed, which
 * degrades to exactly the behaviour we had before.
 */
import { getPool } from "@/lib/db";

/** How long a guest gets to finish paying before the sweeper intervenes. */
export const PENDING_DATE_CHANGE_TTL_MINUTES = 30;

export interface PendingDateChangeRow {
  id: string;
  reservation_id: string;
  confirmation_code: string | null;
  original_check_in: string;
  original_check_out: string;
  new_check_in: string;
  new_check_out: string;
  stripe_payment_intent_id: string | null;
  status: string;
  attempts: number;
  expires_at: string;
}

/**
 * Record that we are about to move (or have just moved) a reservation's dates.
 *
 * Call this BEFORE the Guesty write, not after: if the write succeeds but the
 * response is lost, a row that already exists still gets the dates put back,
 * whereas a row written afterwards would never exist at all. Recording a change
 * that did not happen is harmless — the rollback restores dates that are
 * already correct.
 *
 * On a re-quote the existing open row is reused and its `original_*` columns
 * are deliberately left alone. Overwriting them would record the previous
 * quote's already-changed dates as the original and roll the guest back to a
 * stay they never booked.
 */
export async function openPendingDateChange(params: {
  reservationId: string;
  confirmationCode?: string | null;
  originalCheckIn: string;
  originalCheckOut: string;
  newCheckIn: string;
  newCheckOut: string;
}): Promise<void> {
  const expiresAt = new Date(
    Date.now() + PENDING_DATE_CHANGE_TTL_MINUTES * 60_000
  ).toISOString();

  try {
    await getPool().query(
      `INSERT INTO pending_date_changes
         (reservation_id, confirmation_code,
          original_check_in, original_check_out,
          new_check_in, new_check_out, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (reservation_id) WHERE status = 'pending'
       DO UPDATE SET
         new_check_in  = EXCLUDED.new_check_in,
         new_check_out = EXCLUDED.new_check_out,
         expires_at    = EXCLUDED.expires_at`,
      [
        params.reservationId,
        params.confirmationCode ?? null,
        params.originalCheckIn,
        params.originalCheckOut,
        params.newCheckIn,
        params.newCheckOut,
        expiresAt,
      ]
    );
  } catch (err) {
    console.error(
      "[PendingDateChange] failed to open row (date change proceeds anyway):",
      err instanceof Error ? err.message : err
    );
  }
}

/** Remember the PI so the sweeper can check the real payment, not a balance. */
export async function attachPaymentIntent(
  reservationId: string,
  paymentIntentId: string
): Promise<void> {
  try {
    await getPool().query(
      `UPDATE pending_date_changes
          SET stripe_payment_intent_id = $2
        WHERE reservation_id = $1 AND status = 'pending'`,
      [reservationId, paymentIntentId]
    );
  } catch (err) {
    console.error(
      "[PendingDateChange] failed to attach PI:",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Close the open row for a reservation. Called on every terminal outcome so the
 * sweeper never touches a change that already resolved itself.
 */
export async function closePendingDateChange(
  reservationId: string,
  status:
    | "finalized"
    | "rolled_back"
    | "superseded"
    | "settled_externally"
    | "paid_not_finalized"
    | "rollback_failed",
  lastError?: string
): Promise<void> {
  try {
    await getPool().query(
      `UPDATE pending_date_changes
          SET status = $2, resolved_at = now(), last_error = $3
        WHERE reservation_id = $1 AND status = 'pending'`,
      [reservationId, status, lastError ?? null]
    );
  } catch (err) {
    console.error(
      "[PendingDateChange] failed to close row:",
      err instanceof Error ? err.message : err
    );
  }
}
