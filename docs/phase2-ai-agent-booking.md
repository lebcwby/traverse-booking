# Phase 2 — AI crawler access, structured data, and agent booking

**Status: design only. Nothing in here is built.**
Audited 2026-10-09 against live `https://www.booktraverse.com` (deploy `dpl_BfmZCwoJawRiff8dVTtAa7mXuMXd`).

The goal has two halves that are easy to conflate:

1. **Discoverability** — when someone asks ChatGPT or Claude "where should I stay in
   Crested Butte", our listings are in the answer. This is won with crawler access,
   structured data and clean text. It is cheap and almost all of it is already in place.
2. **Bookability** — a guest's agent can search, price and hand off a real booking.
   This needs an API we do not have yet.

Half 1 is where the return is. Half 2 is the strategic bet, and it is worth
starting because the read-only layer it needs is also what makes half 1 better.

---

## Part A — Audit findings

### A1. Crawler access: wide open, and nothing is blocking us

Live `robots.txt` in full:

```
User-Agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.booktraverse.com/sitemap.xml
```

There are **no AI-specific directives at all** — no `GPTBot`, no `Google-Extended`,
no `CCBot`. Everything is allowed by the wildcard. That is the permissive posture we
want, but it is permissive _by omission_, which means nobody has decided it.

Tested all 12 crawler user agents against `/`, `/properties`, a listing page,
`/llms.txt` and `/sitemap.xml` — **60 requests, all HTTP 200**:

| Crawler                                  | Result         |
| ---------------------------------------- | -------------- |
| GPTBot, OAI-SearchBot, ChatGPT-User      | 200 everywhere |
| ClaudeBot, Claude-User, Claude-SearchBot | 200 everywhere |
| PerplexityBot, Perplexity-User           | 200 everywhere |
| Googlebot, Bingbot, Applebot, CCBot      | 200 everywhere |

No Vercel Firewall rule, bot-protection challenge or proxy check intercepts them.
Bot Protection is off on the project (noted in CLAUDE.md as the mitigation we have
never switched on).

> ⚠️ **First caveat on an agent API.** `Disallow: /api/` covers the entire API
> namespace. An agent that is _told_ an endpoint exists can still call it — robots.txt
> binds crawlers, not clients — but nothing will ever _discover_ it by crawling, and
> some well-behaved agents refuse to fetch disallowed paths. A public agent API must
> live outside `/api/`, or robots.txt must carve out an exception. See B2.

> ⚠️ **Second caveat, and the bigger one.** Every listing page is served to crawlers as:
>
> ```
> cache-control: private, no-cache, no-store, max-age=0, must-revalidate
> x-vercel-cache: MISS
> set-cookie: _sp_visitor_id=…; _fbp=…
> ```
>
> Every crawler hit is a full origin render plus a live Guesty call, and we hand each
> bot tracking cookies it will never return. With 208 listings and a dozen AI crawlers
> this is the dominant cost of being indexed, and it caps how fast anyone can crawl us.
> This is the "cookie-driven no-store on every response" item already on the open list;
> Phase 2 is the reason to finally do it.

### A2. Structured data: better than expected, with five real defects

Every page type already emits JSON-LD:

| Page                  | Types present                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Homepage              | `Organization` (rich — addresses, phones, `sameAs`, `aggregateRating` 4.9/214, `areaServed`) |
| `/properties`         | `CollectionPage`, `BreadcrumbList` — **no `ItemList`**                                       |
| Listing (5/5 sampled) | `VacationRental`, `BreadcrumbList`, `FAQPage`                                                |

`VacationRental` field coverage across the 5 sampled listings:

| Present on all 5                                                                                                                                                                                                                                                                                     | Missing on all 5                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `@id`, `identifier`, `name`, `url`, `description`, `image` (11–45 each), `address`, `geo`, `latitude`/`longitude`, `containedInPlace`, `numberOfBedrooms`, `numberOfBathroomsTotal`, `occupancy`, `petsAllowed`, `checkinTime`, `checkoutTime`, `offers`, `brand`, `containsPlace`, `additionalType` | `amenityFeature`, `priceRange`, `numberOfRooms`, `tourBookingPage`, `additionalProperty`, `isPartOf`, `floorSize`, `smokingAllowed` |

