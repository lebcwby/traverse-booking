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
- **Portfolio:** 186 active listings across 6 Colorado markets (marketing copy says "190+" — 5 mid-onboarding as of 2026-08-03) — Crested Butte, Leadville, Vail, Avon, Granby, Twin Lakes
- **Leadership:** Alex Haler (CEO), Nadim Tannous (CTO), Sabrina Colella (COO)

---

## ✅ CLOSED INCIDENT (2026-05-20 → resolved 2026-08-19) — customFields wipe

**What happened:** ~185 Guesty listings had their `customFields` array wiped on
2026-05-20 when `/api/admin/sync-urls-to-guesty` PUT only its own field —
Guesty's PUT **replaces** the whole array rather than merging by fieldId.
Details in `docs/incidents/2026-05-20-customfields-wipe.md`; affected list in
`docs/incidents/affected-listings.csv`.

**Both unblock conditions verified 2026-08-19:**
1. **Data is back.** Sampled 14 of the 185 affected listings evenly across the
   list — every one has 3–10 populated customFields. None empty.
2. **The code is fixed.** `patchListingCustomField` now does read-modify-write
   (GET current array → swap our entry → PUT the merged whole) and *aborts*
   rather than writing if any existing entry lacks a `fieldId`/`_id`, so an
   unexpected shape can't silently drop fields again.

**Re-run safely on 2026-08-19** to move Book Direct Link onto booktraverse.com
URLs: 233 updated, 142 already correct, **0 errors**, and a before/after diff of
12 listings' full customFields showed **zero collateral change**. Final state:
375/375 correct.

### Still true, and the reason this happened
⚠️ **Guesty's `PUT /v1/listings/{id}` REPLACES `customFields` wholesale.** Any
future writer must read-modify-write. Same trap bit `publicDescription.notes`
separately — see memory `feedback_guesty_notes_push_wipes_other_things_to_note`.

**Procedure for any customFields write** (all three steps, in order):
1. Dry run (default) — confirm the target field and counts.
2. Real write limited to ONE listing, then diff that listing's other fields.
   ⚠️ `limit=N` truncates the listing list *before* filtering, so `limit=1` will
   usually hit an already-correct listing and write nothing. Find the index of
   the first listing needing an update and set `limit` to index+1.
3. Full run, then re-run the dry run to confirm 0 remaining.

**Field reference:** "Book Direct Link" is fieldId `68dd93d0a549970030833297`.
The route's `fieldName` lookup (`book_direct_link`) does NOT match Guesty's
actual label and 404s — pass `?fieldId=68dd93d0a549970030833297` explicitly.

**Guesty "Additional links" is NOT API-writable — settled 2026-08-19, don't
re-investigate.** The links in that panel come from `integrations[].externalUrl`,
which Guesty fills from real channel connections (airbnb2, homeaway2,
bookingCom…). booktraverse.com isn't a Guesty channel, so there's no slot for
it, and the Open API listing object has no `additionalLinks` field — checked all
66 top-level keys; only `integrations` and `publicDescription` carry links.
Decision: the Book Direct Link custom field is the supported mechanism and is
correct on all 375 listings. Leave it there.

The site itself was never affected — this was always Guesty-internal data.

---

## 🧵 THREAD SPLIT (2026-08-01) — read this before picking up work

Work on this project is split across **two conversation threads**:

| Thread | Scope |
|---|---|
| **Marketing / newsletter** | Klaviyo, email campaigns, flows, guest-email sync, seasonality + booking-pace analysis |
| **Website** (this one) | Everything else: the Next.js app, checkout/payments, SEO, performance, infra |

**Marketing work lives in `docs/marketing/`** — don't re-derive it here:
- `klaviyo-annual-plan.md` — strategy, list state, corrected booking lead times
- `klaviyo-flow-setup.md` — flows + template IDs + segment recipes
- `klaviyo-campaign-calendar.md` — campaign calendar, event anchors, pacing methodology

---

## Current State (as of 2026-08-01)

### Recently shipped (2026-07-14 → 08-01)
- **Blog SEO** — legacy `/blog/<old-wp-slug>` 301s (host-gated map only covered the old
  domain); `/blog/[slug]` made SSG so unknown slugs return a real 404 instead of a
  200 soft-404. Filled all 5 `/plan/<slug>` SEO bodies + FAQs. (`364f5ae`, `3b6cc67`)
