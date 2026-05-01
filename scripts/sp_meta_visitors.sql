-- sp_meta_visitors: cross-session Meta identifier persistence
--
-- Why this exists:
--   Cookies (_fbp, _fbc, _sp_visitor_id) are the primary store. This table is
--   the fallback when a returning visitor has their _fbp/_fbc cookies cleared
--   but still carries the long-lived _sp_visitor_id (1yr). On the next CAPI
--   fire we can rehydrate fbp/fbc from this row instead of treating them as
--   a brand-new visitor and minting a fresh fbp.
--
--   Once the guest provides an email (booking, login, inquiry), we hash and
--   store it. That's the join key Meta's user graph uses for cross-device
--   stitching, and it's how lookalike audiences trained on past customers
--   pick up the same person on a different device.
--
-- Write path:
--   src/lib/server-tracking.ts → sendMetaEvent() fires upsertMetaVisitor()
--   after every CAPI event. Fire-and-forget; failures log but don't block.
--
-- Read path:
--   src/lib/meta-visitor-store.ts → lookupMetaVisitor(visitorId)
--   Currently exported but not yet wired into track-request.ts. Wire it in
--   when you want server-side fallback for users who clear _fbp/_fbc but
--   keep _sp_visitor_id.

create table if not exists public.sp_meta_visitors (
  visitor_id uuid primary key,
  fbp text,
  fbc text,
  fbclid text,
  fbclid_ts bigint,
  email_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Index for email-hash lookup (cross-device stitching when same person
-- books from a new browser/device). Partial index keeps it small.
create index if not exists sp_meta_visitors_email_hash_idx
  on public.sp_meta_visitors (email_hash)
  where email_hash is not null;

-- Index for last-seen sorting (analytics on active visitors, retention cuts).
create index if not exists sp_meta_visitors_last_seen_idx
  on public.sp_meta_visitors (last_seen_at desc);

-- No RLS: writes come from the service-role client (supabase-admin.ts).
-- Reads are server-only. If you ever expose this to anon clients, add RLS
-- with `using (false)` and only allow access via a SECURITY DEFINER function.
alter table public.sp_meta_visitors enable row level security;

comment on table public.sp_meta_visitors is
  'Server-side fallback for Meta browser identifiers (_fbp, _fbc, fbclid). '
  'Keyed by the SP-controlled visitor UUID. Rehydrates ad-blocker users and '
  'users who cleared cookies but kept _sp_visitor_id.';