**The five defects, worst first:**

1. **`offers.price` is the Guesty `basePrice` placeholder, not the real rate.**
   Four of five sampled listings advertise **`"price": 95`** — the known $95 placeholder
   documented in `project_traverse_starting_from_price`. Worse, the Leadville carriage
   house publishes `"price": 110` in JSON-LD while the visible page says **"From $76
   /night"**. So the machine-readable price is wrong _and_ contradicts the human-readable
   one. Google treats a structured/visible price mismatch as a rich-result violation, and
   an AI assistant quoting "$95" for a 2-bedroom slope-side condo makes us look either
   broken or dishonest. The correct number, `nightlyFrom`, is already computed every 4
   hours by the `pricing-cache/refresh` cron — the JSON-LD just doesn't read it.

2. **`amenityFeature` is absent entirely.** Amenities are the single most common filter
   in a natural-language query ("hot tub", "pet friendly", "ski-in/ski-out", "A/C").
   The data is in the `listings.amenities` column and already rendered as visible text —
   it is simply not expressed as `LocationFeatureSpecification`. This is the largest
   single gap for AI answerability.

3. **Address fields are wrong for Mt. Crested Butte.** Sampled properties at 11 Snowmass
   Road and the Grand Lodge carry `addressLocality: "Crested Butte"` with
   `postalCode: "81225"` — but 81225 _is_ Mount Crested Butte; 81224 is Crested Butte.
   Locality and postcode contradict each other on at least 3 of 5. Separately,
   `addressRegion` is the word `"Colorado"` where schema.org and Google want the
   `"CO"` abbreviation (the homepage `Organization` block gets this right).

4. **`containedInPlace` says `{"@type":"City","name":"Colorado"}`.** Colorado is a state.
   This asserts a city called Colorado contains the property, which is simply false and
   wastes the field that should anchor the listing to its actual town.

5. **`aggregateRating` is inconsistent.** Absent on one of five. Present on the other
   four but with **no `ratingCount`/`reviewCount`** — Google requires a count, so the
   rating is likely being dropped from rich results today. Review data exists (10 `review`
   objects on most pages).

Minor but visible: one listing's `name` is `" Plaza 2 BR mtn view"` with a leading
space, which propagates into the `<title>`, the breadcrumb and all five FAQ answers.
That is a Guesty data-entry artefact we should trim on read.

### A3. No-JS readability: good

A listing page returns ~320–570 KB of HTML, of which ~7–9 KB is server-rendered visible
text. Confirmed present in the server HTML without executing any JavaScript:

- Full property description
- Amenity names (hot tub, pool, washer, dryer, parking, dishwasher…)
- Bedrooms, bathrooms, sleeps
- Check-in / checkout times
- A "From $X /night" anchor price

**Not present: availability.** The page shows "Add dates for prices" / "Select dates" —
real pricing and availability only exist after a client-side quote call. An agent reading
HTML can tell you the property exists and roughly what it costs; it cannot tell you
whether it is free next weekend or what the all-in total would be. **That gap is the
entire argument for the agent API.**

### A4. Data sources we could safely expose

| Source                     | Holds                                                                                                                                                                                | Freshness                            | Safe to expose read-only?                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase `listings` mirror | 208 active listings: title, type, bedrooms, bathrooms, beds, accommodates, sqft, address, amenities, tags, pictures, check-in/out times, timezone, `beapi_enabled`, `review_summary` | Nightly (`sync-listings`, 09:00 UTC) | **Yes.** Already the documented SEO/feed source. Contains `owners`/`financials`/`custom_fields` columns that must be explicitly excluded — never `select *`. |
| `kv_store` pricing cache   | `nightlyFrom` per listing                                                                                                                                                            | Every 4h (`pricing-cache/refresh`)   | **Yes** — this is the honest "from" price the JSON-LD should already be using.                                                                               |
| Guesty BEAPI quotes        | Real all-in price, fees, taxes, min-stay enforcement                                                                                                                                 | Live                                 | **Yes, but metered.** This is the only source of a true price.                                                                                               |
| Guesty BEAPI availability  | Calendar                                                                                                                                                                             | Live                                 | Yes, metered.                                                                                                                                                |
| `calendar_days` table      | listing_id, date, price, currency, min_nights, status, cta, ctd                                                                                                                      | —                                    | **The table exists and is completely empty (0 rows).**                                                                                                       |

