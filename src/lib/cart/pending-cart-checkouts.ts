// Durable spine for multi-listing cart checkouts. Mirrors the pattern in
// src/lib/pending-checkouts.ts but with a per-line array so the
// coordinator can walk each line forward independently and roll back
// individual lines on partial failure. Same DB pool, same error swallow
// strategy (DB issues never block a checkout — they only break recovery).

import { getPool } from "@/lib/db";
import type { PendingGuest, TrackingContext } from "@/lib/pending-checkouts";

/** Per-line state inside the cart row. Walked forward by the coordinator. */
export interface CartLine {
  /** Stable client-side id from the cart store; not used for any DB lookup. */
  lineId: string;
  /** Active BEAPI quote id at PaymentIntent creation time. May be replaced
   * if the coordinator has to re-quote (e.g., expired before reservation). */
  quoteId: string;
  ratePlanId: string | null;
  listingId: string;
  listingTitle: string;
  listingPicture: string | null;
  listingCity: string | null;
  /** ISO YYYY-MM-DD, BEAPI's localized convention. */
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  /** Authoritative server-fetched line total at PI creation. The combined
   * Stripe charge equals sum(hostPayout) across lines. */
  hostPayout: number;
  /** Walks forward as the coordinator processes the line. */
  status: "pending" | "reserved" | "failed" | "refunded";
  reservationId: string | null;
  errorMessage: string | null;
  /** Set when a line is rolled back; coordinator computes the prorated
   * portion of the combined PI to refund for this line. */
  refundAmount: number | null;
}

export type CartCheckoutStatus =
  | "pending"
  /** Stripe PI confirmed, coordinator hasn't started reservations yet. */
  | "paid"
  /** Coordinator is mid-flight; advisory lock held. Recovery cron skips
   * these unless the row is older than the timeout. */
  | "reserving"
  /** All lines reserved, payment recorded, confirmation sent. */
  | "completed"
  /** Some lines reserved, others refunded. Terminal. */
  | "partial"
  /** No lines succeeded; full PI refunded. Terminal. */
  | "refunded"
  /** Stripe refund call itself errored; reconcile cron retries. */
  | "refund_failed";

export interface PendingCartCheckoutInput {
  paymentIntentId: string;
  guest: PendingGuest;
  lines: CartLine[];
  totalPaid: number;
  couponCode?: string | null;
  trackingContext?: TrackingContext | null;
  marketingOptIn?: boolean;
  stripeCustomerId?: string | null;
}

export interface PendingCartCheckoutRecord
  extends PendingCartCheckoutInput {
  cartId: string;
  status: CartCheckoutStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Create or update the cart row. Idempotent on payment_intent_id, so
 * retries from /api/cart/payment-intent during 3DS / network blips don't
 * duplicate. Returns the cart_id (uuid) for the user-facing redirect. */
export async function upsertPendingCartCheckout(
  input: PendingCartCheckoutInput
): Promise<{ cartId: string }> {
  try {
    const pool = getPool();
    const result = await pool.query<{ cart_id: string }>(
      `INSERT INTO pending_cart_checkouts (
         payment_intent_id, guest, lines, total_paid, coupon_code,
         tracking_context, marketing_opt_in, stripe_customer_id, status, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now())
       ON CONFLICT (payment_intent_id) DO UPDATE SET
         guest = EXCLUDED.guest,
         lines = EXCLUDED.lines,
         total_paid = EXCLUDED.total_paid,
         coupon_code = COALESCE(EXCLUDED.coupon_code, pending_cart_checkouts.coupon_code),
         tracking_context = COALESCE(EXCLUDED.tracking_context, pending_cart_checkouts.tracking_context),
         marketing_opt_in = EXCLUDED.marketing_opt_in,
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, pending_cart_checkouts.stripe_customer_id),
         status = CASE
           WHEN pending_cart_checkouts.status IN ('completed', 'partial', 'refunded') THEN pending_cart_checkouts.status
           ELSE 'pending'
         END,
         updated_at = now()
       RETURNING cart_id`,
      [
        input.paymentIntentId,
        JSON.stringify(input.guest),
        JSON.stringify(input.lines),
        input.totalPaid,
        input.couponCode ?? null,
        input.trackingContext
          ? JSON.stringify(input.trackingContext)
          : null,
        input.marketingOptIn ?? false,
        input.stripeCustomerId ?? null,
      ]
    );
    return { cartId: result.rows[0].cart_id };
  } catch (e) {
    console.error("[cart] upsertPendingCartCheckout failed:", e);
    throw e;
  }
}

export async function getPendingCartCheckoutByPaymentIntent(
  paymentIntentId: string
): Promise<PendingCartCheckoutRecord | null> {
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT cart_id, payment_intent_id, status, guest, lines, total_paid,
              coupon_code, tracking_context, marketing_opt_in, stripe_customer_id,
              last_error, created_at, updated_at, completed_at
         FROM pending_cart_checkouts
        WHERE payment_intent_id = $1
        LIMIT 1`,
      [paymentIntentId]
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  } catch (e) {
    console.error("[cart] getPendingCartCheckoutByPaymentIntent failed:", e);
    return null;
  }
}

export async function getPendingCartCheckoutByCartId(
  cartId: string
): Promise<PendingCartCheckoutRecord | null> {
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT cart_id, payment_intent_id, status, guest, lines, total_paid,
              coupon_code, tracking_context, marketing_opt_in, stripe_customer_id,
              last_error, created_at, updated_at, completed_at
         FROM pending_cart_checkouts
        WHERE cart_id = $1
        LIMIT 1`,
      [cartId]
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  } catch (e) {
    console.error("[cart] getPendingCartCheckoutByCartId failed:", e);
    return null;
  }
}

