-- ============================================
-- Stay Portland — Complete Database Schema
-- Migrated from simply-dashboard Supabase project
-- ============================================

-- ============================================
-- 1. Guesty OAuth Token Cache
-- ============================================
-- Stores OAuth tokens for both OpenAPI (sync functions) and BEAPI (booking engine).
-- Guesty enforces a 5-token-per-24-hour limit, so we cache aggressively.
-- token_type is the primary key for upsert operations.
create table if not exists guesty_tokens (
  id bigint generated always as identity primary key,
  token_type text not null unique,  -- 'openapi' or 'beapi'
  access_token text not null,
  expires_at bigint not null,       -- Unix timestamp (ms)
  created_at bigint not null        -- Unix timestamp (ms)
);

-- ============================================
-- 2. Key-Value Store (caching layer)
-- ============================================
-- General-purpose KV store for cached data like featured listings and pricing.
-- Keys: 'featured_listings', 'listing_pricing_cache'
create table if not exists kv_store (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- ============================================
-- 3. Sync Metadata — track progress for each sync type
-- ============================================
create table if not exists sync_metadata (
  id bigint generated always as identity primary key,
  sync_type text not null unique,
  last_sync_at bigint not null,
  last_sync_status text not null,     -- 'success' | 'error' | 'in_progress'
  items_synced integer not null default 0,
  error_message text,
  current_offset integer,
  total_items integer,
  initial_sync_complete boolean default false
);

create unique index if not exists idx_sync_metadata_type on sync_metadata (sync_type);

-- ============================================
-- 4. Listings
-- ============================================
create table if not exists listings (
  id bigint generated always as identity primary key,
  guesty_id text not null unique,

  -- Basic info
  nickname text,
  title text,
  property_type text,
  room_type text,

  -- Capacity
  bedrooms integer,
  bathrooms numeric,
  beds integer,
  accommodates integer,
  area_square_feet numeric,

  -- Address (jsonb)
  address jsonb,

  -- Pricing (jsonb)
  prices jsonb,

  -- Status
  active boolean,
  is_listed boolean,
  cleaning_status jsonb,

  -- Terms (jsonb)
  terms jsonb,

  -- Times
  default_check_in_time text,
  default_check_out_time text,
  timezone text,

  -- Media
  picture text,
  picture_count integer,

  -- Contact
  host_name text,
  contact_phone text,

  -- Arrays (jsonb)
  amenities jsonb,
  tags jsonb,
  owners jsonb,
  integrations jsonb,

  -- Complex objects (jsonb)
  occupancy_stats jsonb,
  financials jsonb,
  custom_fields jsonb,

  -- Wheelhouse dynamic pricing data
  wheelhouse_data jsonb,

  -- Timestamps
  guesty_created_at text,
  guesty_updated_at text,
  last_synced_at bigint not null
);

create index if not exists idx_listings_guesty_id on listings (guesty_id);
create index if not exists idx_listings_active on listings (active);

-- ============================================
-- 5. Reservations
-- ============================================
create table if not exists reservations (
  id bigint generated always as identity primary key,
  guesty_id text not null unique,

  -- Core identifiers
  confirmation_code text,
  listing_id text,
  guest_id text,

  -- Status
  status text,
  source text,
  secondary_source text,

  -- Dates
  check_in text not null,
  check_out text not null,
  check_in_date_localized text,
  check_out_date_localized text,
  nights_count integer,

  -- Denormalized guest & listing info (jsonb)
  guest jsonb,
  listing jsonb,

  -- Guest count
  guests_count integer,
  number_of_guests jsonb,

  -- Financial summary (jsonb)
  money jsonb,
  money_full jsonb,

  -- Integration info (jsonb)
  integration jsonb,

  -- Notes (jsonb — can be string or object)
  notes jsonb,
  special_requests text,
  planned_arrival text,
  planned_departure text,
  key_code text,

  -- Flags
  is_returning_guest boolean,
  manually_created boolean,

  -- Review (jsonb)
  review jsonb,

  -- Timestamps
  confirmed_at text,
  guesty_created_at text,
  guesty_updated_at text,
  last_synced_at bigint not null,

  -- Enrichment tracking
  enriched_at bigint,
  enrichment_error text
);

create index if not exists idx_reservations_listing on reservations (listing_id);
create index if not exists idx_reservations_status on reservations (status);
create index if not exists idx_reservations_check_in on reservations (check_in);
create index if not exists idx_reservations_check_out on reservations (check_out);
create index if not exists idx_reservations_source on reservations (source);
create index if not exists idx_reservations_enriched on reservations (enriched_at);

-- ============================================
-- 6. Calendar Days — daily pricing & availability per listing
-- ============================================
create table if not exists calendar_days (
  id bigint generated always as identity primary key,
  listing_id text not null,
  date text not null,  -- "YYYY-MM-DD"

  -- Pricing
  price numeric,
  currency text,
  is_base_price boolean,

  -- Stay rules
  min_nights integer,
  is_base_min_nights boolean,

  -- Status (derived from rawStatus + blocks)
  status text not null,  -- "available" | "booked" | "blocked"
  raw_status text,

  -- Block flags from Guesty API (jsonb)
  blocks jsonb,

  -- Closed to arrival/departure
  cta boolean,
  ctd boolean,

  -- Multi-unit
  allotment integer,

  last_synced_at bigint not null,

  -- Composite unique constraint
  unique (listing_id, date)
);

create index if not exists idx_calendar_days_listing_date on calendar_days (listing_id, date);
create index if not exists idx_calendar_days_date on calendar_days (date);
create index if not exists idx_calendar_days_listing_status on calendar_days (listing_id, status);