> 🔍 **`calendar_days` is a built-but-unpopulated cache — and it is the single most
> valuable thing we found.** The schema is exactly what an agent availability endpoint
> needs. Two consumers already read it: the Microsoft price feed, and the YoY-rates alert
> enrichment. The alert path reads it from a _third_ Supabase project via
> `DASHBOARD_SUPABASE_URL` — **which is not set in Vercel production**, so that
> enrichment is inert. The booking DB's own copy has never been written to. This is the
> same shape of bug as the `listings` mirror before PR #25: a table that silently sat
> empty because nothing populated it. Filling it is a self-contained win that serves the
> agent API, the price feed and the alerts at once.

**Rate limits.** Guesty allows ~15 req/s burst and **120 req/min sustained**; our client
retries 429s and fires an alert when it sees 6+ terminal 429s in 5 minutes. Our own edge
proxy already rate-limits by IP:

| Route                      | Limit  | Notes                                           |
| -------------------------- | ------ | ----------------------------------------------- |
| `POST /api/payment-intent` | 10/min | fail-closed                                     |
| `POST /api/quotes`         | 15/min | **unauthenticated; proxies straight to Guesty** |
| `POST /api/reservations`   | 5/min  |                                                 |
| `POST /api/contact`        | 5/min  |                                                 |

`POST /api/quotes` is already a public, unauthenticated Guesty passthrough bounded only
by a 15/min per-IP limit. An agent API does not open a new hole so much as formalise one
that exists — but it does raise the volume, so the caching plan in B2 is not optional.

---

## Part B — Design

### B1. Quick wins (no API, no new infrastructure)

#### B1.1 Make the robots policy explicit

Today's wildcard allows everything by accident. Replace it with a deliberate statement.
Recommendation — **allow all the retrieval and search bots, allow the model-training
bots too**:

```
# Assistants that answer user questions and cite/link sources — always allow.
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-User
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Perplexity-User
Allow: /

# Training crawlers. Allowed: our content IS the marketing, and presence in a
# model's weights is how we get recommended when nobody is searching.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /

User-agent: *
Allow: /
Disallow: /api/
Disallow: /book/
Disallow: /account/
Disallow: /checkout/

Sitemap: https://www.booktraverse.com/sitemap.xml
```

Two changes beyond naming the bots: `Disallow: /book/` and `/account/` (no value in
crawling a checkout funnel, and it burns crawl budget on pages that 404 or redirect for
anonymous visitors), and keeping `Disallow: /api/` while putting the future agent API
somewhere else.

**The one genuine decision here is `Google-Extended` and `GPTBot`** — the training
crawlers. Blocking them protects the content from being absorbed without attribution;
allowing them is how a model learns Traverse exists at all. For a 208-property regional
operator whose problem is obscurity rather than content theft, I recommend allowing. It
is reversible at any time. **Your call — see Decisions.**

⚠️ Per `feedback_dynamic_robots_ts_404s_in_prod`: this must stay a static file reached by
a host-scoped rewrite. Do **not** reintroduce a dynamic `robots.ts`. Curl both hosts after
any change.

#### B1.2 Fix and extend the JSON-LD

Ordered by value. Items 1–4 are corrections to wrong data and should ship first — wrong
structured data is worse than none, because it is confidently wrong.

**Corrections**

1. `offers.price` → read `nightlyFrom` from the pricing cache; fall back to omitting
   `offers` entirely rather than publishing the $95 placeholder. Add
   `priceSpecification` with `minPrice`, and `validFrom`/`validThrough` so the number is
   explicitly a "from" price for a window, not a promise.
