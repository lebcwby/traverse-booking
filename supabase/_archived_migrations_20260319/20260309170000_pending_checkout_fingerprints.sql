ALTER TABLE pending_checkouts
  ADD COLUMN IF NOT EXISTS stay_key text,
  ADD COLUMN IF NOT EXISTS guest_identity_key text,
  ADD COLUMN IF NOT EXISTS booking_fingerprint text;

UPDATE pending_checkouts
SET
  stay_key = CASE
    WHEN COALESCE(tracking->>'listingId', '') <> ''
      AND COALESCE(tracking->>'checkIn', '') <> ''
      AND COALESCE(tracking->>'checkOut', '') <> ''
    THEN CONCAT(tracking->>'listingId', '|', tracking->>'checkIn', '|', tracking->>'checkOut')
    ELSE NULL
  END,
  guest_identity_key = CASE
    WHEN lower(trim(COALESCE(guest->>'email', ''))) <> ''
      THEN CONCAT('email:', lower(trim(guest->>'email')))
    WHEN regexp_replace(COALESCE(guest->>'phone', ''), '\D', '', 'g') <> ''
      THEN CONCAT('phone:', regexp_replace(COALESCE(guest->>'phone', ''), '\D', '', 'g'))
    ELSE NULL
  END,
  booking_fingerprint = CASE
    WHEN COALESCE(tracking->>'listingId', '') <> ''
      AND COALESCE(tracking->>'checkIn', '') <> ''
      AND COALESCE(tracking->>'checkOut', '') <> ''
      AND lower(trim(COALESCE(guest->>'email', ''))) <> ''
    THEN CONCAT(
      tracking->>'listingId', '|', tracking->>'checkIn', '|', tracking->>'checkOut', '|email:',
      lower(trim(guest->>'email'))
    )
    WHEN COALESCE(tracking->>'listingId', '') <> ''
      AND COALESCE(tracking->>'checkIn', '') <> ''
      AND COALESCE(tracking->>'checkOut', '') <> ''
      AND regexp_replace(COALESCE(guest->>'phone', ''), '\D', '', 'g') <> ''
    THEN CONCAT(
      tracking->>'listingId', '|', tracking->>'checkIn', '|', tracking->>'checkOut', '|phone:',
      regexp_replace(COALESCE(guest->>'phone', ''), '\D', '', 'g')
    )
    ELSE NULL
  END;

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_stay_key_status_created
  ON pending_checkouts (stay_key, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_booking_fingerprint
  ON pending_checkouts (booking_fingerprint);