- **Soft-404 fix** — `/s/[slug]` now SSG → real 404; added branded `src/app/not-found.tsx`.
  ⚠️ `/properties/[id]` + `/plan/[id]` still return **200 + noindex** for unknown params
  (documented, accepted — see Known issues). (`5f08f04`)
- **Building pages** — Grand Lodge / Plaza / Lodge now show real per-night "starting from"
  prices with **no pre-selected dates** (previously seeded next-weekend dates that were
  often unavailable). Same fix applied to property cards + `/s`. (`db83cd1`, `e0240a9`)
- **Checkout** — terms/cancellation links added to the GuestyPay checkout; full site header
  hidden on checkout (was overlapping the Apple Pay button). (`0db7c95`, `377df7b`)
- **Klaviyo signup bug** — `subscribeToKlaviyoList` sent `first_name` to an endpoint that
  rejects it → **400, silently swallowed**. Every newsletter/contact-form signup carrying a
  name was being dropped. Fixed + verified against the live API. (`079fcd7`)

### 💳 Payments — GuestyPay hybrid is BUILT but PARKED
Hybrid checkout (cards → GuestyPay, Apple/Google Pay → Stripe) works end-to-end and is in
the repo behind `NEXT_PUBLIC_CHECKOUT_MODE`. **It is switched OFF in production** and must
stay off until the issue below is fixed.

