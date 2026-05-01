CREATE TABLE IF NOT EXISTS pending_checkouts (
  payment_intent_id text PRIMARY KEY,
  quote_id text NOT NULL,
  rate_plan_id text,
  stripe_customer_id text,
  guest jsonb,
  tracking jsonb,
  upsells jsonb,
  pets integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reservation_id text,
  quote_snapshot jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_status_created
  ON pending_checkouts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_quote_id
  ON pending_checkouts (quote_id);
