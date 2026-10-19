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
- **Portfolio:** **208 active, listed and bookable listings** across 6 Colorado markets — Crested Butte, Leadville, Vail, Avon, Granby, Twin Lakes. Marketing copy says **"220+"** (`portfolio-stats.marketingCount`). Counted from the `listings` mirror 2026-10-14; the old "186 / 190+" figures were from 2026-08-03.
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
   (GET current array → swap our entry → PUT the merged whole) and _aborts_
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
   ⚠️ `limit=N` truncates the listing list _before_ filtering, so `limit=1` will
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

| Thread                     | Scope                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| **Marketing / newsletter** | Klaviyo, email campaigns, flows, guest-email sync, seasonality + booking-pace analysis |
| **Website** (this one)     | Everything else: the Next.js app, checkout/payments, SEO, performance, infra           |

**Marketing work lives in `docs/marketing/`** — don't re-derive it here:

- `klaviyo-annual-plan.md` — strategy, list state, corrected booking lead times
- `klaviyo-flow-setup.md` — flows + template IDs + segment recipes
- `klaviyo-campaign-calendar.md` — campaign calendar, event anchors, pacing methodology

---

## Current State (as of 2026-10-14)

### 🤖 Phase 2 — AI discoverability + agent booking: ALL 8 PHASES SHIPPED (2026-10-12 → 10-14)

