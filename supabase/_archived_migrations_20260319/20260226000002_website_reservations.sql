CREATE TABLE website_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id text UNIQUE NOT NULL,
  confirmation_code text,
  guest_email text NOT NULL,
  guest_name text,
  guest_phone text,
  listing_id text,
  listing_name text,
  listing_photo text,
  listing_address jsonb,
  check_in date,
  check_out date,
  guests_count integer,
  status text DEFAULT 'confirmed',
  money jsonb,
  key_code text,
  special_requests text,
  guesty_updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_website_reservations_email ON website_reservations (guest_email);
CREATE INDEX idx_website_reservations_status ON website_reservations (status);
CREATE INDEX idx_website_reservations_check_in ON website_reservations (check_in);

-- RLS: only service role can write, authenticated users read their own
ALTER TABLE website_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reservations"
  ON website_reservations FOR SELECT
  TO authenticated
  USING (lower(guest_email) = lower(auth.jwt() ->> 'email'));

CREATE POLICY "Service role full access"
  ON website_reservations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
