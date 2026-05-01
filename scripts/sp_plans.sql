-- scripts/sp_plans.sql
-- One-off DDL for the trip planner persistence table.
-- Applied against the shared DB (eetqqpmtntncprcqbqbw) via scripts/sp_plans.ts.
-- Not part of the supabase/migrations tree — the canonical migration home for
-- this project is unresolved; this file is the source of truth for now.

create extension if not exists pgcrypto;

create table if not exists public.sp_plans (
  id uuid primary key default gen_random_uuid(),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now()
);

create index if not exists sp_plans_last_viewed_at_idx
  on public.sp_plans (last_viewed_at desc);
