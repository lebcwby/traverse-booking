# Traverse Hospitality Direct Booking Site — CLAUDE.md

This file gives Claude Code everything it needs to continue work on this project. Place it at the repo root: `~/guesty direct booking website/guesty-direct-booking-template-main/CLAUDE.md`.

---

## Project Snapshot

- **Company:** Traverse Hospitality (formerly High Rocky Homes, rebranded 2024)
- **Site goal:** Direct booking site — **live at booktraverse.com since 2026-05-10**
- **Stack:** Next.js 16.2.0 + Turbopack, React 19.2, Supabase, Stripe, Guesty BEAPI, Sentry
- **Hosting:** Vercel (Pro plan), project name `traverse-booking`, team `nadim-traversehosp`
- **Repo:** https://github.com/lebcwby/traverse-booking (branch: `main`)
- **Local path:** `~/guesty direct booking website/guesty-direct-booking-template-main`
- **Production:** https://www.booktraverse.com (aliased; also `https://traverse-booking.vercel.app`)
- **Portfolio:** 189 active listings across 6 Colorado markets — Crested Butte, Leadville, Vail, Avon, Granby, Twin Lakes
- **Leadership:** Alex Haler (CEO), Nadim Tannous (CTO), Sabrina Colella (COO)

---

## 🚨 OPEN INCIDENT (2026-05-20) — Read this first

**~185 Guesty listings had their `customFields` array wiped** at ~15:30 MT
on 2026-05-20 when `/api/admin/sync-urls-to-guesty` ran with the wrong
update semantics. The Book Direct Link field itself was correctly updated;
all OTHER customFields on those listings (welcome messages, Google review
links, phone numbers, unit numbers, door codes, owner bios, etc.) were
replaced with an empty array.

**Status:** Guesty support contacted; awaiting restoration from backup.
Full details + recovery plan in `docs/incidents/2026-05-20-customfields-wipe.md`.
Affected listings list in `docs/incidents/affected-listings.csv`.

**🛑 DO NOT** run `/api/admin/sync-urls-to-guesty` again until both:
1. Guesty restores the customFields from backup, AND
2. The `patchListingCustomField` function in
   `src/app/api/admin/sync-urls-to-guesty/route.ts` is patched to use
   read-modify-write semantics (GET listing, merge customFields, PUT).
   Pseudocode is in the incident doc.

The site itself is fine — this is purely a Guesty-internal data issue.

---

## Current State (as of 2026-05-10, end of session 4)

**The site is live.** DNS cutover to booktraverse.com completed 2026-05-10. Apple Pay auto-verified for `www.booktraverse.com`. Stripe webhook verified. Klaviyo is in live mode.

### What shipped in session 4

