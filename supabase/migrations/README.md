# Supabase migrations

Source of truth for the **traverse-booking** Supabase schema.

## Layout

```
supabase/
├── config.toml                        # local supabase-cli config
├── _archived_migrations_20260319/     # initial schema (frozen 2026-03-19)
│   ├── 20260225000001_initial_schema.sql       ← canonical starting point
│   ├── 20260226000001_add_beapi_enabled.sql
│   └── ... (12 more)
└── migrations/                        # active migrations folder
    ├── 20260505_sp_plans.sql
    ├── 20260505_sp_pois_and_events.sql
    ├── 20260508_pending_cart_checkouts.sql
    └── README.md                      ← this file
```

`_archived_migrations_20260319/` is the historical record from the
`stay-portland` -> `traverse-booking` rebrand. Treat it as **read-only**.
For any new schema change, add a new file under `supabase/migrations/`
following the convention below.

## Adding a new migration

Naming: `YYYYMMDDHHMMSS_short_description.sql` (Supabase CLI default).
If you don't have minute/second precision handy, `YYYYMMDD_description.sql`
works — the CLI sorts lexicographically.

Template:

```sql
-- supabase/migrations/20260601120000_add_foo_column.sql
-- Why: <one-line explanation of what consumes this change>
-- Rollback: <how to undo if needed>
--
-- All statements MUST be idempotent (IF NOT EXISTS / OR REPLACE / DROP …
-- IF EXISTS) so re-applying the migration on a partially-migrated DB
-- doesn't error. The Supabase CLI tracks applied migrations in the
-- `supabase_migrations.schema_migrations` table, but idempotence
-- defends against hand-applied-via-dashboard-then-committed mix-ups.

ALTER TABLE IF EXISTS public.listings
  ADD COLUMN IF NOT EXISTS foo text;

CREATE INDEX IF NOT EXISTS listings_foo_idx ON public.listings (foo);
```

## Reconciling dashboard SQL back into migrations

If a schema change ships via the Supabase dashboard SQL editor (legitimate
case: an emergency or a `CREATE INDEX CONCURRENTLY` that can't run inside
a transaction), it MUST be backfilled into a committed migration file
within the same session. Otherwise:

- Preview branches diverge from prod schema.
- New devs can't bootstrap a local Supabase from scratch.
- Disaster recovery requires replaying the dashboard history by hand.

Backfill workflow:

```bash
# Pull prod schema into a working tree dump (requires DB credentials).
npx supabase db pull --schema public

# Diff the dump against the last committed migration file. Any new
# CREATE / ALTER / CREATE INDEX statements get hand-edited into a new
# migration file under supabase/migrations/.

# Stage + commit the new file BEFORE the change ships to prod. If the
# change already shipped via dashboard, the new migration file should
# be idempotent (IF NOT EXISTS) so reapplying it on prod is a no-op.
```

## Ghost-table references (audit run 2026-05-27 via Codex #13)

Run `bash scripts/audit-migration-coverage.sh` from the repo root to
re-audit at any time. Current output:

```
[MISSING]  avatars               (storage bucket, not a table — false positive)
[MISSING]  seo_comparison_pages
[MISSING]  seo_event_pages
[MISSING]  seo_neighborhood_pages
[MISSING]  seo_usecase_pages
[MISSING]  sp_blog_posts
[MISSING]  sp_meta_visitors
[MISSING]  sp_plan_leads
[MISSING]  user_events
[MISSING]  visitor_attribution
```

**These tables do NOT exist on prod.** `supabase db pull` was run on
2026-05-27 against the live `traverse-booking` project and the resulting
`20260528022121_remote_schema.sql` did not contain any of them. The
code's `.from("seo_comparison_pages")` (etc.) calls are ghost references
— Portland-era / Stay-Portland leftovers where the table was planned
but never built, OR where the table was dropped during the rebrand and
the call sites weren't cleaned up. Reads silently fail because every
call site wraps the supabase client in `try/catch` and returns empty
results on error (defense-in-depth from Codex #15).

`avatars` is a Supabase Storage bucket (not a Postgres table) — the
audit script can't see Storage buckets, so it's a false positive.

**Recommended cleanup** (out of scope for this README — flagged as
future work):
- grep `.from("seo_comparison_pages")` etc. across `src/`. For each
  hit, either (a) drop the dead code path entirely if the feature was
  never finished, or (b) create the missing table via a new migration
  if the feature is still planned.
- After cleanup, this list should be empty.

## Adding a new table — workflow

If you DO need to add a new table going forward, always write the
migration file FIRST, then run it via the dashboard or `supabase db push`.
That way the file is the source of truth and the audit script stays
clean. Never start from dashboard SQL — backfilling is harder than
forward-flowing.
