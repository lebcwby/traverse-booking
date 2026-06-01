-- Phase 2 multi-listing cart checkout — durable spine for atomic cart
-- reservations. Separate from `pending_checkouts` because the cart shape
-- (multiple lines, partial-failure rollback) is fundamentally different
-- from the single-listing flow. Same lifecycle pattern: row created when
-- the Stripe PaymentIntent is created, status walked forward as each line
-- is reserved, terminal states are 'completed' / 'partial' / 'refunded' /
-- 'refund_failed' (the last triggering manual + cron reconciliation).
--
-- `cart_id` is the natural identifier for the user-facing /cart/confirmation
-- route. `payment_intent_id` is the natural identifier for Stripe webhooks +
-- the coordinator's advisory-lock key.

CREATE TABLE IF NOT EXISTS pending_cart_checkouts (
  cart_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id  text        NOT NULL UNIQUE,
  status             text        NOT NULL DEFAULT 'pending',
                                 -- 'pending' | 'paid' | 'reserving' | 'completed'
                                 -- | 'partial' | 'refunded' | 'refund_failed'
  guest              jsonb       NOT NULL,
                                 -- { firstName, lastName, email, phone? }
  lines              jsonb       NOT NULL,
                                 -- Array<{
                                 --   lineId: uuid,
                                 --   quoteId: text,
                                 --   ratePlanId: text | null,
                                 --   listingId: text,
                                 --   listingTitle: text,
                                 --   listingPicture: text | null,
                                 --   listingCity: text | null,
                                 --   checkIn: 'YYYY-MM-DD',
                                 --   checkOut: 'YYYY-MM-DD',
                                 --   guests: int,
                                 --   pets: int,
                                 --   hostPayout: numeric,
                                 --   status: 'pending'|'reserved'|'failed'|'refunded',
                                 --   reservationId: text | null,
                                 --   errorMessage: text | null,
                                 --   refundAmount: numeric | null
                                 -- }>
  total_paid         numeric     NOT NULL,
  coupon_code        text        NULL,
  tracking_context   jsonb       NULL,
                                 -- { cookies?, requestContext? } — same shape as
                                 -- pending_checkouts.tracking_context
  marketing_opt_in   boolean     NOT NULL DEFAULT false,
  stripe_customer_id text        NULL,
  last_error         text        NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz NULL
);

-- Coordinator looks up by payment_intent_id (after Stripe PI succeeds).
-- UNIQUE constraint on the column already creates an index, so this is
-- redundant but harmless to be explicit.
CREATE INDEX IF NOT EXISTS pending_cart_checkouts_payment_intent_id_idx
  ON pending_cart_checkouts (payment_intent_id);

-- Reconcile cron picks up `refund_failed` rows.
CREATE INDEX IF NOT EXISTS pending_cart_checkouts_status_idx
  ON pending_cart_checkouts (status)
  WHERE status IN ('refund_failed', 'reserving');

-- Recover-checkouts cron (mirrors pending_checkouts pattern) finds rows that
-- reached 'paid' but never completed within the timeout window.
CREATE INDEX IF NOT EXISTS pending_cart_checkouts_paid_stale_idx
  ON pending_cart_checkouts (updated_at)
  WHERE status = 'paid';

COMMENT ON TABLE pending_cart_checkouts IS
  'Multi-listing cart checkouts. One row per Stripe PaymentIntent; lines tracked individually for partial-failure rollback.';