- **DNS cutover** — GoDaddy A records updated: `booktraverse.com` + `www.booktraverse.com` → `76.76.21.21`. Vercel SSL auto-provisioned. Apex 308-redirects to www.
- **GA4 tracking fully wired** — All funnel events (view_item, begin_checkout, add_to_cart, purchase, view_item_list) route to G-8NK72KVMJJ (the "Book Traverse" property). G-C5098JP52V (formerly assumed canonical) turned out to be broken on Google's gtag CDN — `googletagmanager.com/gtag/js?id=G-C5098JP52V` returns **404**, so client-side `gtag('event', …)` calls were silently dropped the whole time even though the GA4 admin shows the stream as "active". Switched canonical to G-8NK72KVMJJ on 2026-05-13.
- **listingNickname in GA4 ecommerce** — `item_variant` field on all 6 GA4 ecommerce events + server-side purchase. Threaded through: tracking.ts, server-tracking.ts, pending-checkouts.ts, quote-response.ts, checkout-form.tsx, book/[quoteId]/page.tsx, confirmation session, track-confirmation.tsx, add-to-cart-button.tsx, track-properties-list.tsx, payment-intent/route.ts, checkout-finalizer.ts. GA4 Ecommerce purchases report will show listing nicknames in "Item variant" column ~48h after events fire.
- **Conduit chat widget removed** — 6 component files deleted, all CSP entries removed from both next.config.ts and csp.ts. Mobile "Help" tab replaced with "Call" tel: link. Checkout "Need help?" buttons replaced with tel: links.
- **Per-listing pet fee from BEAPI** — `resolveUpsellsForListing()` fetches `prices.petFee` and `unitTypeHouseRules.houseRules.petsAllowed.enabled` from BEAPI per listing. Pet Fee upsell hidden on no-pet listings. `petFeePerPet` stored in Stripe PI metadata so checkout-finalizer doesn't need extra API call.
- **Stripe webhook** — `booktraverse.com — production` webhook wired. API version updated to `2026-04-22.dahlia`. Signing secret: `STRIPE_WEBHOOK_SECRET=whsec_UJYKJk2eMXLtgBmV8nv5Ygu4q5cXOvIZ` (in Vercel prod).
- **Apple Pay** — already enabled on Stripe account. `www.booktraverse.com` auto-verified as Apple Pay domain.
- **Transparent white logo** — `public/no-fees/logo-white.png` + `logo-white.webp` regenerated using Sharp pixel-level manipulation: all non-transparent pixels set to white (255,255,255), alpha channel preserved. Output: 2048×492 RGBA PNG.
- **CSP fix for /plan POI images** — `https://places.googleapis.com` added to IMG_SOURCES in both `src/lib/csp.ts` and `next.config.ts`.
- **Sitemap fixed** — `public/sitemap.xml` recreated as static index pointing to Next.js-generated `/sitemap/[id].xml` segments. Next.js `generateSitemaps()` doesn't auto-generate a sitemap index.
- **Schema.org** — Organization schema on homepage: `logo`, `image`, B2B phone `+1-970-533-3583`, hero stats 189+.
- **/plan polish** — Hero image changed to Colorado (not Portland skyline). Refinement chips, ANCHOR_OPTIONS, QUICK_REFINES all Colorado-ized. OG image blue (not gold). plan/[id]/page.tsx: "Your Colorado Trip".
- **Klaviyo abandoned-cart flow** — Templates created: "Abandoned Cart — Single Listing" (ID: Shfpc4) and "Abandoned Cart — 24h Follow-up" (ID: SdNCVn). Metrics: Started Checkout (V4D6NT), Added to Cart (Tgddiq), Booked Reservation. Flow is in Draft — confirm activation with Nadim.
- **llms.txt + llms-full.txt** — Rewritten from Stay Portland → Traverse Hospitality.

### Fixed in session 5

