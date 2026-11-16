-- token_mint_log — append-only record of SUCCESSFUL Guesty OAuth mints.
--
-- The old refresh-tokens cron counted mint ATTEMPTS via Supabase's
-- check_rate_limit RPC: the counter incremented before the OAuth POST, so
-- any OAuth 429 or network error burned budget without producing a token.
-- Four failed concurrent self-heals exhausted the 4-of-5 local budget while
-- Guesty's own 5/24h quota was untouched, leaving the Supabase token row
-- expired for ~5 days (Nov 7 → Nov 12).
--
-- The new path (behind BEAPI_MINT_V2) only inserts here on a successful
-- mint — the budget check is a SELECT COUNT(*) over the last 24h, so a 429
-- costs nothing and the count matches Guesty's own quota semantic exactly.
--
-- Also an audit trail: `source` records whether the mint came from the
-- scheduled cron or a self-heal-triggered call, so a future flood is
-- attributable to the caller.

create table if not exists public.token_mint_log (
  id         bigserial    primary key,
  token_type text         not null,
  minted_at  timestamptz  not null default now(),
  expires_at timestamptz  not null,
  source     text         not null
);

-- The hot query is "how many mints in the last 24h for this token_type?".
-- The old (token_type, minted_at) composite makes that a cheap index scan.
create index if not exists idx_token_mint_log_recent
  on public.token_mint_log (token_type, minted_at desc);

alter table public.token_mint_log enable row level security;

grant delete, insert, select, update on table public.token_mint_log to anon;
grant delete, insert, select, update on table public.token_mint_log to authenticated;
grant delete, insert, select, update on table public.token_mint_log to service_role;

grant usage, select on sequence public.token_mint_log_id_seq to anon;
grant usage, select on sequence public.token_mint_log_id_seq to authenticated;
grant usage, select on sequence public.token_mint_log_id_seq to service_role;
