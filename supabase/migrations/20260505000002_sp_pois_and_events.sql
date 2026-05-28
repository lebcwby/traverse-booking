-- sp_pois + sp_events for /plan
-- sp_pois schema mirrors src/lib/pois/types.ts PoiRow
-- sp_events is new; powers date-aware "happening during your stay" surfaces

create table if not exists public.sp_pois (
  id text primary key,
  name text not null,
  category text not null check (category in (
    'restaurant','coffee','bar','park','shop','museum',
    'viewpoint','activity','food_cart_pod','transit'
  )),
  neighborhood text not null,
  description text not null,
  address text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  tags text[] not null default '{}',
  time_slots text[] not null default '{}',
  party_types text[] not null default '{}',
  price_level int,
  hours_summary text,
  photo_url text,
  source_url text,
  source_guide_slug text,
  status text not null default 'active' check (status in ('active','closed','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sp_pois_neighborhood_idx on public.sp_pois (neighborhood);
create index if not exists sp_pois_category_idx on public.sp_pois (category);
create index if not exists sp_pois_status_idx on public.sp_pois (status);
create index if not exists sp_pois_tags_gin on public.sp_pois using gin (tags);
create index if not exists sp_pois_geo_idx on public.sp_pois (lat, lng);

-- sp_events: date-aware events that overlap a guest's stay.
--
-- date_kind = 'fixed': use start_date + end_date directly (specific 2026 dates)
-- date_kind = 'recurring': use recurring_rule_text (e.g. "first weekend of August")
--   for surfacing as "annual event around this time" when 2026 dates aren't yet known
create table if not exists public.sp_events (
  id text primary key,
  name text not null,
  town text not null check (town in ('Crested Butte','Leadville','Twin Lakes','Vail','Avon','Granby')),
  blurb text not null,
  category text not null check (category in (
    'festival','race','music','nature','culture','seasonal','sport'
  )),
  date_kind text not null check (date_kind in ('fixed','recurring')),
  start_date date,
  end_date date,
  recurring_rule_text text,
  official_url text,
  poi_id text references public.sp_pois(id),
  status text not null default 'active' check (status in ('active','cancelled','draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sp_events_town_idx on public.sp_events (town);
create index if not exists sp_events_dates_idx on public.sp_events (start_date, end_date);
create index if not exists sp_events_status_idx on public.sp_events (status);
