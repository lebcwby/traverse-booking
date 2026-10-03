-- One active reservation per (payment intent, listing, stay).
--
-- GY-ty5Dgqzs / GY-8RHBqLsm (2026-10-02): two confirmed reservations for the
-- same guest, listing and dates, created 117ms apart from a SINGLE payment.
-- The guest was charged once; we double-booked a Leadville house over the
-- December peak and recorded the same $1,558.34 against both, which would
-- have doubled the owner's statement.
--
-- Cause: the Stripe webhook and the frontend POST /api/reservations both call
-- finalizeReservation. Its dedup is a read-then-write with no DB constraint
-- behind it, so two concurrent callers both read "no existing row" and both
-- create. The advisory lock that is supposed to serialise them runs over
-- Supabase's TRANSACTION pooler in production (DATABASE_URL on :6543, with no
-- SHARED_DATABASE_URL_DIRECT set), where pg_advisory_lock gives no
-- session-scoped exclusion — so it has been a no-op.
--
-- This index does not depend on connection mode. It is the backstop that
-- makes the duplicate impossible to persist locally.
--
-- Scoped to (payment_intent, listing, stay) and NOT to payment_intent alone,
-- because multi-unit CART checkouts legitimately share one payment intent
-- across several listings — e.g. GY-4LqAP5rf + GY-bYqMuxuu (two Grand Lodge
-- units, one night, one payment). A unique index on the intent alone would
-- have broken every one of those.
--
-- Cancelled rows are excluded so a cancelled duplicate can sit alongside the
-- booking that replaced it, which is exactly the state GY-ty5Dgqzs is in now.
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_stay_idx
  ON public.reservations (stripe_payment_intent_id, listing_id, check_in, check_out)
  WHERE stripe_payment_intent_id IS NOT NULL
    AND COALESCE(status, '') <> 'canceled';
