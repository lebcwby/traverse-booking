-- sp_plans: stores generated trip plans (full UIMessage[] history) keyed by uuid.
-- cache_key is set on pre-seeded "Popular trip idea" templates so the
-- /api/plan/from-template route can clone the most recent matching template.

create table if not exists public.sp_plans (
  id uuid primary key default gen_random_uuid(),
  messages jsonb not null,
  cache_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create index if not exists sp_plans_cache_key_idx on public.sp_plans (cache_key, created_at desc) where cache_key is not null;
create index if not exists sp_plans_updated_at_idx on public.sp_plans (updated_at desc);
