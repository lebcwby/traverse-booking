-- Add beapi_enabled flag to track which listings are accessible via the
-- Guesty Booking Engine API (BEAPI). Listings synced from the Open API
-- that aren't in the BEAPI will return 403 on detail/calendar/quote calls.
-- The pricing-cache refresh cron populates this flag hourly.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS beapi_enabled BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_listings_beapi_enabled ON listings (beapi_enabled);
