-- Guest-portal cancellation: restore the three columns the cancel flow needs.
--
-- The cancellation/refund feature shipped with code (and unit tests) that read
-- and write eight columns on `reservations`, but production only ever got five
-- of them: canceled_at, refund_status, refund_amount, stripe_payment_intent_id,
-- stripe_refund_id. The other three were never applied.
--
-- Consequence: SELECT_RESERVATION in
-- src/app/api/account/reservations/[reservationId]/cancel/route.ts names
-- r.guesty_canceled_at, so *every* guest cancellation attempt failed at the
-- first query with Postgres 42703 (undefined_column), got swallowed by the
-- route's outer catch, and surfaced to the guest as a bare
-- "Failed to cancel reservation". /api/cron/reconcile-cancellation-refunds
-- failed the same way on guesty_refund_recorded.
--
-- The unit tests never caught it because they mock pool.query.
--
-- All three are nullable with NO default — the code relies on NULL meaning
-- "not attempted yet":
--   * guesty_canceled_at      NULL -> Guesty cancel not yet performed
--   * guesty_refund_recorded  tri-state: NULL = not attempted,
--                             true = recorded in Guesty, false = attempt failed
--                             (a `false` default would make the reconcile cron
--                             re-process every historical reservation)
--   * cancellation_email_sent_at NULL -> cancellation email not yet sent
--                             (this is the idempotency guard against
--                             double-emailing a guest)

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guesty_canceled_at        timestamptz,
  ADD COLUMN IF NOT EXISTS guesty_refund_recorded    boolean,
  ADD COLUMN IF NOT EXISTS cancellation_email_sent_at timestamptz;

COMMENT ON COLUMN public.reservations.guesty_canceled_at IS
  'When the cancellation was pushed to Guesty. NULL = not yet canceled in Guesty.';
COMMENT ON COLUMN public.reservations.guesty_refund_recorded IS
  'Tri-state: NULL = refund record not attempted, true = recorded in Guesty, false = attempt failed.';
COMMENT ON COLUMN public.reservations.cancellation_email_sent_at IS
  'Idempotency guard for the guest cancellation email. NULL = not sent.';

-- The reconcile cron scans for cancelled reservations whose Guesty refund
-- record has not been written yet; keep that scan off a sequential scan.
CREATE INDEX IF NOT EXISTS reservations_refund_reconcile_idx
  ON public.reservations (canceled_at)
  WHERE canceled_at IS NOT NULL AND guesty_refund_recorded IS NOT TRUE;
