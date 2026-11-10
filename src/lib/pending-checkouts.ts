import { getPool } from "@/lib/db";
import type { ConsentState } from "./consent";
import {
  buildBookingFingerprint,
  buildGuestIdentityKey,
  buildStayKey,
} from "@/lib/booking-identity";

export interface PendingGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface PendingTracking {
  listingId: string;
  listingTitle: string;
  /** Internal short name — populates GA4 Item variant column. */
  listingNickname?: string | null;
  picture?: string | null;
  propertyType?: string | null;
  city?: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  stayTotal?: number;
  totalPaid?: number;
  eventId?: string;
  consent?: ConsentState;
  marketingOptIn?: boolean;
}

export interface TrackingContext {
  cookies?: {
    attribution?: string;
    firstTouch?: string;
    ga?: string;
    gaSession?: string;
    consent?: string;
    legacyCcpaOptOut?: string;
    fbp?: string;
    fbc?: string;
    /** Serialized `_sp_path` breadcrumb — see src/lib/click-path.ts. */
    clickPath?: string;
  };
  requestContext?: {
    clientIp?: string;
    clientUserAgent?: string;
  };
}

export interface PendingCheckoutInput {
  paymentIntentId: string;
  quoteId: string;
  ratePlanId?: string | null;
  stripeCustomerId?: string | null;
  guest: PendingGuest;
  tracking: PendingTracking;
  upsells?: string[];
  pets?: number;
  quoteSnapshot?: Record<string, unknown> | null;
  trackingContext?: TrackingContext;
}

