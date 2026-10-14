-- Applied to the booking DB (xmnxntlpqfoshdmlvyov) on 2026-10-14 as migration
-- `create_guesty_rate_limit_events`. Kept here so the schema is in the repo.
--
-- ⚠️ A new table is invisible to PostgREST until its schema cache reloads.
-- Supabase's automatic reload did NOT pick up sp_meta_visitors earlier the
-- same day and every write failed with "Could not find the table ... in the
-- schema cache". After applying, run:
--     notify pgrst, 'reload schema';
--
-- Why this table exists: see src/lib/guesty-rate-limit-events.ts.

create table if not exists public.guesty_rate_limit_events (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  surface text not null default 'beapi',
  path text,
  alerted boolean not null default false
);

create index if not exists guesty_rate_limit_events_occurred_idx
  on public.guesty_rate_limit_events (occurred_at desc);

-- Service-role only, same posture as calendar_days and sp_meta_visitors.
alter table public.guesty_rate_limit_events enable row level security;

comment on table public.guesty_rate_limit_events is
  'Terminal Guesty 429s with timestamps. Guesty rate-limits per ACCOUNT, so a burst here may be caused by another integration (CRM, PriceLabs) rather than this site. Query minute-of-hour clustering to tell them apart.';

-- The diagnostic query the alert email points at:
--
--   select date_trunc('hour', occurred_at) as hour,
--          (extract(minute from occurred_at)::int / 10) * 10 as minute_bucket,
--          count(*)
--   from guesty_rate_limit_events
--   where occurred_at > now() - interval '7 days'
--   group by 1, 2 order by 1 desc, 2;