2. `addressRegion` → `"CO"`. `addressLocality` → derive from postcode (81225 → Mount
   Crested Butte, 81224 → Crested Butte, 80461 → Leadville) rather than from the Guesty
   city field, which is unreliable.
3. `containedInPlace` → `{"@type":"City","name":"Mount Crested Butte","containedInPlace":
{"@type":"State","name":"Colorado"}}`.
4. `aggregateRating` → always include `ratingCount`; omit the whole block when there are
   no reviews rather than emitting a partial one. Trim whitespace from `name`.

**Additions**

5. **`amenityFeature`** — map `listings.amenities` to
   `LocationFeatureSpecification { name, value: true }`. The highest-value addition.
6. **`tourBookingPage`** → the listing's own URL, and later the agent deep link (B3).
   This is the schema.org field that literally means "book here", and it is the natural
   bridge from structured data to the agent flow.
7. `numberOfRooms`, `floorSize` (from `area_square_feet`), `additionalProperty` for
   minimum-stay, `isPartOf` pointing at the building page for Grand Lodge / Plaza /
   Lodge units.
8. **`/properties` gets an `ItemList`** of the listings on the page, each an
   `ItemListElement` → `VacationRental` stub with name, url, image, price. Right now the
   catalogue page tells a crawler nothing structured about its contents.
9. Homepage: add `WebSite` with `SearchAction` (sitelinks search box) alongside the
   existing `Organization`.

Validate every page type against the Rich Results test and schema.org validator before
merge, and keep a fixture test so the shape cannot silently regress.

#### B1.3 llms.txt additions

The current file is 507 lines and already lists the full catalogue (Phase 1). What it
does not say is **how to actually transact**, which is exactly what an assistant needs to
give a useful answer. Add:

- **How to book** — the real flow, including that no account is required, what payment
  methods work, and that the quote is all-in with no booking fee.
- **Policies** — the 14-day cancellation rule stated once, canonically; check-in after
  4 PM / checkout before 10 AM; pet policy varies per listing; self check-in via smart
  lock.
- **Fees and taxes** — that the displayed total includes cleaning and taxes, and that a
  pet fee applies per pet on pet-friendly units only.
- **Contact** — guest line (720) 759-2013, Crested Butte (970) 438-2241,
  bookings@traversehospitality.com. Owner enquiries go to the B2B number, not these.
- **What we are not** — not an OTA, not a platform; we are the manager, so the person
  answering the phone can actually change your booking.
- Once B2 exists: a pointer to the OpenAPI description.

**Per-listing markdown: not yet.** 208 `.md` files is a real maintenance surface, and the
HTML pages are already clean, server-rendered and well-structured. Revisit only if
Search Console or referrer logs show assistants fetching but not citing us.

### B2. Read-only public agent API

#### Endpoints

Served under **`/agent/v1/`**, deliberately _outside_ `/api/` so robots.txt can allow it
without opening the private API namespace.

| Endpoint                                             | Purpose                                                                                                    | Source                              | Cache                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------- |
| `GET /agent/v1/listings`                             | Search: `market`, `checkIn`, `checkOut`, `guests`, `bedrooms`, `pets`, `amenities[]`, `maxNightly`, `page` | `listings` mirror + `calendar_days` | 1h shared, stale-while-revalidate |
| `GET /agent/v1/listings/{id}`                        | Full detail: facts, amenities, images, policies, canonical URL                                             | `listings` mirror                   | 6h                                |
| `GET /agent/v1/listings/{id}/availability?from=&to=` | Day-level free/blocked, min-stay, CTA/CTD                                                                  | `calendar_days`                     | 15m                               |
| `POST /agent/v1/quote`                               | Real all-in price for listing + dates + guests                                                             | **Guesty BEAPI (live)**             | not cached; rate-limited          |
| `GET /agent/v1/markets`                              | The 6 markets with descriptions and counts                                                                 | static + mirror                     | 24h                               |