Design `docs/phase2-ai-agent-booking.md` (#76). Built: JSON-LD defects #78 ·
JSON-LD extensions #80 · robots/llms.txt + cacheable crawler responses #81 ·
`calendar_days` populated #79 · `/agent/v1` + OpenAPI #83 · root layout split
#85 · listing pages ISR #86 · remote MCP server #87 · **agent quote + checkout
link #88**.

**The one architectural fact to keep.** `/api/cron/sync-calendar` (`25 * * * *`)
mirrors Guesty's calendar into `calendar_days` at 40 listings/hour, ~2 req/s —
full catalogue every ~5h. 76.5k rows, 208/208 listings. `/agent/v1` reads and
`/mcp` serve **entirely from Postgres, so Guesty is never called**. Without it a
single agent search would be 208 Guesty calls against a 120/min ceiling and
would rate-limit the booking site for ~2 minutes.

⚠️ **`POST /agent/v1/quote` is the sole exception — it DOES call Guesty.** Hence
10/min per IP and **fail-closed** (reads get 60/min). If you add another
Guesty-calling agent endpoint, gate it the same way.

⚠️ **Two kinds of price, never merge them.** Cached search/availability figures
carry `AGENT_DISCLOSURE` (accommodation-only, indicative, `authoritative:false`).
A live quote carries `QUOTE_TERMS` (all-in, `authoritative:true` until
`expiresAt`). An agent reads these to decide whether to quote a number to a
guest.

⚠️ **BEAPI `days[].price` is the published nightly rate, NOT a breakdown of the
accommodation fare.** Verified: nights summed to $284 while the fare was $337.20
before a promotion. Never present them as parts of one total.

**BEAPI quote TTL = 24h exactly**, via a top-level `expiresAt`.
`buildNormalizedQuoteResponse` drops the field; `readQuoteExpiry` in
`src/lib/agent-quote.ts` reads it.

**Agent attribution needs no new column** — the checkout URL carries `utm_*`,
which `proxy.ts` already captures into `_sp_attribution` → `pending_checkouts
.tracking` → GA4 + `reservations`. Segment on `utm_medium=ai_agent`.

Success bar: **one real agent-originated booking.** Everything else is a
leading indicator.

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
_confirmed_ via BE-API after collecting payment, so Guesty's **per-listing auto-payment rule**
("charge 100% at confirmation using guest card") fires a second charge. The rules
**can't simply be disabled** — VRBO/Expedia are hotel-collect and rely on them.

🚨 **The double-capture is real. Two successive explanations of WHY were both wrong.**
Full evidence in `docs/guestypay-duplicate-payments.md`; the short version:

- ❌ _"Stripe bookings are safe — no card is vaulted in Guesty, so the rule can't
  execute."_ Wrong. Three real guests were double-charged.
- ❌ _"`checkout-finalizer.ts` passes the Stripe payment-method id as `ccToken`, so Guesty
  holds a chargeable card on every direct booking and the rule uses it."_ **Also wrong**,
  and this one sat in CLAUDE.md as settled fact. A MongoDB ObjectId embeds its creation
  time, so the card actually charged can be dated: it was vaulted **+51 min**, **+943 min**
  and **+5,703 min** (4 days) after the respective bookings. Our `ccToken` exists at t=0.
  **The card that was charged did not exist yet.** Removing `ccToken` would have fixed
  nothing.
- ✅ **What the records show (2026-10-14).** The rule creates a note-less row at booking.
  It starts **PENDING** because the Stripe `pm_...` we hand Guesty is not chargeable by
  GuestyPay. It sits dormant, then fires for the **full original amount** once a real card
  is vaulted — in all four cases the capture used the **same `paymentMethodId` as a later
  manual charge** (a pet fee, an added night). ⚠️ That trigger fits all four but is not
  proven to be the only one.

**Scope across 319 direct reservations:** 4 fired (**$3,289.15**, all four confirmed
refunded), 109 dormant (**$102,875.15**). `GY-cZNjjLNX` is a fourth case that was missing
from the old list of three (GY-hNBNy23v $592.90, GY-5RAz3apL $357.19, GY-SHHhdMpj
$1,738.41).

✅ **FIX SHIPPED (#90): `/api/cron/void-duplicate-payments`.** Cancels the dormant row
before it can fire. Proven on GY-BQH77T7H 2026-10-14 — row CANCELLED, guest's payment
intact, `balanceDue` held at **0**, so Guesty's "cancelled amount is added back to balance
due" does **not** apply to a row that never captured. Deliberately a sweeper, not a
finalizer hook: a Guesty write inside checkout would add a failure mode to the money path.

⚠️ **The matching rule is strict, and must stay that way.** A PENDING auto-rule row is NOT
automatically a duplicate — where the amount is _complementary_, the rule is collecting a
genuine remaining balance (`GY-reaVneZq`: Stripe $8,567.65 + auto $1,261.56 = $9,829.21 =
hostPayout). A first pass at this analysis counted **14** double-charges by treating every
SUCCEEDED auto-rule row as a duplicate; most were balance collections. A duplicate has the
**same amount** as a payment already collected.

⚠️ **When one appears: refund the STRIPE leg, never the GuestyPay one** — GuestyPay is
what the reservation is actually paid with, so reversing it leaves the stay unpaid. And
**check Stripe for an existing refund first**; all four were already refunded by the time
anyone looked.

`/api/cron/audit-payment-records` flags a fired one as `guestypay_shadow_charge`. Nothing
detected it before, because the ledger looks _correct_: our Stripe row gets CANCELLED in
Guesty, leaving `totalPaid == hostPayout` and `balanceDue` 0 over a card hit twice.

**Separately, for re-enabling the GuestyPay hybrid** (Guesty support's documented flow):
create as **Inquiry** → **record the external payment** (Open API) → **update status to
Confirmed**. ~half a day plus careful testing. Memory
`project_traverse_guesty_pay_reactivation`.

### Historical — shipped in the May 2026 launch sessions

- **DNS cutover** — GoDaddy A records updated: `booktraverse.com` + `www.booktraverse.com` → `76.76.21.21`. Vercel SSL auto-provisioned. Apex 308-redirects to www.
- **GA4 tracking fully wired** — All funnel events (view_item, begin_checkout, add_to_cart, purchase, view_item_list) route to G-8NK72KVMJJ (the "Book Traverse" property). G-C5098JP52V (formerly assumed canonical) turned out to be broken on Google's gtag CDN — `googletagmanager.com/gtag/js?id=G-C5098JP52V` returns **404**, so client-side `gtag('event', …)` calls were silently dropped the whole time even though the GA4 admin shows the stream as "active". Switched canonical to G-8NK72KVMJJ on 2026-05-13.
- **listingNickname in GA4 ecommerce** — `item_variant` field on all 6 GA4 ecommerce events + server-side purchase. Threaded through: tracking.ts, server-tracking.ts, pending-checkouts.ts, quote-response.ts, checkout-form.tsx, book/[quoteId]/page.tsx, confirmation session, track-confirmation.tsx, add-to-cart-button.tsx, track-properties-list.tsx, payment-intent/route.ts, checkout-finalizer.ts. GA4 Ecommerce purchases report will show listing nicknames in "Item variant" column ~48h after events fire.
- **Conduit chat widget removed** — 6 component files deleted, all CSP entries removed from both next.config.ts and csp.ts. Mobile "Help" tab replaced with "Call" tel: link. Checkout "Need help?" buttons replaced with tel: links.
- ~~**Per-listing pet fee from BEAPI**~~ — **REMOVED 2026-10-17. The website charges NOTHING for pets, on any listing.** Guests disclose a pet and pay any pet fee through the **guest portal after booking**. This reverses the 2026-05-20 "guests can bring pets if they pay the fee" call.

  ⚠️ **There was a live bug, not just a policy change.** The Pets stepper in the guests dialog was never gated on `petsAllowed`, while the page's `petFeeTotal` returned 0 when `!petsAllowed` — so on a no-pet listing a guest could add pets, see **$0**, and still be charged `pets × fee` by the server. The finalizer then added a matching "Pet Fee" AFE to the Guesty invoice.

  Pet charging is gone from: `upsells.ts` (the `pet-fee` item), both payment-intent paths (create AND update), the cart, pending-checkout, the finalizer's AFE, and the checkout UI. An outdated client sending `pets > 0` or a `pet-fee` upsell id is **ignored and charged $0 with a warning** — deliberately not a 400, so a stale bundle can't fail a booking.

  **Display only** lives in `src/lib/pet-policy.ts` → `isPetFriendly()`, used for the checkout note, the JSON-LD `petsAllowed` and the agent API. It matches the house-rules flag, the exact tag "pet friendly" or the exact amenity "Pets allowed" — **no substring matching**. The JSON-LD previously used `a.includes("pet")`, which matches **"carpet"**, so carpeted homes were published to Google and to every AI assistant as pet-friendly.

  Guarded by `src/lib/no-pet-charges.test.ts` and `src/lib/pet-policy.test.ts`. Guesty constants, should the policy ever reverse: accountFeeId `67fc4907f2cc23000e67992c`, secondIdentifier `PET`, default $50/pet.

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
   Guesty held _at that instant_, and a fee (usually the **$50 pet fee**) lands
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
the dates _is_ how you get the new price. **This is not a bug to "fix" by
reordering** — there is no pricing call to reorder it against.

The bug was that undoing it lived only in a client-side rollback. Closing the
tab left Guesty extended and unpaid, our row on the old stay, and the extra
night blocked (GY-fYaHGbj5, three days, found only when the guest phoned).

Now: `pending_date_changes` is written **before** the Guesty write and closed on
every terminal path; `/api/cron/sweep-abandoned-date-changes` (\*/10) handles
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

| Host                          | Route         | Intake                    | Robots                         |
| ----------------------------- | ------------- | ------------------------- | ------------------------------ |
| `audit.booktraverse.com`      | `/audit`      | `/api/audit-request`      | `public/audit-robots.txt`      |
| `projection.booktraverse.com` | `/projection` | `/api/projection-request` | `public/projection-robots.txt` |

`/projection` targets Mt. Crested Butte condo owners in a **resort rental
program** — units with no public listing anywhere, so the form asks for the
building rather than a listing URL. Real unit counts (52 / 16 / 20 = **88** at
the base) are the page's core credibility claim; re-check the `listings` mirror
before editing them.

🚦 **BLOCKER before promoting `/projection`: the comparison figures are
illustrative.** The page's centrepiece is a peak-week owner statement run two
ways, and it is comparative advertising against an identifiable competitor.
Before this is advertised anywhere: (a) the Traverse column must come from the
real fee schedule signed off by Alex or Nadim — it is a commitment to a
prospective client, and nobody should invent our commission rate; (b) the other
column must only say what we can evidence, which is why it is framed as "typical
of statements owners have brought us"; (c) never publish a real owner's
statement without their written permission, since they may owe their manager
confidentiality. Numbers and the reasoning live in `PEAK_WEEK` at the top of
`src/app/projection/page.tsx`. Both columns must keep summing to their stated
totals.

⚠️ **Two competitive premises were wrong before this one** — the page first
claimed CBMR units aren't on the OTAs (they are, via Booking.com directly and
Airbnb/Vrbo through distribution partners), then that "the listing isn't yours"
(true, but we distribute the same way, so it attacks us too). Don't build
competitor claims on inference. The current page argues only what we do:
distribution and pricing, near-24/7 guest comms, an inspection after every
clean, lower commission with no invented fees.

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

4. **Klaviyo — moved to the marketing thread.** See `docs/marketing/`. Only the _code-side_
   touchpoints matter here: `subscribeToKlaviyoList` + the event helpers in
   `src/lib/tracking.ts` / `server-tracking.ts`, and the nightly
   `/api/cron/sync-klaviyo-guests` (Guesty → Klaviyo guest-email sync,
   `src/lib/klaviyo-guest-sync.ts`).
   ⚠️ **Klaviyo API gotcha:** `profile-subscription-bulk-create-jobs` accepts ONLY
   `email`/`phone_number`/`subscriptions`. Sending `first_name` or `properties` 400s the
   entire request. Rich attributes need a separate `profile-bulk-import-jobs` call. This bug
   silently killed signups until 2026-07-30 — don't reintroduce it.

5. **Soft-404 on unbounded dynamic routes — ACCEPTED, not a bug to re-fix.**
   `/properties/[id]` and `/plan/[id]` return **HTTP 200 with a noindex meta** for unknown
   params. This is documented Next 16 behaviour: a _streamed_ response commits its status
   before `notFound()` runs. Routes with a finite param set (`/blog/[slug]`, `/s/[slug]`)
   were fixed with `dynamic = "force-static"` + `dynamicParams = false`; these two can't be
   (they read `searchParams` / handle runtime UUIDs). A true 404 would need a `proxy.ts`
   edge validator — deferred as low value (params are live IDs never linked externally, and
   the sitemap lists only real URLs). Memory: `feedback_traverse_dynamic_route_soft_404`.

6. **Stripe is LIVE (corrected 2026-06-24).** Prod is processing real charges — confirmed `livemode: true` on real PaymentIntents (e.g. GY-CvXxRDxw, two $361.63 charges 2026-05-31). Prod `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are **live keys** (`.env.local` still holds `sk_test`/`pk_test` — local is test, prod is live; don't assume local == prod). The earlier "still in test mode" note was stale. `project_traverse_stripe_live_mode.md` is now history, not a TODO.

7. **GA4 historical property preserved** — G-C5098JP52V (formerly assumed canonical) is kept untouched as a read-only archive of WordPress-era purchase data. Do **not** retry routing events to it — its gtag.js CDN returns 404 and we don't know why. New tracking flows to G-8NK72KVMJJ. See memory `project_traverse_ga4_duplicate_property.md` for the full history.

8. **GA4 server-side `purchase` tracking — VERIFIED HEALTHY 2026-05-30; report-lag is the usual culprit.** Symptom: a confirmed+paid BE-API booking (e.g. GY-XaH3sK9M) doesn't show in the G-8NK72KVMJJ _Ecommerce purchases_ report same-day. **Tracking infra is fine** — `/api/admin/inspect-ga4?fire=true` returned measurementId G-8NK72KVMJJ + secret fingerprint `zY…_Q` (len 22, this is the PROD secret; the `mK…qA` in `.env.local` is a stale LOCAL value tied to the old property — ignore it) + liveFireStatus 204, and the `TEST-GA4-INSPECT` purchase **landed in G-8NK72KVMJJ Realtime**. So the MP secret↔property pairing is valid and server purchases deliver. The earlier "secret minted under old property" theory is DISPROVEN. Likely reasons a given booking looks missing: (a) GA4 _standard_ Ecommerce report lags 24–48h — verify by searching the next-day report for `transaction_id = <confirmation code>`, not by glancing at "today"; (b) the guest declined **analytics** consent (server GA4 `purchase` is gated on `consent.analytics !== false` in server-tracking.ts ~L858) — a structural gap for the decline subset, not a config bug. NOTE: single-listing `pending_checkouts` rows are **deleted on completion** (cart rows in `pending_cart_checkouts` are retained), and the finalizer rebuilds `tracking` from `quoteContext.trackingDefaults`, so a missing pending row does NOT block the purchase event. The prior GY-zBMnaYA8/GY-dmwm6uVF misses (2026-05-23) were the fire-and-forget lambda-freeze bug, since fixed (finalizer now `await`s `trackBookingServerSide`). Runbook: `docs/runbooks/ga4-server-purchase-fix.md`.

---

## Open work (priority order)

> Marketing/Klaviyo items are **out of scope for this thread** — see `docs/marketing/`.

### Immediate / highest value

1. 🟡 **GuestyPay double-capture — fix shipped, BACKLOG IN PROGRESS.** The tool is
   `/api/cron/void-duplicate-payments` (#90), proven on one reservation
   2026-10-14. ~100 dormant duplicate rows (~$82k notional) still need voiding in
   capped batches:

   ```bash
   # dry run (default) — always look first
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.booktraverse.com/api/cron/void-duplicate-payments"
   # apply, 10 at a time, checking balanceChanged on every batch
   curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.booktraverse.com/api/cron/void-duplicate-payments?apply=1&max=10"
   ```

   ⚠️ **Stop immediately if any result shows `balanceChanged: true`.** That means
   a cancel moved the balance, which would put a guest back into collections for
   money they already paid. It did not happen on the proving run.

   Once the backlog is clear, add it to `vercel.json` crons so new bookings on
   rule-enabled listings never accumulate again. **Still unknown:** whether the
   rule RE-CREATES a row we cancelled — the first scheduled runs will show this,
   and if it does, the rule itself needs addressing per listing. Evidence and
   mechanism in `docs/guestypay-duplicate-payments.md`.

2. **Recurring Guesty 429 bursts → catalog served from mirror.** `guesty-429-burst`
   and `catalog-served-from-mirror` both fired 2026-10-14 (10:09Z / 11:04Z) and
   recur. The mirror fallback absorbs them so guests see nothing, but **the source
   of the bursts has never been identified**, and BEAPI exhaustion is the failure
   mode that empties `/properties` for real guests. ⚠️ Clearing a poisoned Next
   fetch-cache entry on 2026-10-13 took mirror-read failures 6→0 and looked like a
   fix — it recurred the next day, so that was a symptom. Diagnosis is blocked by
   the same Vercel MCP 403 as item 3.

3. **Vercel Edge Requests spike (unresolved).** A Medium-severity alert fired 2026-07-17
   18:15 UTC. Not caused by our deploys (last push was ~23h earlier) and no redirect loop —
   so it's external traffic (this site has a history of Singapore bot traffic + a
   residential-proxy scraper). **We never identified the source**: the Vercel MCP token 403s
   on this team scope, and the Firewall UI has no custom date range to reach back to Jul 17.
   Firewall is active with 1 custom rule; **Bot Protection is OFF** — that's the fastest
   mitigation if it recurs. Next time: Observability → **Edge Requests → Paths tab**, or
   Firewall → Traffic → group by Path/IP/User-Agent, _while it's happening_.
4. **Quarterly portfolio refresh — overdue.** Marketing says **220+**; the
   `listings` mirror has **208** active/listed/bookable (counted 2026-10-14). Run
   `npx tsx --env-file=.env.local scripts/refresh-portfolio-data.ts`.
   Memory: `project_traverse_quarterly_refresh`.
5. **Google Ads ↔ GA4 relink + GTM re-point.** Ads (`AW-16519101211`) still points at the
   old `G-MLNYK6YLXK`; GTM `GTM-WMD2QJS6` likely still on `G-C5098JP52V`. Both should target
   **G-8NK72KVMJJ**, or conversions/audiences from booktraverse traffic land nowhere useful.
   Needs Nadim's Google logins — prep the exact steps, don't attempt blind.

### P2 polish

- **Owner testimonials** — Real quotes pending from Nadim. Placeholder cards on `/property-management` `reviews` array. Memory: `project_traverse_owner_reviews_pending.md`.
- **Booking confirmation emails** — `RESEND_API_KEY` **is set in Vercel prod** (confirmed via `vercel env ls`, added ~2026-05; corrects the old "needed" note). `sendAlert` ops emails deliver. If confirmation emails still don't arrive, check key _validity_, not presence. See memory `reference_resend_setup.md`.
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
│       ├── payment-intent/route.ts       # No pet charge (2026-10-17); pet input ignored + warned
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
│   │   ├── upsells.ts                    # UPSELLS is EMPTY — no pet fee (2026-10-17)
│   │   ├── pet-policy.ts                 # isPetFriendly() — DISPLAY ONLY, never gates a charge
│   │   └── upsell-selector.tsx           # Accepts upsells?: UpsellItem[] prop
│   ├── cart/add-to-cart-button.tsx       # Passes listingNickname to trackAddToCart
│   ├── properties/track-properties-list.tsx  # Passes nickname to trackViewedListingList
│   └── wishlist-button.tsx               # Login dialog for wishlist; uses Supabase auth
└── lib/
    ├── tracking.ts                       # All GA4/Meta/Klaviyo events; item_variant = listingNickname
    ├── server-tracking.ts                # Server-side GA4 purchase event; item_variant = listingNickname
    ├── pending-checkouts.ts              # PendingTracking includes listingNickname; DB try-catch wrapped
    ├── checkout-finalizer.ts             # Never adds a Pet Fee AFE (2026-10-17); listingNickname tracking
    ├── booking-identity.ts               # buildStayKey, buildGuestIdentityKey, buildBookingFingerprint
    ├── quote-response.ts                 # buildNormalizedQuoteResponse: listingNickname from BEAPI
    ├── csp.ts                            # IMG_SOURCES includes places.googleapis.com
    └── plan/
        ├── system-prompt.ts              # CO-aware agent: 6 markets, altitude, events, neighborhood slugs
        ├── events.ts                     # getEventsForStay() → EVENTS_OVERLAPPING prompt block
        └── poi-preload.ts                # detectTown() + detectVibe() — Colorado-mapped
```

### GA4 Tracking Map

| Event               | When                           | item_variant     |
| ------------------- | ------------------------------ | ---------------- |
| `view_item_list`    | Properties list page load      | listing.nickname |
| `view_item`         | Property detail page load      | listing.nickname |
| `add_to_cart`       | "Book Now" / add-to-cart click | listingNickname  |
| `begin_checkout`    | /book/[quoteId] page load      | listingNickname  |
| `add_payment_info`  | Stripe card field entered      | listingNickname  |
| `purchase` (client) | trackBookingCompleted          | listingNickname  |
| `purchase` (server) | trackBookingServerSide         | listingNickname  |

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

| Building / Category            | Real BEAPI tag                    |
| ------------------------------ | --------------------------------- |
| Grand Lodge Crested Butte      | `The Grand Lodge Crested Butte`   |
| The Plaza Condominiums         | `The Plaza Crested Butte`         |
| Lodge at Mountaineer Square    | `The Lodge at Mountaineer Square` |
| Grand West Village (Leadville) | `Grand West Village Resort`       |
| Old St Vincent's (Leadville)   | `OSV`                             |
| Cabin Rentals                  | `cabin`                           |

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
"empty by design." That was the _symptom of a missing populator_, NOT an
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

1. **Cron at `10 */2 * * *`** (every 2h). `/api/cron/refresh-tokens` refreshes
   when the token has **< 6h** life (raised from 2h — at 2h the buffer equalled
   the cron interval, leaving a 16-second margin). Tokens last 24h, so this
   mints ~once a day.

   ⚠️ **CORRECTED 2026-10-19 — this route is the ONLY scheduled refresher.**
   This file used to say the Supabase edge function `supabase/functions/
refresh-tokens` was the sole owner "via pg_cron", and `guesty-beapi.ts`
   still carries a comment saying the same. **There is no pg_cron job for it**
   — `select * from cron.job` returns exactly one row, `monthly-owner-report`.
   The edge function is deployed but **dormant**. It is still a latent risk:
   it mints from the same client id and is invocable over HTTP, so it bypasses
   the budget in 1a. Verify before trusting either claim:

   ```sql
   select jobname, schedule, active from cron.job;
   ```

1a. **Global mint budget** (added 2026-10-19). Guesty caps OAuth at **5 tokens
per 24h per client, and burning all 5 is a 24-HOUR LOCKOUT with no
recovery.** The expiry-buffer check in (1) stops redundant refreshes but is
**not a lock**: when the token is genuinely stale, every concurrent caller
passes it and every one mints. Concurrency is exactly what happens then —
the self-heal in (3) is throttled per _serverless instance_, so a burst of
cold starts is a burst of mints. The "CRITICAL: BEAPI token unavailable"
alert arriving **4× in the same second** on 2026-10-16 is what that looks
like from outside.

`refreshOne` now claims a cross-instance budget of **4 mints per 24h per
token type** before calling OAuth, deliberately holding the 5th back for
manual recovery. Being blocked is serious — the token will expire — but it
is recoverable in minutes, whereas a lockout is not recoverable at all.

2. **Low-warning alert** in `/api/health/beapi`. When hoursRemaining
   drops below 1, a Resend email goes out (1h dedup so it's not spammy).
   Whoever's on call sees the warning hours before /properties breaks.

3. **In-app self-heal** in `src/lib/guesty-beapi.ts:getBEAPIToken()`.
   If both caches (in-memory + Supabase) are empty AND the cron has
   dropped, the next /properties request calls `/api/cron/refresh-tokens`
   inline via HTTPS+CRON_SECRET, re-polls Supabase, and proceeds.
   Throttled to 1×/5min **per serverless instance** — which is why it needed
   the global budget in 1a. A per-instance throttle does not bound anything
   when the instance count is what spikes.

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

| New thing                                                                | Sitemap segment | Manual sitemap edit?         |
| ------------------------------------------------------------------------ | --------------- | ---------------------------- |
| Static `page.tsx` (market/building/guide/content)                        | `static`        | **YES — edit sitemap.ts**    |
| Listing                                                                  | `properties`    | No — nightly BEAPI sync      |
| Blog post (added to `BLOG_POSTS` in `src/app/blog/posts.ts`)             | `blog`          | No — sourced from that array |
| Press release (added to `PRESS_RELEASES` in `src/app/press/releases.ts`) | `press`         | No — sourced from that array |
| Landing page `/s/*` (added to landing-pages config)                      | `landing-pages` | No                           |
| Neighborhood / stay / event (Supabase `sp_*`)                            | those segments  | No                           |

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

### Updating the public portfolio count ("220+ homes")

One command — do NOT hand-edit, and do not crawl the site looking for them:

```bash
npx tsx scripts/refresh-portfolio-data.ts --set-count=230 --dry-run   # preview
npx tsx scripts/refresh-portfolio-data.ts --set-count=230             # apply
```

It rewrites all 22 count-bearing surfaces (pages, footer, stat bar, schema.org,
FAQ data, meta + OG descriptions, the plan surfaces, the AI prompts,
`llms.txt`/`llms-full.txt`, the blog generator's brand brief) plus
`portfolio-stats.marketingCount`, then scans the repo for stragglers and tells
you to add any new file to `MARKETING_AUDIT_FILES`. No API calls; ~1 second.

- It is a **literal token swap** of the current value ("220+" → "230+"), taken
  from `portfolio-stats.marketingCount`. That is why it can't damage
  "approximately 200 yards" (the walk to the lifts on the Grand Lodge page) or
  "save 10–15%".
- **Blog posts and press releases are excluded on purpose** — dated statements
  that were true when published.
- `totalListings` is the separate, honest BEAPI figure and stays owned by the
  full quarterly run. `marketingCount` is allowed to lead it (listings are
  active in the PMS before they are bookable), but check the gap: as of
  2026-09-30 the site says 220+ while BEAPI has 195 and Guesty 214 active.

⚠️ Do NOT use `--sweep-copy` to change the public number. That flag forces the
copy down to the raw BEAPI total and would undo it.

### ✅ Advisory locks — FIXED (verified 2026-10-14). Don't re-investigate.

`withAdvisoryLock()` (src/lib/db.ts) is what stops the Stripe webhook and the
frontend `POST /api/reservations` from finalizing the same payment twice.

**This section used to say the lock was an inert no-op needing an env var. It
is no longer true.** `SHARED_DATABASE_URL_DIRECT` has been set, and
`GET /api/health/db` returns **200** in production, meaning `probeAdvisoryLock()`
actually acquired a session-scoped lock. A degraded connection returns 503.

Check it in one command before assuming anything about this:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.booktraverse.com/api/health/db
```

**Why it mattered.** The lock needs a **session-mode** connection. Production
had only `DATABASE_URL`, pointing at Supabase's **transaction pooler on :6543**,
where `pg_advisory_lock` gives no session-scoped exclusion — so every call
silently did nothing. That is how **GY-ty5Dgqzs / GY-8RHBqLsm** happened
(2026-10-02): one payment, two confirmed reservations for the same listing and
dates, created 117ms apart, double-blocking a Leadville house over the December
peak and recording the same $1,558.34 against both. The guest was charged once.

⚠️ **If `/api/health/db` ever returns 503 again, the lock is inert again** and
`finalizeCartCheckout` is unprotected too — it uses the same helper. The cause
is almost certainly `SHARED_DATABASE_URL_DIRECT` being unset or pointed at
:6543 instead of :5432.

Still true and still load-bearing: `reservations_one_active_per_stay_idx`
(migration 20261003130000) makes it impossible for our table to hold two ACTIVE
rows for the same (payment intent, listing, stay). It is deliberately NOT keyed
on the payment intent alone — multi-unit **cart** checkouts legitimately share
one intent across listings. The index protects our data; it does NOT stop a
second reservation being created in Guesty. Only the lock does that.

`withAdvisoryLock` logs loudly when it detects :6543, and
`advisoryLocksEffective()` exposes the state.

### Phone numbers

- **B2C (guests)**: `(720) 759-2013` — in header, footer, property pages
- **B2C (Crested Butte)**: `(970) 438-2241`
- **B2B (owners)**: `(970) 533-3583` — only on `/property-management` via `phoneOverride` prop

---

## Production deploy history (sessions 1-4, most recent first)

| Deploy ID                                | What                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERrswdot4q3AFBUZf1tAbCKptT4n` (current) | llms.txt rewrite + CSP places.googleapis.com + transparent logo                                                                                               |
| Previous deploys                         | listingNickname GA4 ecommerce · Conduit removal · DNS cutover · per-listing pet fee · sitemap fix · schema.org org · /plan Colorado polish · transparent logo |
| `b36hjlomu`                              | Start of session 4 baseline                                                                                                                                   |

---

## How to pick up (website thread, 2026-10-14+)

1. Read this file end-to-end — especially **Thread split**, **Current State**, and the
   **GuestyPay parked** note.
2. Check `~/.claude/projects/-Users-Nadim/memory/MEMORY.md` for deferred items.
3. Pick from **Open work → Immediate**. The site is healthy and Stripe checkout is live
   and working. Two things are mid-flight: the **GuestyPay duplicate-row backlog**
   (tool shipped and proven, ~100 rows left to void) and the **recurring Guesty 429
   bursts** (now instrumented, awaiting data).
4. **Don't** start Klaviyo/campaign work here — that's the marketing thread (`docs/marketing/`).

### ⚠️ Verify before trusting this file

Items here go stale, and acting on a stale claim has cost real time. Three that
were wrong as written, all caught 2026-10-14:

- "Advisory locks are a no-op" — **fixed**. `curl -s -o /dev/null -w '%{http_code}'
https://www.booktraverse.com/api/health/db` → 200.
- "186 listings / 190+ marketing" — actually **208 / 220+**.
- The Phase 2 design doc claimed BEAPI quotes had **no expiry field**. They have
  a top-level `expiresAt`, 24h. That claim came from grepping _our own code_,
  which only proved our normalizer drops it. **Ask the upstream API, not our
  wrapper.**

A one-command check beats a confident paragraph. Health endpoints:
`/api/health/db` (advisory locks), `/api/health/beapi`, `/api/health/email`,
`/api/health/openapi`.

### Ground rules learned the hard way (2026-07)

- **Verify before asserting.** Several bugs this cycle were the opposite of the obvious
  theory. Check occupancy/pace/live status with a query or a real request first.
- **`reservations.booked_at` is the real booking date** — `created_at` is the CRM _sync_
  date for backfilled rows and will produce nonsense lead times.
- **Guesty caps OAuth token mints (~5/24h).** Never mint per-script; use the repo's cached
  helpers (`getBEAPIToken`, `openapiFetch`) or run through a deployed endpoint.
- **Money paths need real end-to-end tests**, not code review. Two orphaned test charges and
  one real double-charge came from shipping payment code that only _looked_ right.

### Key memories to review

- `project_traverse_guesty_pay_reactivation` — ⭐ why GuestyPay is parked + the fix
- `feedback_traverse_dynamic_route_soft_404` — Next 16 soft-404 behaviour + what's accepted
- `project_traverse_klaviyo_guest_sync` — the sync (code lives in this repo)
- `project_traverse_ga4_duplicate_property` — canonical is **G-8NK72KVMJJ**
- `project_traverse_quarterly_refresh` — was due 2026-08-01
- `project_traverse_scraper_defense` — prior bot/scraper mitigation, relevant to the
  unresolved Edge Requests spike
- `feedback_vercel_deploy_force.md` — --force rule for NEXT*PUBLIC*\* env changes
