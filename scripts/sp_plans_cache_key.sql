-- scripts/sp_plans_cache_key.sql
-- Adds a cache_key column to sp_plans to support the template-prefill flow.
-- Applied against the shared DB (eetqqpmtntncprcqbqbw) via
-- scripts/sp_plans_cache_key.ts.
--
-- A cache_key is a short string that identifies the combination of user
-- preferences that produced a plan (e.g. "food:long-weekend"). When a visitor
-- clicks a vibe+duration chip pair, /api/plan/from-template looks up the most
-- recent sp_plans row with the matching cache_key younger than 7 days, clones
-- its messages into a new anonymous plan, and redirects the visitor — so they
-- see the itinerary instantly instead of waiting for the agent to re-run.

alter table public.sp_plans
  add column if not exists cache_key text;

create index if not exists sp_plans_cache_key_recent_idx
  on public.sp_plans (cache_key, updated_at desc)
  where cache_key is not null;