Only `POST /agent/v1/quote` touches Guesty. Everything else is served from Postgres, so
a crawl of the whole catalogue costs Guesty nothing.

**This is why `calendar_days` matters.** Search-with-dates is the query an agent actually
asks, and answering it from Guesty would mean one BEAPI call per listing per search —
208 calls against a 120/min ceiling, i.e. one search would rate-limit us for two minutes.
Answering from a populated `calendar_days` makes it a single indexed SQL query. **The
availability cache is a hard prerequisite, not a nice-to-have.**

Populate it with a new cron pulling the Guesty calendar for all 208 listings on a rolling
window (next 12 months), chunked to stay under 120 req/min — roughly 2 req/s for ~2
minutes, run hourly. The existing pricing-cache cron is the model to copy, including its
BEAPI backoff.

#### Spec, discovery, auth

- **OpenAPI 3.1** served at `/.well-known/openapi.json`, with a human page at
  `/agent` explaining the terms and linking the spec. Referenced from `llms.txt` and
  `robots.txt`.
- **Anonymous by default**, IP rate-limited through the existing edge proxy — it already
  does exactly this for 7 routes and the pattern is proven. Suggested:
  read endpoints 60/min/IP, `POST /quote` 20/min/IP fail-closed (it costs Guesty quota,
  same reasoning as `payment-intent`).
- **Optional API keys** for partners who need more, issued manually. Do not build
  self-serve key management now.
- **No PII, ever.** The mirror's `owners`, `financials`, `custom_fields` and
  `wheelhouse_data` columns must be excluded by an explicit allow-list of columns, not by
  a deny-list. ⚠️ Per `feedback_traverse_listings_mirror_sync`, `select()` on `listings`
  must name only real columns or Postgres 42703s — an allow-list is both the safe and the
  required pattern.

#### MCP vs OpenAPI vs both — recommendation

**Build the HTTP + OpenAPI layer first. Add MCP later as a thin adapter. Do not start
with MCP.**

Reasoning:

- The hard work — the cached service layer, the availability cache, the quote plumbing,
  the rate limiting — is **identical for both**. Transport is the easy part.
- OpenAPI reaches more consumers today: it is what ChatGPT, Gemini and ordinary HTTP
  agents consume, and the spec file doubles as machine-readable documentation.
- Remote MCP is the better _interactive_ experience and is clearly where tool-using
  assistants are heading. Once the service layer exists, an MCP server exposing
  `search_listings` / `get_listing` / `check_availability` / `get_quote` is a few hundred
  lines over the same functions.
- Building MCP first would mean building the service layer anyway and reaching fewer
  consumers in the meantime.

So: **both, in that order**, and the OpenAPI phase is what to commit to now.

### B3. Book-via-link handoff

The agent never takes payment. It gets a price, then hands the guest a link.

```
agent → POST /agent/v1/quote {listingId, checkIn, checkOut, guests}
      ← {quoteId, nightly, fees, taxes, total, currency, expiresAt,
         checkoutUrl: "https://www.booktraverse.com/book/<quoteId>?src=agent&agent=<slug>"}
guest → opens checkoutUrl → existing Stripe checkout → existing finalizer
```

**This reuses the current code almost entirely.** `/book/[quoteId]` already re-fetches
`/api/quotes/[quoteId]` server-side and already accepts `checkIn` and `guests` query
params, so a quote ID in a URL is a flow the app supports today. The quote comes from the
same `createQuote` BEAPI call the website uses, and `createReservationFromQuote` consumes
the same `quoteId`. **No change to checkout, payment-intent creation, `finalizeReservation`
or payment recording is required** — which is exactly the property we want, given the
money-path history.

Four things to get right:

- **Quote expiry.** Our code does not currently track or surface a quote TTL, and I could
  not find an expiry field on the BEAPI quote. We must establish what Guesty's actual
  quote lifetime is before publishing `expiresAt` — publishing a guess would be worse
  than omitting it. **Open question for the build phase; do not assume.**
