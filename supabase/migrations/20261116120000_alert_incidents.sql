-- alert_incidents — durable, atomic dedup for sendAlert().
--
-- Replaces the in-memory `alertCooldowns` map plus the kv_store check-then-set
-- in src/lib/alerts.ts. The old pattern read in-memory, then Supabase, then
-- sent, then wrote the cooldown row: N concurrent callers from N serverless
-- instances all cleared the check before any of them wrote, and all N
-- emails went out. Four "CRITICAL: BEAPI token unavailable" emails arrived
-- in the same second on 2026-11-10 07:14:49Z that way.
--
-- The new helper claimAlert() does one SQL round-trip:
--
--   INSERT INTO alert_incidents … VALUES ($1, now(), now(), 1)
--   ON CONFLICT (key) DO UPDATE SET …
--    WHERE …cadence predicate…
--   RETURNING (xmax = 0) AS is_new, reminder_count;
--
-- When the ON CONFLICT path's WHERE is false (we're still inside the cadence
-- window), the UPDATE is skipped and the RETURNING clause yields zero rows —
-- the claim failed, don't send. Exactly one concurrent caller wins per cadence
-- tick.
--
-- Row lifecycle:
--   * First call for a key: INSERT, reminder_count=1, first_sent_at=now, resolved_at=null.
--   * Each later claim that passes the cadence gate: UPDATE, reminder_count++.
--   * resolveAlertIncident(key) sets resolved_at. The next claim re-opens the
--     row (reminder_count resets to 1, first_sent_at=now).

create table if not exists public.alert_incidents (
  key            text primary key,
  first_sent_at  timestamptz not null,
  last_sent_at   timestamptz not null,
  reminder_count integer     not null default 1,
  resolved_at    timestamptz null
);

-- The incident-digest cron reads unresolved rows ordered by first_sent_at.
-- Partial index keeps it narrow — resolved rows don't belong in the tail.
create index if not exists idx_alert_incidents_unresolved
  on public.alert_incidents (first_sent_at)
  where resolved_at is null;

alter table public.alert_incidents enable row level security;

-- Follow kv_store's grant pattern so service-role + anon/authenticated via
-- Supabase client behave the same. The pg Pool connects as the `postgres`
-- role (bypasses RLS). Service-role bypasses RLS. No public policy — anon
-- access is theoretical only.
grant delete, insert, select, update on table public.alert_incidents to anon;
grant delete, insert, select, update on table public.alert_incidents to authenticated;
grant delete, insert, select, update on table public.alert_incidents to service_role;
