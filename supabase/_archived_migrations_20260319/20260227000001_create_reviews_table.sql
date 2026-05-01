CREATE TABLE IF NOT EXISTS reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guesty_id text UNIQUE NOT NULL,
  listing_id text NOT NULL,
  reservation_id text,
  guest_id text,
  channel text,
  overall_rating smallint,
  public_review text,
  category_cleanliness smallint,
  category_accuracy smallint,
  category_checkin smallint,
  category_communication smallint,
  category_location smallint,
  category_value smallint,
  reviewer_name text,
  review_date text,
  guesty_created_at text,
  guesty_updated_at text,
  last_synced_at bigint
);

CREATE INDEX idx_reviews_listing ON reviews (listing_id);
CREATE INDEX idx_reviews_date ON reviews (review_date DESC);