- **Price drift.** Between the agent quoting and the guest paying, rates can move. The
  checkout page already re-fetches the quote, so the guest always pays the re-fetched
  price. The agent-facing contract must therefore say the quote is **indicative, and the
  checkout page is authoritative** — and the UI should show a clear notice when the
  re-fetched total differs from the one in the link.
- **Double-booking.** Already covered: the double-charge guard from #67 refuses a second
  PaymentIntent for a stay that has a succeeded, un-refunded charge — verified working in
  production on 2026-10-09 (it blocked a retry 18 seconds after a reservation was
  created). Nothing agent-specific needed.
- **Attribution.** Tag the agent source through the existing tracking context so it lands
  in `pending_checkouts.tracking` and flows to GA4 and the `reservations` row. ⚠️ Note
  `feedback_guesty_webhook_drops_source_column` — the Guesty webhook upsert enumerates
  columns by hand and silently dropped `source` for 402 rows. Any new attribution column
  must be added to **both** branches of that upsert, with a test.

### B4. Agentic payments — readiness note only

Protocols where the agent itself pays (OpenAI's Instant Checkout / Agentic Commerce
Protocol, Stripe's agentic-commerce and shared payment tokens, Google's AP2) are real but
early, and they assume a merchant that can accept a programmatic order and confirm it
synchronously.

**We are not ready, and the blocker is not the protocol.** It is that our booking path
still has the unresolved issues this repo documents: the advisory lock is inert in
production because `SHARED_DATABASE_URL_DIRECT` is unset, so concurrent finalizes are
only partly protected; and the Guesty auto-payment rule still double-captures through
GuestyPay on listings where it is enabled. Handing an automated, high-volume payer a path
with those two open would be reckless.

Minimum before revisiting: session-mode database URL set and the lock verified working;
the `ccToken`/auto-payment-rule question settled; agent-tagged bookings running cleanly
through the link flow in B3 for a season. Then it is mostly a matter of accepting a
delegated payment token in place of a card at the existing Stripe step.

Revisit **no earlier than the B3 flow having real volume**.

### B5. Risks and open questions

| Risk                               | Assessment                                                                                                                                                                                                     | Mitigation                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Competitors scrape our pricing** | Real but limited. Nightly rates are already public on our pages, Airbnb and Vrbo, and PriceLabs/Wheelhouse-class tools already track this market. An API makes it tidier, not newly possible.                  | Expose "from" prices and availability freely; keep all-in quotes rate-limited. Never expose occupancy stats, financials or owner data. |
| **Scraper/bot load**               | We have history here — a residential-proxy scraper and Singapore bot traffic. A documented API is a _reduction_ in incentive to scrape HTML.                                                                   | Per-IP limits at the edge (proven pattern); cache everything but quotes; keep the 429 burst alert.                                     |
| **Guesty rate limits**             | The real operational risk.                                                                                                                                                                                     | Serve search/availability from Postgres; only `/quote` hits Guesty, fail-closed rate-limited.                                          |
| **Guesty ToS / API terms**         | ⚠️ **Genuinely unresolved.** Whether re-publishing Guesty-derived availability and pricing through our own public API is permitted under our BEAPI agreement is a question for Guesty, not something to infer. | **Ask Guesty support in writing before building B2.** Cheap to ask, expensive to get wrong.                                            |
| **Price accuracy**                 | An assistant quoting a stale or placeholder price damages trust more than being absent.                                                                                                                        | Fix the `$95` defect first (B1.2). Label cached prices as "from", never as a total.                                                    |
| **Security**                       | Read-only, no auth surface, no writes, no PII.                                                                                                                                                                 | Column allow-list; no raw Guesty errors in responses (the existing `classifyBeapiError` pattern); no owner or financial fields.        |
| **Attribution gaps**               | Agent bookings invisible in reporting would make the whole thing unmeasurable.                                                                                                                                 | Ship attribution in the same PR as the link flow, with the dual-branch webhook fix.                                                    |

### B6. Phased build plan

Each phase is a separate PR, ordered so that value lands before complexity.