- **Klaviyo company ID** — `consent-manager.tsx` had `T4kwLc` (Stay Portland's account) hardcoded as the fallback. All browser-side Klaviyo events (Started Checkout, Added to Cart, Viewed Listing) were going to Stay Portland's Klaviyo, not Traverse. Fixed: fallback updated to `UMUgtM` (Traverse), `NEXT_PUBLIC_KLAVIYO_COMPANY_ID=UMUgtM` added to Vercel. Deployed with `--force`.
- **GA4 canonical property (as of 2026-05-13)** — `G-8NK72KVMJJ` is now the canonical property receiving all ecommerce events. `G-C5098JP52V` (formerly assumed canonical, has WordPress historical purchase data) is preserved untouched for historical reporting only — its gtag.js CDN is permanently 404, so client-side custom events never actually reached it (page_view appeared only because GTM routes its own events directly to /g/collect, bypassing gtag.js). `G-MLNYK6YLXK` is the old highrockyhomes.com property (currently still linked to Google Ads — needs re-linking to G-8NK72KVMJJ).

### Known issues (as of end of session 4)

1. **Sign-in 400 error (HIGH PRIORITY)** — After DNS cutover, Supabase auth still only whitelists `traverse-booking.vercel.app`. Magic link and OAuth redirects to `booktraverse.com/auth/callback` return 400.  
   **Fix**: Go to [Supabase Dashboard](https://supabase.com) → Authentication → URL Configuration:
   - **Site URL** → `https://www.booktraverse.com`
   - **Redirect URLs** → add `https://www.booktraverse.com/**`  
   This unblocks: magic link login, Google OAuth, and wishlist sign-in dialog.

2. **OG meta "Stay Portland" in link previews** — This is social platform caching from when booktraverse.com pointed to WordPress. The actual og:image, og:title, og:description served by the Next.js site are all correct. Social caches expire automatically (Facebook: use https://developers.facebook.com/tools/debug/ to force re-scrape).

3. **GA4 Ecommerce purchases report — 48h lag** — item_variant data was just deployed. Check 2026-05-12 at 11:00 AM Mountain (scheduled routine will fire then).

4. **Klaviyo abandoned-cart flow — LIVE and sending (verified 2026-05-31).** Flow "Abandoned Cart — Single Listing" (`Xpdwza`) is live; last 30d: 16 recipients, 14 delivered, 57% open, but 0 clicks/conversions. It reaches only ~26% of "Started Checkout" events (62→16) because the rest are anonymous (guest left before entering a usable email) or non-marketing-consented — inherent to abandoned-cart. Open improvements: (a) **add the 2nd-touch email** (template `SdNCVn`, already built + on-brand) as a delayed message in the flow — UI-only, Klaviyo API can't edit flow structure; (b) checkout page now offers expired-quote recovery via `lid/ci/co/g` params on the Started-Checkout URL (shipped 2026-05-31) so late email clicks re-quote instead of dead-ending; (c) capture email earlier to lift reach.

5. **Stripe is LIVE (corrected 2026-06-24).** Prod is processing real charges — confirmed `livemode: true` on real PaymentIntents (e.g. GY-CvXxRDxw, two $361.63 charges 2026-05-31). Prod `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are **live keys** (`.env.local` still holds `sk_test`/`pk_test` — local is test, prod is live; don't assume local == prod). The earlier "still in test mode" note was stale. `project_traverse_stripe_live_mode.md` is now history, not a TODO.

6. **GA4 historical property preserved** — G-C5098JP52V (formerly assumed canonical) is kept untouched as a read-only archive of WordPress-era purchase data. Do **not** retry routing events to it — its gtag.js CDN returns 404 and we don't know why. New tracking flows to G-8NK72KVMJJ. See memory `project_traverse_ga4_duplicate_property.md` for the full history.

7. **GA4 server-side `purchase` tracking — VERIFIED HEALTHY 2026-05-30; report-lag is the usual culprit.** Symptom: a confirmed+paid BE-API booking (e.g. GY-XaH3sK9M) doesn't show in the G-8NK72KVMJJ *Ecommerce purchases* report same-day. **Tracking infra is fine** — `/api/admin/inspect-ga4?fire=true` returned measurementId G-8NK72KVMJJ + secret fingerprint `zY…_Q` (len 22, this is the PROD secret; the `mK…qA` in `.env.local` is a stale LOCAL value tied to the old property — ignore it) + liveFireStatus 204, and the `TEST-GA4-INSPECT` purchase **landed in G-8NK72KVMJJ Realtime**. So the MP secret↔property pairing is valid and server purchases deliver. The earlier "secret minted under old property" theory is DISPROVEN. Likely reasons a given booking looks missing: (a) GA4 *standard* Ecommerce report lags 24–48h — verify by searching the next-day report for `transaction_id = <confirmation code>`, not by glancing at "today"; (b) the guest declined **analytics** consent (server GA4 `purchase` is gated on `consent.analytics !== false` in server-tracking.ts ~L858) — a structural gap for the decline subset, not a config bug. NOTE: single-listing `pending_checkouts` rows are **deleted on completion** (cart rows in `pending_cart_checkouts` are retained), and the finalizer rebuilds `tracking` from `quoteContext.trackingDefaults`, so a missing pending row does NOT block the purchase event. The prior GY-zBMnaYA8/GY-dmwm6uVF misses (2026-05-23) were the fire-and-forget lambda-freeze bug, since fixed (finalizer now `await`s `trackBookingServerSide`). Runbook: `docs/runbooks/ga4-server-purchase-fix.md`.

---

## Open work (priority order)

### Immediate (next session)

1. **Fix Supabase auth URLs** (5 min) — See "Known issues #1" above. This unblocks sign-in everywhere on booktraverse.com.
2. **Activate Klaviyo abandoned-cart flow** — After Supabase fix, flip Draft → Live in Klaviyo flow builder.
3. ~~Switch Stripe to live mode~~ — **DONE.** Prod is live and processing real charges (see Known issues #5).

### P2 polish

- **Owner testimonials** — Real quotes pending from Nadim. Placeholder cards on `/property-management` `reviews` array. Memory: `project_traverse_owner_reviews_pending.md`.
- **Booking confirmation emails** — `RESEND_API_KEY` **is set in Vercel prod** (confirmed via `vercel env ls`, added ~2026-05; corrects the old "needed" note). `sendAlert` ops emails deliver. If confirmation emails still don't arrive, check key *validity*, not presence. See memory `reference_resend_setup.md`.
- **Re-seed `sp_plans` cache** — Run `npx tsx --env-file=.env.local scripts/seed-popular-ideas.ts`. Requires `ANTHROPIC_API_KEY` in `.env.local` (not yet added). Without this, "Instant" popular-trip cards fall through to live agent (~15s) instead of cached templates (~200ms).
- ~~**`src/lib/plan/slug-content.ts`**~~ — **DONE (2026-07-14).** All 5 routed `/plan/<slug>` bodies now have Colorado long-form copy + 5 FAQs each (render visibly + as FAQPage JSON-LD). Was an empty map post-rebrand. Venue names should get a periodic open/closed spot-check (see `project_traverse_crested_butte_businesses_status`).
- **`src/lib/plan/favorites.ts`** — Intentionally **empty** (`FAVORITES = []`) since the Portland POIs were stripped 2026-05-26; plan works fine without favorite-anchoring. Not a cleanup task — optionally add Colorado local-pick entries later if we want favorite-anchored recs.

### P3 deferred

- **Photo category navigation** — Airbnb-style room tabs on property gallery. Needs AI vision since Guesty BEAPI doesn't expose room metadata. See memory `project_traverse_photo_categorization.md`.
- **Google Places API key restriction** — Currently unrestricted key embedded in 75 POI photo URLs. Restrict in Cloud Console: HTTP referrer `https://www.booktraverse.com/*` + restrict to Places API. See memory `project_traverse_plan_seed.md`.
- **Quarterly portfolio refresh** — Next run: 2026-08-01. See memory `project_traverse_quarterly_refresh.md`.
- **Google Ads ↔ GA4 re-linking** — Google Ads (`AW-16519101211`) is still linked to `G-MLNYK6YLXK` (old highrockyhomes.com property). Re-link to `G-8NK72KVMJJ` so conversions and audiences from booktraverse.com traffic land in the active property. GA4 → Admin → Product links → Google Ads links.
- **GTM container re-pointing** — GTM `GTM-WMD2QJS6` GA4 Configuration tag likely still set to `G-C5098JP52V`. Update it to `G-8NK72KVMJJ` so GTM-mediated events (page_view, etc.) land in the same property as direct gtag events. Otherwise split reporting.
- **Sentry source maps** — `SENTRY_AUTH_TOKEN` still not set. Build suppresses the error but source maps aren't uploaded.

### Traverse CRM (separate repo)
- Session left off at Phase 1.4.2 merged + PR #8 (Phase 1.4.4) + PR #9 (status fix) open.
- Continuation brief: `/Users/Nadim/traverse-CRM/SESSION_CONTINUATION.md`
- UX followups flagged: locked-task gating explanation + inline task complete affordance.
- Reviews sync: CRM owns the reviews table. Zero rows currently.

---

## Architecture Reference

### Key Components and Files

```
src/
├── app/
│   ├── page.tsx                          # Custom Traverse homepage (Organization schema, og metadata)
│   ├── properties/[id]/page.tsx          # Property detail page; extracts nickname → TrackViewedListing
│   ├── book/[quoteId]/page.tsx           # Checkout page; extracts listingNickname → trackStartedCheckout
│   ├── book/confirmation/[reservationId]/
│   │   ├── track-confirmation.tsx        # Fires trackBookingCompleted with listingNickname
│   │   └── lib/confirmation-session.ts   # ConfirmationSession type includes listingNickname
│   ├── auth/callback/route.ts            # Supabase auth callback; Klaviyo Created Account event
│   ├── login/page.tsx                    # Full sign-in page (magic-link, sign-in, sign-up, forgot-pw)
│   ├── plan/[id]/page.tsx                # Trip plan page: "Your Colorado Trip"
│   ├── property-management/page.tsx      # Owner landing page; HubSpot form; B2B phone; testimonials
│   └── api/
│       ├── payment-intent/route.ts       # Per-listing pet fee via BEAPI; petFeePerPet in PI metadata
│       ├── stripe/webhook/route.ts       # HMAC-SHA256 validation; routes to checkout-finalizer
│       └── cron/refresh-tokens/route.ts  # Every 2h — refreshes BEAPI + OpenAPI tokens
│                                          # Also callable from getBEAPIToken() as
│                                          # in-app self-heal (throttled 1×/5min/instance)
├── components/
│   ├── no-fees/
│   │   ├── no-fees-header.tsx            # Rich nav; phoneOverride prop for B2B page
│   │   └── no-fees-hero-section.tsx      # JSX hero with embedded search + Get Directions
│   ├── booking/
│   │   ├── checkout-form.tsx             # trackBookingCompleted with listingNickname
│   │   ├── upsells.ts                    # resolveUpsellsForListing(); resolvePetFeePerPet()
│   │   └── upsell-selector.tsx           # Accepts upsells?: UpsellItem[] prop
│   ├── cart/add-to-cart-button.tsx       # Passes listingNickname to trackAddToCart
│   ├── properties/track-properties-list.tsx  # Passes nickname to trackViewedListingList
│   └── wishlist-button.tsx               # Login dialog for wishlist; uses Supabase auth
└── lib/
    ├── tracking.ts                       # All GA4/Meta/Klaviyo events; item_variant = listingNickname
    ├── server-tracking.ts                # Server-side GA4 purchase event; item_variant = listingNickname
    ├── pending-checkouts.ts              # PendingTracking includes listingNickname; DB try-catch wrapped
    ├── checkout-finalizer.ts             # Reads petFeePerPet from PI metadata; listingNickname tracking
    ├── booking-identity.ts               # buildStayKey, buildGuestIdentityKey, buildBookingFingerprint
    ├── quote-response.ts                 # buildNormalizedQuoteResponse: listingNickname from BEAPI
    ├── csp.ts                            # IMG_SOURCES includes places.googleapis.com
    └── plan/
        ├── system-prompt.ts              # CO-aware agent: 6 markets, altitude, events, neighborhood slugs
        ├── events.ts                     # getEventsForStay() → EVENTS_OVERLAPPING prompt block
        └── poi-preload.ts                # detectTown() + detectVibe() — Colorado-mapped
```

### GA4 Tracking Map

| Event | When | item_variant |
|---|---|---|
| `view_item_list` | Properties list page load | listing.nickname |
| `view_item` | Property detail page load | listing.nickname |
| `add_to_cart` | "Book Now" / add-to-cart click | listingNickname |
| `begin_checkout` | /book/[quoteId] page load | listingNickname |
| `add_payment_info` | Stripe card field entered | listingNickname |
| `purchase` (client) | trackBookingCompleted | listingNickname |
| `purchase` (server) | trackBookingServerSide | listingNickname |

GA4 property: **G-8NK72KVMJJ** (canonical as of 2026-05-13; receives all client-side gtag events).
G-C5098JP52V: read-only archive — has historical WordPress purchase data, but its gtag.js CDN returns 404 so events never reached it client-side. Preserve, do not route new events here.
G-MLNYK6YLXK: old highrockyhomes.com property — still linked to Google Ads; needs re-linking to G-8NK72KVMJJ.

### Klaviyo

- **Newsletter list**: S9Ezba (canonical). `KLAVIYO_PRIVATE_KEY` set in Vercel.
- **Abandoned-cart metrics**: Started Checkout (V4D6NT), Added to Cart (Tgddiq), Booked Reservation.
- **Abandoned-cart flow**: Created; Draft status. Activate after Supabase URL fix.
- **Email templates**: Shfpc4 (first email), SdNCVn (24h follow-up).

### Guesty BEAPI Tags (CORRECT VALUES)

| Building / Category | Real BEAPI tag |
|---|---|
| Grand Lodge Crested Butte | `The Grand Lodge Crested Butte` |
| The Plaza Condominiums | `The Plaza Crested Butte` |
| Lodge at Mountaineer Square | `The Lodge at Mountaineer Square` |
| Grand West Village (Leadville) | `Grand West Village Resort` |
| Old St Vincent's (Leadville) | `OSV` |
| Cabin Rentals | `cabin` |

Cities require BOTH params: `city=Crested Butte&country=United States`

### Building Facts (verified)

- **Grand Lodge** — 6 Emmons Loop, Mt. CB 81225. ~226 units, 50+ Traverse. Pool (indoor/outdoor), hot tub, steam room. Pets: select units. Free parking. Starts $95/night.
- **Lodge at Mountaineer Square** — 620 Gothic Road, Mt. CB 81225. ~133 units, 11 Traverse. HAS front desk. HAS A/C. Pool, hot tub, sauna, steam room, fitness center. Heated underground parking (paid). NO pets.
- **The Plaza** — 11 Snowmass Road, Mt. CB 81225. ~20 units, 13 Traverse. NO front desk. Hot tubs, sauna, steam room. Tennis/pickleball. NO pool. NO A/C. NO pets. Free covered parking.

---

### Listings table (Supabase mirror) & sync — IMPORTANT

The Supabase `listings` table is a **BEAPI-sourced mirror of the bookable
catalog**, populated nightly by `/api/cron/sync-listings` (`0 9 * * *` UTC).
As of 2026-06-08 it holds ~186 rows.

⚠️ **Correcting prior docs/comments:** older code comments said the table was
"empty by design." That was the *symptom of a missing populator*, NOT an
intentional choice — nothing was syncing it, so it sat at 0 rows and silently
emptied the SEO/feed surfaces that read it. The sync (PR #25) fixed that.

Two distinct data paths — don't conflate them:
- **Live booking / availability / pricing** → always reads **BEAPI on the fly**
  (`/properties`, `/properties/[id]`, `/plan`, quotes, checkout). This is the
  source of truth and is unchanged.
- **SEO / feed surfaces** → read the **Supabase `listings` mirror**:
  `/s/[slug]` landing pages, **sitemap property URLs**, Microsoft/Bing travel +
  price feeds, search-suggestions, featured. These were blank while the table
  was empty.

Sync details (`src/lib/guesty-listings-sync.ts`):
- Source: BEAPI search (cursor pagination), mapped via `mapBeapiToListing`,
  **upsert on `guesty_id`**. Reuses the cached BEAPI token (no OAuth mint).
- Writes only BEAPI-derived columns; Open-API-only columns (`owners`,
  `financials`, `custom_fields`, `wheelhouse_data`, `host_name`,
  `contact_phone`, `timezone`) are left untouched.
- Delisted listings are soft-deactivated via a `last_synced_at` watermark,
  guarded against mass-deactivation on a partial fetch (needs ≥80% of reported
  total on a clean run).
- ⚠️ **Schema discipline:** explicit `select(...)` lists on `listings` must name
  only real columns — Postgres 42703s on unknown columns (this bit us:
  `review_count`/`computed_review_*`/`city`/`state`/`listing_category`/`pictures`
  were phantom and broke every `getListings*`, PR #24). The mirror has NO
  numeric review columns and NO top-level `city`/`state` (city/state live in the
  `address` JSONB).
- Side-effect: nightly **reviews-sync** now enumerates from this populated
  mirror instead of OpenAPI (whose creds aren't set in prod), so it's
  functional again for active listings without OpenAPI.

Manual repopulate: `curl -H "Authorization: Bearer $CRON_SECRET"
https://www.booktraverse.com/api/cron/sync-listings`

---

## Environment Variables

### In Vercel Production (confirmed)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL` (postgres://, fixed from typo)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (**live** `pk_live_...` in prod; `.env.local` is `pk_test_...`)
- `STRIPE_SECRET_KEY` (**live** `sk_live_...` in prod; `.env.local` is `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` = `whsec_UJYKJk2eMXLtgBmV8nv5Ygu4q5cXOvIZ`
- `GUESTY_BEAPI_CLIENT_ID`, `GUESTY_BEAPI_CLIENT_SECRET`, `GUESTY_BEAPI_BACKUP_CLIENT_ID`, `GUESTY_BEAPI_BACKUP_CLIENT_SECRET`
- `KLAVIYO_PRIVATE_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL` = `https://www.booktraverse.com`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (= `G-8NK72KVMJJ` in prod; live site confirms), `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID`
- `GA4_MP_API_SECRET` — server-side Measurement Protocol secret used by `trackBookingServerSide`. Prod value (fingerprint `zY…_Q`) is VERIFIED paired with G-8NK72KVMJJ (live-fire landed in Realtime 2026-05-30). Note: `.env.local` has a DIFFERENT, stale secret (`mK…qA`) tied to the old G-C5098JP52V — do not assume local == prod here. See Known issue #7.
- `ALERT_FROM_EMAIL`, `LISTING_INQUIRY_FROM`

### Still needed

- ~~`RESEND_API_KEY`~~ — **already set in prod** (confirmed `vercel env ls`); moved out of "still needed". Powers `sendAlert` ops emails + booking confirmation emails.
- `ANTHROPIC_API_KEY` — `/plan` popular-ideas cache seeding via `scripts/seed-popular-ideas.ts`
- `SENTRY_AUTH_TOKEN` — source map upload
- `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET` — OpenAPI branch of token refresh cron (currently silently skipped)

---

## Working Conventions

### Vercel CLI
- Use `npx vercel@53.1.0` (pinned version — avoids missing `@vercel/python@6.38.0` upgrade issue).
- After adding/changing `NEXT_PUBLIC_*` env vars, always deploy with `--force` to bust build cache.
- `npx vercel@53.1.0 deploy --prod --yes` is the standard deploy command.

### Build Caveats
- Strict TypeScript — `tsc --noEmit` runs in CI. Always run locally before deploying if you've changed types.
- ESLint strict — `<img>` vs `<Image />` warnings exist (non-blocking) but adding new ones will generate noise.
- Build preflights all API routes — lazy init patterns (`getSupabaseAdmin()`) are required for routes that need env vars.

### BEAPI token expiry → /properties returns 0 (and how it's protected)

If `/properties` ever returns 0 listings AND all searches show "No
properties found" — the first thing to check is BEAPI token health.
This has bitten production at least three times historically. As of
2026-05-28 there are four overlapping safeguards:

1. **Cron at `10 */2 * * *`** (every 2h, was 4h). `/api/cron/refresh-tokens`
   refreshes when token has < 2h life. With tokens lasting 24h that's
   ~once per 22h = under Guesty's 5/24h OAuth cap.

2. **Low-warning alert** in `/api/health/beapi`. When hoursRemaining
   drops below 1, a Resend email goes out (1h dedup so it's not spammy).
   Whoever's on call sees the warning hours before /properties breaks.

3. **In-app self-heal** in `src/lib/guesty-beapi.ts:getBEAPIToken()`.
   If both caches (in-memory + Supabase) are empty AND the cron has
   dropped, the next /properties request calls `/api/cron/refresh-tokens`
   inline via HTTPS+CRON_SECRET, re-polls Supabase, and proceeds.
   Throttled to 1×/5min/serverless instance against token-burn.

4. **Manual escape hatch**: `curl -H "Authorization: Bearer $CRON_SECRET"
   https://www.booktraverse.com/api/cron/refresh-tokens` always works.
   Should be rare now — if you find yourself running it, file an issue
   noting which of the above layers didn't fire and why.

Health-check endpoints:
- `https://www.booktraverse.com/api/health/beapi` — current BEAPI status
- `https://www.booktraverse.com/api/health/openapi` — OpenAPI status (still
  failing because `GUESTY_CLIENT_ID`/`SECRET` aren't set in Vercel, but
  OpenAPI isn't used by the public booking surface — only admin endpoints).

Where to look in Vercel dashboard if the cron is suspected to be dropping
fires: Project → Crons tab → `/api/cron/refresh-tokens` → execution
history. Look for missing fires, 4xx/5xx, or long durations.

### ⚠️ The "uncommitted receiver-side" trap (bit us 3× on 2026-05-28)

If your local `npx tsc --noEmit` passes but Vercel build fails, or
worse — the build SUCCEEDS but a runtime contract is mismatched and
prod silently breaks — it's almost always the same root cause:

**A tracked file has uncommitted changes that other already-committed
files depend on.** Your working tree is self-consistent, so local tsc
passes. Vercel does a fresh `git checkout`, the receiver-side update
isn't there, and either:
- The build fails (TS prop missing on a component) — caught at deploy
- The build succeeds, runtime breaks (JSON response field missing,
  hook return shape changed, etc.) — caught only when users complain

To reproduce what Vercel sees, run from the repo root:
```
git stash push -u --keep-index -m probe && npx tsc --noEmit ; git stash pop
```
Or simply: `bash scripts/check-deployable.sh` — the pre-push hook now
includes this dance automatically (added 2026-05-28 after the third
incident). Skip with `DEPLOY_CHECK_SKIP_CLEAN_TSC=1` only for genuine
feature-flag-gated partial pushes.

Pattern to avoid: do NOT commit the consumer-side import or JSX prop
addition without also committing the receiver-side declaration AND
runtime handling. Stage them together.

### Git
- Pushing to `main` triggers Vercel deployment.
- `vercel deploy --prod --yes` also works without git push.
- Never use TextEdit on config files (corrupts URLs with mailto: links).

### SEO conventions — adding pages, sitemap, canonicals, titles

**🚨 New statically-routed page → you MUST add it to the sitemap.** The
`static` sitemap segment is a hardcoded list. When you create a new indexable
`page.tsx` (a market hub, building page, guide, or any evergreen content page),
add its path to `CONTENT_PAGES` (or `CORE_PAGES`) in `src/app/sitemap.ts`.
Forgetting this is invisible — the page still builds and renders, it's just
undiscoverable by crawlers via the sitemap. This bit us pre-2026-06-09 (the
`/vail`, `/avon`, building, and `things-to-do` pages were in NO segment).

What is auto-included vs. manual:

| New thing | Sitemap segment | Manual sitemap edit? |
|---|---|---|
| Static `page.tsx` (market/building/guide/content) | `static` | **YES — edit sitemap.ts** |
| Listing | `properties` | No — nightly BEAPI sync |
| Blog post (added to `BLOG_POSTS` in `src/app/blog/posts.ts`) | `blog` | No — sourced from that array |
| Landing page `/s/*` (added to landing-pages config) | `landing-pages` | No |
| Neighborhood / stay / event (Supabase `sp_*`) | those segments | No |

**Two more rules when adding any indexable page** (both were sitewide bugs
fixed 2026-06-09):
1. **Canonical = the no-trailing-slash URL.** Pages serve at the no-slash path;
   the trailing-slash variant 308-redirects to it. Set
   `alternates: { canonical: "https://www.booktraverse.com/your-path" }` with
   NO trailing slash (homepage canonical is the bare origin).
2. **Don't repeat the brand in the title.** `src/app/layout.tsx` has a title
   template `"%s | Traverse Hospitality"`, so set the page `title` to just the
   page name (e.g. `"Winter Activities in Leadville Colorado"`). Do NOT append
   `" | Traverse Hospitality"` or `" — Traverse Hospitality"` yourself — the
   template adds it, and hardcoding it double-brands the `<title>`.
3. **Never list a noindexed page in the sitemap** (anything with
   `robots: { index: false }` — `/terms`, `/privacy`, `/book`, `/account`,
   etc.). Sitemap should advertise only indexable URLs.

### Phone numbers
- **B2C (guests)**: `(720) 759-2013` — in header, footer, property pages
- **B2C (Crested Butte)**: `(970) 438-2241`
- **B2B (owners)**: `(970) 533-3583` — only on `/property-management` via `phoneOverride` prop

---

## Production deploy history (sessions 1-4, most recent first)

| Deploy ID | What |
|---|---|
| `ERrswdot4q3AFBUZf1tAbCKptT4n` (current) | llms.txt rewrite + CSP places.googleapis.com + transparent logo |
| Previous deploys | listingNickname GA4 ecommerce · Conduit removal · DNS cutover · per-listing pet fee · sitemap fix · schema.org org · /plan Colorado polish · transparent logo |
| `b36hjlomu` | Start of session 4 baseline |

---

## How to pick up (start of session 5)

1. Read this file end-to-end.
2. Check `~/.claude/projects/-Users-Nadim/memory/MEMORY.md` for any deferred items.
3. **First task: fix Supabase auth URLs** (see "Immediate" open work above). This is the highest-impact blocker — sign-in is broken on the live site.
4. **Second task: activate Klaviyo abandoned-cart flow** after Supabase fix.
5. ~~Third task: Stripe live mode~~ — **DONE** (prod is live; see Known issues #5).

### Key memories to review

- `project_traverse_stripe_live_mode.md` — full live-mode Stripe swap procedure
- `project_traverse_ga4_duplicate_property.md` — GA4 property history; canonical flipped to G-8NK72KVMJJ on 2026-05-13 after discovering G-C5098JP52V's gtag.js is 404
- `reference_resend_setup.md` — Resend email setup (domain verified, just need API key in Vercel)
- `project_traverse_quarterly_refresh.md` — next run 2026-08-01
- `project_traverse_plan_seed.md` — /plan seed state (sp_plans cache needs ANTHROPIC_API_KEY)
- `feedback_vercel_deploy_force.md` — --force rule for NEXT_PUBLIC_* env changes