export interface PendingCheckoutRecord extends PendingCheckoutInput {
  quoteSnapshot?: Record<string, unknown> | null;
  stayKey?: string | null;
  guestIdentityKey?: string | null;
  bookingFingerprint?: string | null;
  status: string;
  reservationId?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

/**
 * Always 0. The website charges nothing for pets as of 2026-10-17; the
 * column is retained so historical rows keep their meaning and so an older
 * client posting a count does not break the insert.
 */
function normalizePets(_pets?: number) {
  return 0;
}

export async function upsertPendingCheckout(input: PendingCheckoutInput) {
  try {
    const pool = getPool();
    const stayKey = buildStayKey({
      listingId: input.tracking.listingId,
      checkIn: input.tracking.checkIn,
      checkOut: input.tracking.checkOut,
    });
    const guestIdentityKey = buildGuestIdentityKey({
      guestEmail: input.guest.email,
      guestPhone: input.guest.phone,
    });
    const bookingFingerprint = buildBookingFingerprint({
      listingId: input.tracking.listingId,
      checkIn: input.tracking.checkIn,
      checkOut: input.tracking.checkOut,
      guestEmail: input.guest.email,
      guestPhone: input.guest.phone,
    });

    await pool.query(
      `INSERT INTO pending_checkouts (
      payment_intent_id, quote_id, rate_plan_id, stripe_customer_id, guest, tracking, upsells, pets, status, quote_snapshot, stay_key, guest_identity_key, booking_fingerprint, tracking_context, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, now())
     ON CONFLICT (payment_intent_id) DO UPDATE SET
       quote_id = EXCLUDED.quote_id,
       rate_plan_id = COALESCE(EXCLUDED.rate_plan_id, pending_checkouts.rate_plan_id),
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, pending_checkouts.stripe_customer_id),
       guest = EXCLUDED.guest,
       tracking = EXCLUDED.tracking,
       upsells = EXCLUDED.upsells,
       pets = EXCLUDED.pets,
       quote_snapshot = COALESCE(EXCLUDED.quote_snapshot, pending_checkouts.quote_snapshot),
       stay_key = COALESCE(EXCLUDED.stay_key, pending_checkouts.stay_key),
       guest_identity_key = COALESCE(EXCLUDED.guest_identity_key, pending_checkouts.guest_identity_key),
       booking_fingerprint = COALESCE(EXCLUDED.booking_fingerprint, pending_checkouts.booking_fingerprint),
       tracking_context = COALESCE(EXCLUDED.tracking_context, pending_checkouts.tracking_context),
       status = CASE
         WHEN pending_checkouts.status = 'completed' THEN pending_checkouts.status
         ELSE 'pending'
       END,
       updated_at = now()`,
      [
        input.paymentIntentId,
        input.quoteId,
        input.ratePlanId || null,
        input.stripeCustomerId || null,
        JSON.stringify(input.guest),
        JSON.stringify(input.tracking),
        JSON.stringify(Array.isArray(input.upsells) ? input.upsells : []),
        normalizePets(input.pets),
        input.quoteSnapshot ? JSON.stringify(input.quoteSnapshot) : null,
        stayKey,
        guestIdentityKey,
        bookingFingerprint,
        input.trackingContext ? JSON.stringify(input.trackingContext) : null,
      ]
    );
  } catch (err) {
    console.warn(
      "[PendingCheckout] DB write failed (non-critical):",
      (err as Error).message
    );
  }
}

function mapRow(row: Record<string, unknown>): PendingCheckoutRecord {
  return {
    paymentIntentId: String(row.payment_intent_id),
    quoteId: String(row.quote_id),
    ratePlanId: row.rate_plan_id ? String(row.rate_plan_id) : null,
    stripeCustomerId: row.stripe_customer_id
      ? String(row.stripe_customer_id)
      : null,
    guest: (row.guest as PendingGuest) || {
      firstName: "",
      lastName: "",
      email: "",
    },
    tracking: (row.tracking as PendingTracking) || {
      listingId: "",
      listingTitle: "",
      checkIn: "",
      checkOut: "",
      guests: 0,
    },
    upsells: Array.isArray(row.upsells) ? (row.upsells as string[]) : [],
    pets: Number(row.pets || 0),
    quoteSnapshot:
      (row.quote_snapshot as Record<string, unknown> | null) || null,
    trackingContext:
      (row.tracking_context as TrackingContext | null) || undefined,
    stayKey: row.stay_key ? String(row.stay_key) : null,
    guestIdentityKey: row.guest_identity_key
      ? String(row.guest_identity_key)
      : null,
    bookingFingerprint: row.booking_fingerprint
      ? String(row.booking_fingerprint)
      : null,
    status: String(row.status),
    reservationId: row.reservation_id ? String(row.reservation_id) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function getPendingCheckout(paymentIntentId: string) {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM pending_checkouts WHERE payment_intent_id = $1`,
      [paymentIntentId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (err) {
    console.warn(
      "[PendingCheckout] DB read failed (non-critical):",
      (err as Error).message
    );
    return null;
  }
}

export async function findBlockingPendingCheckout(args: {
  quoteId: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
}) {
  const pool = getPool();
  const stayKey = buildStayKey(args);
  const bookingFingerprint = buildBookingFingerprint(args);
  const result = await pool.query(
    `SELECT *
     FROM pending_checkouts
     WHERE (
         quote_id = $1
         OR ($2::text IS NOT NULL AND stay_key = $2)
         OR ($3::text IS NOT NULL AND booking_fingerprint = $3)
       )
       AND status = 'paid_pending_reservation'
       AND reservation_id IS NULL
       AND created_at > now() - interval '2 days'
     ORDER BY created_at DESC
     LIMIT 1`,
    [args.quoteId, stayKey, bookingFingerprint]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function findLatestReusablePendingCheckout(args: {
  quoteId: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
}) {
  const pool = getPool();
  const bookingFingerprint = buildBookingFingerprint(args);
  const result = await pool.query(
    `SELECT *
     FROM pending_checkouts
     WHERE (
         quote_id = $1
         OR ($2::text IS NOT NULL AND booking_fingerprint = $2)
       )
       AND status = 'pending'
       AND reservation_id IS NULL
       AND created_at > now() - interval '2 days'
     ORDER BY created_at DESC
     LIMIT 1`,
    [args.quoteId, bookingFingerprint]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listRecoverablePendingCheckouts(limit = 20) {
  const pool = getPool();
  // Rows with reservation_id set are already booked in Guesty; payment
  // recording (if still outstanding) is handled by the record-payments cron.
  // Reprocessing them here just wastes API calls and can race concurrent work.
  //
  // The 2-day age cap applies to `pending` ONLY. Those rows are abandoned
  // carts: nothing was captured, the guest owes nothing, and the Guesty quote
  // behind them is long expired — retrying them for weeks buys nothing.
  //
  // `paid_pending_reservation` means the opposite: Stripe took the money and
  // the guest is holding nothing. Those get no age limit at all.
  // pi_3UZX3uFlSHWQrCQq1wzui10S is why. It sat here with $477.44 captured and
  // no reservation, failing identically every 10 minutes because Guesty
  // rejects an empty guest.firstName. The fix that would have rescued it
  // (reading the name off the Stripe charge, #126) deployed ~25 minutes AFTER
  // the row crossed 48 hours — so the cron had already stopped looking at it,
  // while orphan-sweep went on alerting about it forever. "We retry for two
  // days, then just complain" is not a recovery policy for captured money.
  //
  // What bounds a paid row is the STAY, not its age. Guesty refuses a quote
  // whose checkIn is before today in the listing's timezone, so once check-in
  // has passed the row can never finalize and retrying only burns BEAPI calls
  // against a rate limit we share with the CRM, PriceLabs and Conduit.
  // pi_3UHMk9FlSHWQrCQq1KcrL7Fe is the cautionary case: $217.63 for a
  // 2026-09-20 one-night stay, failing on exactly that validation ever since.
  // Dropping it here leaves it to the orphan-sweep alert and a human, which is
  // correct — the money question outlived the booking question.
  //
  // checkIn is ISO 'YYYY-MM-DD' text inside the tracking JSON, so it is
  // compared as text: lexicographic order is chronological for that format,
  // and it cannot throw the way ::date would on a malformed value. A row with
  // no checkIn at all defaults to the far future and stays eligible — when in
  // doubt, keep trying to give the guest the booking they paid for.
  //
  // Within those bounds the only escape hatch is reservation_id: once the
  // booking exists — finalized by the cron, or created by hand and stamped on
  // the row — the predicate drops it. The alert in recover-checkouts/route.ts
  // spells out that stamping the row is what stops the retries and the alerts.
  const result = await pool.query(
    `SELECT *
     FROM pending_checkouts
     WHERE reservation_id IS NULL
       AND (
         (
           status = 'paid_pending_reservation'
           AND coalesce(nullif(tracking->>'checkIn', ''), '9999-12-31')
               >= to_char(now() AT TIME ZONE 'America/Denver', 'YYYY-MM-DD')
         )
         OR (status = 'pending' AND created_at > now() - interval '2 days')
       )
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapRow);
}

export async function markPendingCheckoutCompleted(
  paymentIntentId: string,
  reservationId: string
) {
  const pool = getPool();
  await pool.query(
    `UPDATE pending_checkouts
     SET status = 'completed',
         reservation_id = $2,
         completed_at = now(),
         last_error = null,
         updated_at = now()
     WHERE payment_intent_id = $1`,
    [paymentIntentId, reservationId]
  );
}

export async function markPendingCheckoutError(
  paymentIntentId: string,
  error: string,
  status = "pending"
) {
  const pool = getPool();
  // If the row already has reservation_id, a prior finalize call succeeded —
  // don't clobber its completed status with an error from a later (losing)
  // caller. This belt-and-suspenders the advisory lock in
  // checkout-finalizer.ts: even if a future caller bypasses the lock, we
  // never flip a completed booking back to a retry state.
  await pool.query(
    `UPDATE pending_checkouts
     SET status = $3,
         last_error = $2,
         updated_at = now()
     WHERE payment_intent_id = $1
       AND reservation_id IS NULL`,
    [paymentIntentId, error.slice(0, 1000), status]
  );
}

export async function deletePendingCheckout(paymentIntentId: string) {
  const pool = getPool();
  await pool.query(
    `DELETE FROM pending_checkouts WHERE payment_intent_id = $1`,
    [paymentIntentId]
  );
}