| #   | PR                                                       | Size | What                                                                                                                                 | Test                                                                              | Deployable alone?               |
| --- | -------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------- |
| 1   | **Fix the JSON-LD defects**                              | S    | Real `nightlyFrom` price, `CO`, locality from postcode, `containedInPlace`, `ratingCount`, trim `name`                               | Fixture tests per page type + Rich Results on 5 listings                          | Yes                             |
| 2   | **Extend the JSON-LD**                                   | S–M  | `amenityFeature`, `tourBookingPage`, `numberOfRooms`, `floorSize`, `isPartOf`, `ItemList` on `/properties`, `WebSite`+`SearchAction` | Same fixtures                                                                     | Yes                             |
| 3   | **robots.txt policy + llms.txt booking/policy sections** | S    | B1.1 and B1.3                                                                                                                        | Curl both hosts after deploy                                                      | Yes                             |
| 4   | **Cacheable crawler responses**                          | M    | Stop `no-store` + tracking cookies for known crawler UAs; let the CDN serve them                                                     | Header assertions per UA; confirm no change for real visitors                     | Yes                             |
| 5   | **Populate `calendar_days`**                             | M    | New cron, 12-month rolling window, chunked under 120 req/min, watermark deactivation like `sync-listings`                            | Coverage + freshness assertions; verify no 429 burst                              | Yes — also fixes the price feed |
| 6   | **`/agent/v1` read endpoints + OpenAPI 3.1**             | L    | Search, detail, availability, markets; `/.well-known/openapi.json`; `/agent` page; edge rate limits                                  | Contract tests against the spec; column allow-list test; load test                | Yes                             |
| 7   | **`POST /agent/v1/quote` + checkout link**               | M    | Quote passthrough, `checkoutUrl`, agent attribution end to end                                                                       | Quote→link→checkout integration test; attribution lands in GA4 and `reservations` | Yes                             |
| 8   | **Remote MCP server**                                    | M    | Thin adapter over phase 6–7 functions                                                                                                | Tool-call tests                                                                   | Yes                             |

Phases 1–4 are pure discoverability and are worth doing **whatever is decided about the
API**. Phase 5 pays for itself immediately by fixing the empty price feed. Phases 6–8 are
the actual bet, and nothing before phase 6 commits us to it.

#### Measuring success

- **Search Console** — impressions/clicks on listing and market pages; rich-result
  coverage and errors for `VacationRental` (should go from "likely suppressed" to valid
  once `ratingCount` and price are fixed).
- **GA4** — referral traffic from `chatgpt.com`, `perplexity.ai`, `claude.ai`,
  `gemini.google.com` as a dedicated segment. ⚠️ Use **G-8NK72KVMJJ**; the other
  properties are archives.
- **Server logs** — AI crawler hit volume by UA before/after, and cache hit ratio after
  phase 4.
- **Agent-tagged bookings** — count and revenue of reservations carrying the agent
  source. The honest success bar for phase 7 is a single real agent-originated booking;
  everything before that is leading indicators.

---

## Decisions needed

1. **Training crawlers — allow or block `GPTBot`, `ClaudeBot`, `Google-Extended`,
   `Applebot-Extended`, `CCBot`?** My recommendation is allow; obscurity is a bigger
   problem for us than content absorption, and it is reversible. Retrieval bots
   (OAI-SearchBot, Claude-User, PerplexityBot) should be allowed either way.
2. **Do we ask Guesty about re-publishing availability and pricing via a public API?**
   I think we must, before phase 6. Needs someone with the account relationship.
3. **How far to go.** Phases 1–5 (discoverability + the availability cache) are
   low-risk and independently valuable. Phases 6–8 are a genuine product commitment.
   Approve 1–5 now and decide 6–8 after seeing the Search Console movement?
4. **Pricing exposure.** Comfortable publishing "from" nightly rates and day-level
   availability for all 208 listings in a machine-readable form? That is the part a
   competitor would most value.
5. **Partner API keys** — anyone specific asking, or is anonymous + rate limits enough
   for now?
