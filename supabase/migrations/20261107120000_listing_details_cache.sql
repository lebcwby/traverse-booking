-- Postgres cache for BEAPI listing detail, so rendering a listing page costs
-- Guesty nothing.
--
-- ── Why ─────────────────────────────────────────────────────────────────
--
-- Of 4,243 terminal Guesty 429s in the 30 days to 2026-11-07, 96.8% were
-- `/api/listings/{id}` — the BEAPI listing-detail call. Not a cron: in every
-- burst the event count almost exactly equalled the number of DISTINCT
-- listings (36/36, and one minute with 105), and the burst times were
-- scattered rather than aligned to any schedule. That is something walking
-- the catalogue.
--
-- /properties/[id] already runs ISR at revalidate=3600, and it works —
-- a cold request returns `x-vercel-cache: STALE`, the next is a `HIT`. That
-- is exactly the trap. With a one-hour TTL across 208 listings, a crawler
-- sweeping the catalogue finds EVERY page stale at once, each stale hit
-- kicks off a background revalidation, and each revalidation spends one
-- BEAPI call. A two-minute sweep therefore becomes ~100 BEAPI calls a minute
-- against a ~120/min ceiling shared with the CRM, PriceLabs and Conduit.
--
-- Lengthening the TTL only moves the herd. Taking Guesty out of the render
-- path removes it: page renders read this table, and a paced cron is the
-- only thing that talks to BEAPI. Same shape as `calendar_days`, which
-- already makes the whole agent API and MCP server free.
--
-- ── Why the whole payload, not columns ──────────────────────────────────
--
-- `listings` is the Open API mirror and already holds the scalar fields.
-- What the page needs from BEAPI and cannot get there is the awkward stuff:
-- the full `pictures` array, `publicDescription`, `bedArrangements`,
-- `unitTypeHouseRules`, `terms`. Storing the response as jsonb keeps this a
-- cache rather than a second schema to keep in sync — nothing here is a
-- source of truth, and a wrong guess about shape costs a refresh, not data.
--
-- ── fields is not decoration ────────────────────────────────────────────
--
-- getListingDetail() asks BEAPI for a specific `fields` list. If someone adds
-- a field there, every cached row is silently missing it and the page quietly
-- renders without it — no error, no alert, until someone notices a blank
-- section. Storing the field list the row was fetched with lets the reader
-- detect that and refetch. See listing-detail-cache.ts.
create table if not exists public.listing_details (
  listing_id   text primary key,
  payload      jsonb       not null,
  fields       text        not null,
  fetched_at   timestamptz not null default now()
);

-- The cron refreshes stalest-first, so this is the ordering it reads by.
create index if not exists listing_details_fetched_at_idx
  on public.listing_details (fetched_at);

-- Server-side only: every reader goes through the service role, same as
-- `calendar_days`. No policy is defined, so RLS denies everything else —
-- which is the intent, not an oversight (see
-- feedback_rls_insert_policy_required: a table with RLS on and no policy
-- denies silently, so this must stay service-role only).
alter table public.listing_details enable row level security;