**Why parked:** a real guest was **double-charged**. We create reservations directly as
*confirmed* via BE-API after collecting payment, so Guesty's **per-listing auto-payment rule**
("charge 100% at confirmation using guest card") fires a second charge. Stripe bookings are
safe (no card vaulted in Guesty → the rule can't execute); GuestyPay vaults the card, so it
can. The rules **can't simply be disabled** — VRBO/Expedia are hotel-collect and rely on them.

**The fix when resumed** (Guesty support's documented flow): create as **Inquiry** →
**record the external payment** (Open API) → **update status to Confirmed**. ~half a day plus
careful testing. Full detail in memory `project_traverse_guesty_pay_reactivation`.

### Historical — shipped in the May 2026 launch sessions

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
- **Schema.org** — Organization schema on homepage: `logo`, `image`, B2B phone `+1-970-533-3583`, hero stats 190+.
- **/plan polish** — Hero image changed to Colorado (not Portland skyline). Refinement chips, ANCHOR_OPTIONS, QUICK_REFINES all Colorado-ized. OG image blue (not gold). plan/[id]/page.tsx: "Your Colorado Trip".
- **Klaviyo abandoned-cart flow** — Templates created: "Abandoned Cart — Single Listing" (ID: Shfpc4) and "Abandoned Cart — 24h Follow-up" (ID: SdNCVn). Metrics: Started Checkout (V4D6NT), Added to Cart (Tgddiq), Booked Reservation. Flow is in Draft — confirm activation with Nadim.
- **llms.txt + llms-full.txt** — Rewritten from Stay Portland → Traverse Hospitality.

### Historical — fixed shortly after launch

- **Klaviyo company ID** — `consent-manager.tsx` had `T4kwLc` (Stay Portland's account) hardcoded as the fallback. All browser-side Klaviyo events (Started Checkout, Added to Cart, Viewed Listing) were going to Stay Portland's Klaviyo, not Traverse. Fixed: fallback updated to `UMUgtM` (Traverse), `NEXT_PUBLIC_KLAVIYO_COMPANY_ID=UMUgtM` added to Vercel. Deployed with `--force`.
- **GA4 canonical property (as of 2026-05-13)** — `G-8NK72KVMJJ` is now the canonical property receiving all ecommerce events. `G-C5098JP52V` (formerly assumed canonical, has WordPress historical purchase data) is preserved untouched for historical reporting only — its gtag.js CDN is permanently 404, so client-side custom events never actually reached it (page_view appeared only because GTM routes its own events directly to /g/collect, bypassing gtag.js). `G-MLNYK6YLXK` is the old highrockyhomes.com property (currently still linked to Google Ads — needs re-linking to G-8NK72KVMJJ).

### 💰 Reading Guesty's payment ledger — three traps (2026-08-26)

**A Guesty balance is NOT evidence of what the guest's card did.** Verify in
Stripe before charging or refunding anyone. Three separate incidents now:

1. **`balanceDue` negative ≠ double charge.** The auto-payment-rule shadow row
   flipping to SUCCEEDED doubles `totalPaid` (GY-hNBNy23v — see memory
   `feedback_guesty_auto_payment_rule_duplicate_records`).
2. **`balanceDue` positive ≠ money owed.** `recordPayment` hits Guesty's
   "amount > balance" error, `resolveAmountVsBalance` re-records at the balance
   Guesty held *at that instant*, and a fee (usually the **$50 pet fee**) lands
   on the invoice afterwards. The guest paid in full; only the ledger is short.
   GY-z9ai4HsW and GY-XfNL7u3G were both in this state — collecting would have
   charged them twice. GY-cZNjjLNX looked identical but was **genuinely** $50
   short. The only way to tell them apart is `amount_received` on the PI.
3. **GuestyPay collections never appear in our Stripe.** Different processor.
   A Guesty payment with a `ProcessorResult`/`AuthNumber` in `attempts[]` is a
   real GuestyPay capture, even though Stripe shows nothing. That is how
   GY-fYaHGbj5's $111.99 was collected (by `bookings+chelo@`, 2026-08-25).

`/api/cron/audit-payment-records` now classifies all of this — a positive
balance splits into `unpaid_balance` (Stripe really did receive less) vs
`unrecorded_payment` (**do not collect**, fix Guesty's ledger).

### 🔁 Portal date changes move Guesty BEFORE payment — by necessity

`/api/account/reservations/[id]/extend` calls `updateReservationDates()` in its
**quote** step, because Guesty has no dry-run pricing for a date change: moving
the dates *is* how you get the new price. **This is not a bug to "fix" by
reordering** — there is no pricing call to reorder it against.

The bug was that undoing it lived only in a client-side rollback. Closing the
tab left Guesty extended and unpaid, our row on the old stay, and the extra
night blocked (GY-fYaHGbj5, three days, found only when the guest phoned).

Now: `pending_date_changes` is written **before** the Guesty write and closed on
every terminal path; `/api/cron/sweep-abandoned-date-changes` (*/10) handles
what's left past a 30-min TTL. It **refuses to roll back** when Guesty no longer
matches the dates we set (a human edited it), when the PI shows the guest paid,
or when the balance was settled elsewhere (staff collecting via GuestyPay —
exactly how Paul's ended). Uncertainty → leave pending and alert.

⚠️ On a re-quote, `original_*` is deliberately **not** overwritten, or a rollback
would restore a stay the guest never booked.

⚠️ **There is no reservations sync cron.** Anything changed in Guesty never
flows back to our `reservations` table, and the guest portal reads those
columns. That is why Paul kept seeing his old dates. The sweeper writes dates
back for the cases it handles; nothing else does.

### 🌐 Landing subdomains — audit + projection (2026-08-26)

Two owner-acquisition landing pages, each on its own host, both served by
host-scoped rewrites in `next.config.ts`:

| Host | Route | Intake | Robots |
|---|---|---|---|
| `audit.booktraverse.com` | `/audit` | `/api/audit-request` | `public/audit-robots.txt` |
| `projection.booktraverse.com` | `/projection` | `/api/projection-request` | `public/projection-robots.txt` |

`/projection` targets Mt. Crested Butte condo owners in a **resort rental
program** — units with no public listing anywhere, so the form asks for the
building rather than a listing URL. Real unit counts (52 / 16 / 20 = **88** at
the base) are the page's core credibility claim; re-check the `listings` mirror
before editing them.

⚠️ **`projection.booktraverse.com` is not attached yet** — the rewrite is inert
until the domain is added to the Vercel project and DNS points at it. The page
is reachable meanwhile at `www.booktraverse.com/projection`. Expect to need
`vercel certs issue` by hand (2 for 2 on the Wix rebuilds).

⚠️ **`usePathname()` returns `/` on these subdomains** — the rewrite is
server-side and the client router never sees `/audit`. Anything that needs to
know it's on a landing page must key off the DOM (`body:has(.audit-page)` in
CSS), not the pathname. This is why the mobile bottom bar leaked there.

⚠️ **The Conduit widget still loads on both** and 403s in console. CLAUDE.md
records it as removed; it isn't. A guest chat widget on an owner-acquisition
page is worth removing properly.

### Known issues / standing notes

1. **Sign-in 400 error (HIGH PRIORITY)** — After DNS cutover, Supabase auth still only whitelists `traverse-booking.vercel.app`. Magic link and OAuth redirects to `booktraverse.com/auth/callback` return 400.  
   **Fix**: Go to [Supabase Dashboard](https://supabase.com) → Authentication → URL Configuration:
   - **Site URL** → `https://www.booktraverse.com`
   - **Redirect URLs** → add `https://www.booktraverse.com/**`  
   This unblocks: magic link login, Google OAuth, and wishlist sign-in dialog.

2. **OG meta "Stay Portland" in link previews** — This is social platform caching from when booktraverse.com pointed to WordPress. The actual og:image, og:title, og:description served by the Next.js site are all correct. Social caches expire automatically (Facebook: use https://developers.facebook.com/tools/debug/ to force re-scrape).

3. **GA4 Ecommerce purchases report — 48h lag** — item_variant data was just deployed. Check 2026-05-12 at 11:00 AM Mountain (scheduled routine will fire then).

4. **Klaviyo — moved to the marketing thread.** See `docs/marketing/`. Only the *code-side*
   touchpoints matter here: `subscribeToKlaviyoList` + the event helpers in
   `src/lib/tracking.ts` / `server-tracking.ts`, and the nightly
   `/api/cron/sync-klaviyo-guests` (Guesty → Klaviyo guest-email sync,
   `src/lib/klaviyo-guest-sync.ts`).
   ⚠️ **Klaviyo API gotcha:** `profile-subscription-bulk-create-jobs` accepts ONLY
   `email`/`phone_number`/`subscriptions`. Sending `first_name` or `properties` 400s the
   entire request. Rich attributes need a separate `profile-bulk-import-jobs` call. This bug
   silently killed signups until 2026-07-30 — don't reintroduce it.

8. **Soft-404 on unbounded dynamic routes — ACCEPTED, not a bug to re-fix.**
   `/properties/[id]` and `/plan/[id]` return **HTTP 200 with a noindex meta** for unknown
   params. This is documented Next 16 behaviour: a *streamed* response commits its status
   before `notFound()` runs. Routes with a finite param set (`/blog/[slug]`, `/s/[slug]`)
   were fixed with `dynamic = "force-static"` + `dynamicParams = false`; these two can't be
   (they read `searchParams` / handle runtime UUIDs). A true 404 would need a `proxy.ts`
   edge validator — deferred as low value (params are live IDs never linked externally, and
   the sitemap lists only real URLs). Memory: `feedback_traverse_dynamic_route_soft_404`.

5. **Stripe is LIVE (corrected 2026-06-24).** Prod is processing real charges — confirmed `livemode: true` on real PaymentIntents (e.g. GY-CvXxRDxw, two $361.63 charges 2026-05-31). Prod `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are **live keys** (`.env.local` still holds `sk_test`/`pk_test` — local is test, prod is live; don't assume local == prod). The earlier "still in test mode" note was stale. `project_traverse_stripe_live_mode.md` is now history, not a TODO.

6. **GA4 historical property preserved** — G-C5098JP52V (formerly assumed canonical) is kept untouched as a read-only archive of WordPress-era purchase data. Do **not** retry routing events to it — its gtag.js CDN returns 404 and we don't know why. New tracking flows to G-8NK72KVMJJ. See memory `project_traverse_ga4_duplicate_property.md` for the full history.

7. **GA4 server-side `purchase` tracking — VERIFIED HEALTHY 2026-05-30; report-lag is the usual culprit.** Symptom: a confirmed+paid BE-API booking (e.g. GY-XaH3sK9M) doesn't show in the G-8NK72KVMJJ *Ecommerce purchases* report same-day. **Tracking infra is fine** — `/api/admin/inspect-ga4?fire=true` returned measurementId G-8NK72KVMJJ + secret fingerprint `zY…_Q` (len 22, this is the PROD secret; the `mK…qA` in `.env.local` is a stale LOCAL value tied to the old property — ignore it) + liveFireStatus 204, and the `TEST-GA4-INSPECT` purchase **landed in G-8NK72KVMJJ Realtime**. So the MP secret↔property pairing is valid and server purchases deliver. The earlier "secret minted under old property" theory is DISPROVEN. Likely reasons a given booking looks missing: (a) GA4 *standard* Ecommerce report lags 24–48h — verify by searching the next-day report for `transaction_id = <confirmation code>`, not by glancing at "today"; (b) the guest declined **analytics** consent (server GA4 `purchase` is gated on `consent.analytics !== false` in server-tracking.ts ~L858) — a structural gap for the decline subset, not a config bug. NOTE: single-listing `pending_checkouts` rows are **deleted on completion** (cart rows in `pending_cart_checkouts` are retained), and the finalizer rebuilds `tracking` from `quoteContext.trackingDefaults`, so a missing pending row does NOT block the purchase event. The prior GY-zBMnaYA8/GY-dmwm6uVF misses (2026-05-23) were the fire-and-forget lambda-freeze bug, since fixed (finalizer now `await`s `trackBookingServerSide`). Runbook: `docs/runbooks/ga4-server-purchase-fix.md`.

---

## Open work (priority order)

> Marketing/Klaviyo items are **out of scope for this thread** — see `docs/marketing/`.

### Immediate / highest value

1. **Vercel Edge Requests spike (unresolved).** A Medium-severity alert fired 2026-07-17
   18:15 UTC. Not caused by our deploys (last push was ~23h earlier) and no redirect loop —
   so it's external traffic (this site has a history of Singapore bot traffic + a
   residential-proxy scraper). **We never identified the source**: the Vercel MCP token 403s
   on this team scope, and the Firewall UI has no custom date range to reach back to Jul 17.
   Firewall is active with 1 custom rule; **Bot Protection is OFF** — that's the fastest
   mitigation if it recurs. Next time: Observability → **Edge Requests → Paths tab**, or
   Firewall → Traffic → group by Path/IP/User-Agent, *while it's happening*.
2. **Quarterly portfolio refresh — was due 2026-08-01.** Run
   `npx tsx --env-file=.env.local scripts/refresh-portfolio-data.ts`.
   Memory: `project_traverse_quarterly_refresh`.
3. **Google Ads ↔ GA4 relink + GTM re-point.** Ads (`AW-16519101211`) still points at the
   old `G-MLNYK6YLXK`; GTM `GTM-WMD2QJS6` likely still on `G-C5098JP52V`. Both should target
   **G-8NK72KVMJJ**, or conversions/audiences from booktraverse traffic land nowhere useful.
   Needs Nadim's Google logins — prep the exact steps, don't attempt blind.

### P2 polish

- **Owner testimonials** — Real quotes pending from Nadim. Placeholder cards on `/property-management` `reviews` array. Memory: `project_traverse_owner_reviews_pending.md`.
- **Booking confirmation emails** — `RESEND_API_KEY` **is set in Vercel prod** (confirmed via `vercel env ls`, added ~2026-05; corrects the old "needed" note). `sendAlert` ops emails deliver. If confirmation emails still don't arrive, check key *validity*, not presence. See memory `reference_resend_setup.md`.
- **Re-seed `sp_plans` cache** — Run `npx tsx --env-file=.env.local scripts/seed-popular-ideas.ts`. `ANTHROPIC_API_KEY` **is present in `.env.local`** (corrected 2026-08-03 — the old "not yet added" note was stale), so this is unblocked. ⚠️ `unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL` in the shell first — an empty shell var shadows `.env.local` and breaks `@ai-sdk`. Without this seed, "Instant" popular-trip cards fall through to live agent (~15s) instead of cached templates (~200ms).
- ~~**`src/lib/plan/slug-content.ts`**~~ — **DONE (2026-07-14).** All 5 routed `/plan/<slug>` bodies now have Colorado long-form copy + 5 FAQs each (render visibly + as FAQPage JSON-LD). Was an empty map post-rebrand. Venue names should get a periodic open/closed spot-check (see `project_traverse_crested_butte_businesses_status`).
- **`src/lib/plan/favorites.ts`** — Intentionally **empty** (`FAVORITES = []`) since the Portland POIs were stripped 2026-05-26; plan works fine without favorite-anchoring. Not a cleanup task — optionally add Colorado local-pick entries later if we want favorite-anchored recs.

### P3 deferred

- **Photo category navigation** — Airbnb-style room tabs on property gallery. Needs AI vision since Guesty BEAPI doesn't expose room metadata. See memory `project_traverse_photo_categorization.md`.
- **Google Places API key restriction** — Currently unrestricted key embedded in 75 POI photo URLs. Restrict in Cloud Console: HTTP referrer `https://www.booktraverse.com/*` + restrict to Places API. See memory `project_traverse_plan_seed.md`.
- **Quarterly portfolio refresh** — Next run: 2026-08-01. See memory `project_traverse_quarterly_refresh.md`.
- **Google Ads ↔ GA4 re-linking** — Google Ads (`AW-16519101211`) is still linked to `G-MLNYK6YLXK` (old highrockyhomes.com property). Re-link to `G-8NK72KVMJJ` so conversions and audiences from booktraverse.com traffic land in the active property. GA4 → Admin → Product links → Google Ads links.
- **GTM container re-pointing** — GTM `GTM-WMD2QJS6` GA4 Configuration tag likely still set to `G-C5098JP52V`. Update it to `G-8NK72KVMJJ` so GTM-mediated events (page_view, etc.) land in the same property as direct gtag events. Otherwise split reporting.
- **Sentry source maps** — `SENTRY_AUTH_TOKEN` **is present in `.env.local`** (corrected 2026-08-03). Still needs adding to **Vercel prod** for CI builds to upload maps — that's the actual remaining step, not the local key.

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

### Klaviyo (code-side only — strategy lives in `docs/marketing/`)

- **Marketing list**: `S9Ezba`. `KLAVIYO_PRIVATE_KEY` in Vercel. **~15,500 subscribers**
  (was 16 until the Guesty→Klaviyo sync landed 2026-07-30).
- **Metric IDs** the app emits: Started Checkout `V4D6NT` · Added to Cart `Tgddiq` ·
  Booked Reservation `SuqpZn` · Viewed Listing `QQxkdN` · Newsletter Signup `U6Yiwy` ·
  Requested Availability Notification `Y5vn5X` · Submitted Contact Form `Xmf9Bx`.
- **Nightly sync**: `/api/cron/sync-klaviyo-guests` (`0 10 * * *`) →
  `src/lib/klaviyo-guest-sync.ts`. Enumerates **reservations** (the `/v1/guests` list
  endpoint doesn't populate emails), hard-filters OTA relay addresses, and upserts profiles
  with `guesty_*` properties used for segmentation.
  ⚠️ Two Guesty traps handled in there: unfiltered list endpoints are **capped**, and deep
  pagination **dies past ~12k records** (hence date-slicing).

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

- **Grand Lodge** — 6 Emmons Loop, Mt. CB 81225. ~226 units, **52** Traverse. Pool (indoor/outdoor), hot tub, steam room. Pets: select units. Free parking. Starts $95/night.
- **Lodge at Mountaineer Square** — 620 Gothic Road, Mt. CB 81225. ~133 units, **16** Traverse. HAS front desk. HAS A/C. Pool, hot tub, sauna, steam room, fitness center. Heated underground parking (paid). NO pets.
- **The Plaza** — 11 Snowmass Road, Mt. CB 81225. ~20 units, **20** Traverse. NO front desk. Hot tubs, sauna, steam room. Tennis/pickleball. NO pool. NO A/C. NO pets. Free covered parking.

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
- ~~`ANTHROPIC_API_KEY`~~ — **already in `.env.local`** (corrected 2026-08-03). Only needed locally for `scripts/seed-popular-ideas.ts`; not required in Vercel.
- `SENTRY_AUTH_TOKEN` — source map upload. Present in `.env.local`, **still missing in Vercel prod** (that's what blocks CI map upload).
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

## How to pick up (website thread, 2026-08-01+)

1. Read this file end-to-end — especially **Thread split**, **Current State**, and the
   **GuestyPay parked** note.
2. Check `~/.claude/projects/-Users-Nadim/memory/MEMORY.md` for deferred items.
3. Pick from **Open work → Immediate**. Nothing is currently on fire: the site is healthy,
   Stripe checkout is live and working, and the blog/SEO/building-page fixes all shipped.
4. **Don't** start Klaviyo/campaign work here — that's the marketing thread (`docs/marketing/`).

### Ground rules learned the hard way (2026-07)
- **Verify before asserting.** Several bugs this cycle were the opposite of the obvious
  theory. Check occupancy/pace/live status with a query or a real request first.
- **`reservations.booked_at` is the real booking date** — `created_at` is the CRM *sync*
  date for backfilled rows and will produce nonsense lead times.
- **Guesty caps OAuth token mints (~5/24h).** Never mint per-script; use the repo's cached
  helpers (`getBEAPIToken`, `openapiFetch`) or run through a deployed endpoint.
- **Money paths need real end-to-end tests**, not code review. Two orphaned test charges and
  one real double-charge came from shipping payment code that only *looked* right.

### Key memories to review
- `project_traverse_guesty_pay_reactivation` — ⭐ why GuestyPay is parked + the fix
- `feedback_traverse_dynamic_route_soft_404` — Next 16 soft-404 behaviour + what's accepted
- `project_traverse_klaviyo_guest_sync` — the sync (code lives in this repo)
- `project_traverse_ga4_duplicate_property` — canonical is **G-8NK72KVMJJ**
- `project_traverse_quarterly_refresh` — was due 2026-08-01
- `project_traverse_scraper_defense` — prior bot/scraper mitigation, relevant to the
  unresolved Edge Requests spike
- `feedback_vercel_deploy_force.md` — --force rule for NEXT_PUBLIC_* env changes
