# Setup

This is a template for a Guesty direct-booking website built on Next.js +
Supabase + Stripe. It originated as the Stay Portland codebase and has been
stripped of secrets and operational details. Below is what you need to do to
get it running on your own infrastructure.

## 1. Accounts you'll need

- **GitHub** — to host the repo
- **Supabase** — your own project (do NOT reuse the original's)
- **Vercel** — for hosting + cron jobs
- **Guesty** — your own BEAPI app (Guesty admin → Marketplace → Apps →
  Create app, scope: Booking Engine API)
- **Stripe** — to process payments
- **Resend** — for transactional/alert emails
- **Mapbox** — for property maps (free tier is fine to start)
- Optional: Sentry (errors), Klaviyo (email marketing), Meta Pixel + CAPI,
  Google Ads + GA4, Wheelhouse RM

## 2. First-time setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# Then fill in the values from your accounts.

# 3. Set up your Supabase project
# Apply the schema from supabase/_archived_migrations_20260319/ — these are the
# original tables (listings, reservations, guesty_tokens, kv_store,
# pending_checkouts, reviews, visitor_attributions, sp_neighborhood_pages, etc).
# Run them in order against your new Supabase project.

# 4. Run the dev server
npm run dev
# → http://localhost:3000
```

## 3. Branding find/replace

Search and replace the following across the repo:

| Find                  | Replace with                |
| --------------------- | --------------------------- |
| `stayportland.com`    | your domain                 |
| `Stay Portland`       | your brand name             |
| `stay-portland`       | your-brand-slug             |
| `Portland, OR`        | your default search city    |
| `portland`            | your city slug              |

Files with the most brand references:

- `src/middleware.ts` — old domain redirect rules (delete the
  `booking.stayportland.com` redirect block)
- `src/app/sitemap.ts`, `src/app/robots.ts`
- `public/scripts/sp-tracking.js`, `public/scripts/google-analytics-config.js`
- `public/no-fees/index.html`
- `src/lib/seo-content.ts` and any DB-driven SEO content (regenerate in your
  own DB; the original copy is Portland-specific)
- `src/components/home/*` — hero copy
- `src/lib/landing-pages.ts`, `src/lib/neighborhoods.ts` — Portland-specific
  configs

## 4. Things to delete or rewrite

These are Stay Portland-specific and probably won't apply to you:

- `src/app/portland-*` and `src/app/best-places-to-stay-portland/` etc. — the
  static SEO landing pages are all about Portland
- `src/app/portland-recommendations/` — Portland trip planner / recommender
- `src/app/the-pomeroy/` — single-property page for one of our houses
- `src/app/plan/` — itinerary planner (uses external POI data)
- `scripts/seed-pois.ts`, `scripts/seed-region-pois.ts`, `scripts/seed-recommend-topics.ts`,
  `scripts/seed-popular-ideas.ts`, `scripts/seed-favorite-locations.ts`,
  `scripts/seed-plan-templates.ts`, `scripts/backfill-poi-photos.ts`,
  `scripts/audit-pois-closures.mjs`, `scripts/inspect-poi-neighborhoods.ts`,
  `scripts/verify-neighborhood-match.ts` — POI/itinerary stuff
- `scripts/cleanup-test-reservations.ts` — uses Stay Portland test emails
- `scripts/sp_meta_visitors.sql`, `scripts/sp_plans*` — Stay Portland specific
- `src/lib/checkout-finalizer.ts` lines 137-144 (`KNOWN_TEST_EMAILS`) —
  replace with your own test emails so test bookings don't pollute analytics
- `supabase/functions/sync-website-reservations/index.ts` and
  `sync-reservations-v2/index.ts` — test email allowlists at the top
- `vercel.json` cron schedule for `/api/wheelhouse/sync` — only needed if you
  use Wheelhouse Revenue Management

## 5. The Guesty BEAPI integration

The booking flow in `src/lib/guesty-beapi.ts` and `src/lib/guesty-openapi.ts`
expects:

- A row in `guesty_tokens` table with `token_type='beapi'` and the OAuth
  access token
- Tokens are refreshed by the edge function in
  `supabase/functions/refresh-tokens/` (deploy this and schedule it via pg_cron)

⚠️ **Guesty rate limits** are hard:

- BEAPI: 5/sec, 275/min, 16,500/hr (per token)
- OpenAPI: 15/sec, 120/min, 5,000/hr (per token)
- OAuth tokens: **5 per 24 hours** — if you burn this you are LOCKED OUT for
  24 hours

`guesty-beapi.ts` is read-only against `guesty_tokens` to prevent accidental
token refresh storms. Don't change that.

## 6. Deploy

```bash
# Push to GitHub (after `git init` etc.)
# Then connect the repo to Vercel and add all env vars from .env.example.
# Vercel will run the build + the crons defined in vercel.json.
```

The crons require `CRON_SECRET` to match what Vercel sends in the
`Authorization: Bearer ...` header. Set `CRON_SECRET` to a random string in
Vercel project settings.

## 7. Things that were intentionally removed

If you find something looks half-stubbed, here's what was scrubbed from this
template (and why):

- `src/lib/alerts.ts` — used to talk to a "dashboard" Supabase project to
  enrich alerts with listing nicknames + YoY rate comparisons. Now disabled
  unless `DASHBOARD_SUPABASE_URL` + `DASHBOARD_SUPABASE_ANON_KEY` are set.
  You probably don't need this — the alerts work fine without it.
- All hardcoded `vbpxjiisorztbbinenpb.supabase.co` in CSP / image domains —
  these are now derived from your `NEXT_PUBLIC_SUPABASE_URL` env var
- `ALERT_TO`, `ALERT_FROM`, listing-inquiry recipients are env-driven now
- Internal docs (runbooks, plans), historical reports, and CLAUDE.md were
  removed — they were full of operational notes that don't apply to your
  business

Good luck.
