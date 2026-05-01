ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_recorded_at bigint;

CREATE INDEX IF NOT EXISTS idx_reservations_stripe_payment_intent_id
  ON reservations (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id
  ON reservations (user_id);

CREATE INDEX IF NOT EXISTS idx_reservations_payment_recorded_at
  ON reservations (payment_recorded_at);