/** Walk the row forward — single-status update without touching lines. */
export async function setCartStatus(
  paymentIntentId: string,
  status: CartCheckoutStatus,
  opts: { lastError?: string | null; markCompleted?: boolean } = {}
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE pending_cart_checkouts
          SET status = $2,
              last_error = COALESCE($3, last_error),
              completed_at = CASE WHEN $4::boolean THEN now() ELSE completed_at END,
              updated_at = now()
        WHERE payment_intent_id = $1`,
      [paymentIntentId, status, opts.lastError ?? null, opts.markCompleted ?? false]
    );
  } catch (e) {
    console.error("[cart] setCartStatus failed:", e);
  }
}

/** Update a single line in the lines[] jsonb. Used as the coordinator walks
 * each reservation forward. Uses jsonb_set on the line index so concurrent
 * writes to other lines don't stomp. (The coordinator is sequential within
 * a single PI thanks to the advisory lock, so this is belt-and-suspenders.) */
export async function updateCartLine(
  paymentIntentId: string,
  lineId: string,
  patch: Partial<Pick<CartLine, "status" | "reservationId" | "errorMessage" | "refundAmount" | "quoteId" | "ratePlanId" | "hostPayout">>
): Promise<void> {
  try {
    const pool = getPool();
    // Read-modify-write — the lines column is small (max 5 entries) so the
    // round-trip overhead is negligible. Keeps the SQL straightforward.
    const r = await pool.query<{ lines: CartLine[] }>(
      `SELECT lines FROM pending_cart_checkouts WHERE payment_intent_id = $1 LIMIT 1`,
      [paymentIntentId]
    );
    if (r.rows.length === 0) return;
    const lines = r.rows[0].lines.map((l) =>
      l.lineId === lineId ? { ...l, ...patch } : l
    );
    await pool.query(
      `UPDATE pending_cart_checkouts
          SET lines = $2, updated_at = now()
        WHERE payment_intent_id = $1`,
      [paymentIntentId, JSON.stringify(lines)]
    );
  } catch (e) {
    console.error("[cart] updateCartLine failed:", e);
  }
}

function mapRow(row: Record<string, unknown>): PendingCartCheckoutRecord {
  return {
    cartId: row.cart_id as string,
    paymentIntentId: row.payment_intent_id as string,
    status: row.status as CartCheckoutStatus,
    guest: row.guest as PendingGuest,
    lines: row.lines as CartLine[],
    totalPaid: Number(row.total_paid),
    couponCode: (row.coupon_code as string | null) ?? null,
    trackingContext:
      (row.tracking_context as TrackingContext | null) ?? null,
    marketingOptIn: row.marketing_opt_in as boolean,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    completedAt:
      row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : null,
  };
}
