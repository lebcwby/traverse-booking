# Owner Newsletter — Structure Proposal

**Drafted 2026-08-03.** For review before the template is built.

Audience: **177 active owners / 175 with email (99% coverage)**. Distinct from the ~3,900
Vintory *prospect* owners, who should get different content (see "Prospect variant").

**This is a retention instrument, not a marketing email.** Each active owner is recurring
management revenue, and owner churn is the expensive kind. The newsletter's real job is to
make the management fee feel obviously worth paying — especially in shoulder seasons when
an owner opens their statement, sees a low number, and starts wondering.

---

## Cadence: quarterly, aligned to seasons (not calendar quarters)

Monthly is too often for a 177-owner list and a small team — it creates pressure to
manufacture news, and thin content erodes credibility faster than silence.

Quarterly maps cleanly onto the business's actual seasonality:

| Send | Covers | Why then |
|---|---|---|
| **Early April** | Jan–Mar | Ski season wrap — the biggest revenue quarter is done |
| **Early July** | Apr–Jun | Shoulder + early summer; sets expectations for peak |
| **Early October** | Jul–Sep | Summer wrap — the other big quarter |
| **Early January** | Oct–Dec | Holidays + year in review + year-ahead outlook |

Each lands ~1–2 weeks after quarter close, so figures are final.

---

## Proposed structure

### 1. Opening — the quarter in one number
One or two sentences. Lead with the single most important fact, good or bad. Owners skim;
if the top line is vague they assume you're hiding something.

### 2. Market update
What actually happened in the region: demand, weather/snowpack, events, regulation,
competitive supply. This is the section that positions you as the expert who watches the
market so the owner doesn't have to.
> ⚠️ Needs external input — see Blocker 1. Sourced manually until we have benchmark data.

### 3. Portfolio performance
Occupancy, ADR, RevPAR, booking volume, length of stay — with **year-over-year** context.
Aggregate, and by market (Crested Butte vs Leadville behave very differently).
> ⚠️ Revenue metrics need the financials backfill — see Blocker 2. Occupancy/volume/LOS
> are reliable today.

### 4. How we're outperforming — the direct-booking story ⭐ *added*
**This is your strongest and most under-told owner story.** Every booking shifted from an
OTA to direct saves 15%+ in channel commission, which flows to the owner. Report the direct
share (currently ~7.2% and now supported by a 15.5k-subscriber email programme) and the
commission saved. No other manager in these markets can say this credibly.

### 5. What we did for you this quarter — *added*
The management-value story: inspections completed, maintenance handled, guest issues
resolved, listing/photo/pricing optimisations, reviews earned. Owners see the fee monthly
and the work never — this closes that gap. Concrete counts beat adjectives.

### 6. Guest satisfaction — *added*
Average rating, review count, a standout guest quote about their property or market. Cheap
to produce (16k+ reviews already synced) and it's proof of care.

### 7. Team & company updates
New hires, role changes, systems/technology investments, new markets. Owners want to know
the company is stable and investing — this is quiet churn insurance.

### 8. Looking ahead — next quarter outlook
Booking pace vs the same point last year, plus what you're doing about it. **We can compute
this reliably** (`booked_at` pacing, proven Jul 2026). This is the section that prevents
panicked owner emails in shoulder season: if pace is soft, say so *and* say the plan.

### 9. What we need from you — *added*
The practical close: owner-use calendar blocks for next season, capex/maintenance approvals
pending, tax documents, insurance renewals, licence/permit renewals. Owners genuinely
appreciate a deadline list.

### 10. Referral ask — *added, keep it small*
Owners refer other owners; it's the cheapest acquisition channel and complements the Vintory
outbound. One line at the foot, not a banner.

---

## Personalisation — the biggest opportunity (Phase 2)

A generic portfolio newsletter is fine. **"Your property earned $X at Y% occupancy this
quarter, vs $Z last year"** is dramatically better — it's the number every owner actually
opens the email for.

This is buildable with the same pattern as the guest sync: push per-owner metrics into
Klaviyo profile properties (`owner_q_revenue`, `owner_q_occupancy`, `owner_property_name`,
`owner_yoy_delta`) and merge them into the template.

**Blocked on the financials backfill.** Recommend: Phase 1 aggregate now, Phase 2
personalised once revenue data is populated.

---

## Two blockers to resolve

### Blocker 1 — no market benchmark data
"Performance relative to the market" (the requested section 2) cannot be produced from
internal data. Options:
- **PriceLabs** — already on the roadmap; market dashboards include comp-set occupancy/ADR.
  Cheapest path since it's also wanted for pricing.
- **AirDNA / KeyData** — purpose-built STR market data, additional cost.
- **Interim:** report **year-over-year against ourselves** and label it honestly as such.
  Credible, costs nothing, and is still meaningful to an owner.

### Blocker 2 — revenue data missing from the CRM
`financials_jsonb.hostPayout` is 0% populated for 2023–2025 and 55% for 2026. Guesty holds
the data (`money.hostPayout` per reservation), so this is a **backfill job**, same shape as
the Guesty→Klaviyo sync. Needed for revenue/ADR/RevPAR and for any per-owner personalisation.

---

## Prospect variant (the ~3,900 Vintory owners)

Same market-update and performance sections, different close: instead of "what we need from
you", it becomes "here's what your property could be earning". Reuses most of the content
for the acquisition funnel. Build after the owner version is running.

---

## Decisions — LOCKED 2026-08-09

1. **Cadence** — quarterly, season-aligned (Apr / Jul / Oct / Jan).
2. **Market benchmark** — we have three sources: **PriceLabs (MCP, connectable)**,
   **AirDNA (login only, no API)**, **KeyData**. PriceLabs MCP is the automated path.
3. **Personalisation** — spec below; Nadim reviewing before funding.
4. **Sender & channel** — from **Nadim** personally, via **Klaviyo on a separate owner list**
   (suppressed from all guest campaigns).
5. **Publish the comparison anyway.** Nadim's call: showing a listing against the market is a
   *feature*, not a risk — it forces the improvement conversation, and the goal is that every
   listing beats its comp set. This reframes the newsletter from reporting to **advisory**
   and makes per-listing benchmarking the core value, not a nice-to-have.

---

## Personalisation — how it actually works

### The mechanism
Klaviyo renders **one template per recipient** using custom properties stored on that
recipient's profile. We compute the numbers, push them onto the owner's profile, and the
template merges them at send time. One send → 133 uniquely-rendered emails.

### Step 1 — compute per-owner metrics (quarterly job)
For each owner, for each of their live listings:

| Property | Source | Status |
|---|---|---|
| `owner_first_name`, `listing_name` | CRM `owners` + `listings` | ✅ ready |
| `q_occupancy`, `q_nights`, `q_bookings`, `q_los` | `reservations` | ✅ ready |
| `q_revenue`, `q_adr`, `q_revpar` | `financials_jsonb.hostPayout` | ⚠️ needs backfill |
| `q_revenue_ly`, `q_yoy_pct` | same, prior year | ⚠️ needs backfill |
| `mkt_occupancy`, `mkt_adr`, `mkt_revpar` | **PriceLabs comp set** | ⚠️ needs MCP connected |
| `q_direct_pct`, `q_commission_saved` | `reservations.source` | ✅ ready |
| `q_rating`, `q_review_count` | `reviews` | ✅ ready |
| `next_q_pace_pct` | `booked_at` pacing | ✅ ready |

### Step 2 — push to Klaviyo
Same two-step pattern as the guest sync (`src/lib/klaviyo-guest-sync.ts`):
`profile-bulk-import-jobs` for the attributes, then list membership. Attributes are
overwritten each quarter, so the template always reflects the current period.

### Step 3 — merge into the template
```
Hi {{ person.owner_first_name }},

{{ person.listing_name }} earned ${{ person.q_revenue|format_number }} in Q3
— {{ person.q_yoy_pct }}% vs the same quarter last year.

Occupancy: {{ person.q_occupancy }}%   (market: {{ person.mkt_occupancy }}%)
ADR:       ${{ person.q_adr }}         (market: ${{ person.mkt_adr }})
```

### Step 4 — conditional blocks (this is the part that delivers decision 5)
The *same* email becomes a congratulation or an improvement conversation, automatically:

```
{% if person.q_occupancy > person.mkt_occupancy %}
  Your listing outperformed its comp set by
  {{ person.q_occupancy|minus:person.mkt_occupancy }} points this quarter.
{% else %}
  Your listing ran below its comp set this quarter. We'd like to walk you through
  three changes we think would close the gap — reply and we'll book 20 minutes.
{% endif %}
```

That single block is the strategic centre of the whole newsletter: it converts a passive
report into a booked call, at scale, without anyone writing 133 emails.

### Multi-property owners
~40 owners hold more than one listing. Two options:
- **Recommended:** one email, repeating a per-listing block via a JSON array property.
- Simpler fallback: one email per listing (owners with 4 properties get 4 emails — noisy).

### Coverage — verified 2026-08-09
`listings.primary_owner_id` is **empty for all 191 live listings** (it only holds historical
mappings — a trap worth knowing). The live link is the **`owner_listings` join table**:

- 198 live listing-owner rows, **192 mapped (97%)**
- **136 owners covered; 133 active with a valid email**
- 6 live listings unmapped, and ~42 emailable active owners not linked to a live listing
  → both need a data-cleanup pass before the first personalised send

### Dependencies, in order
1. **`owner_listings` cleanup** — 6 unmapped listings (cheap, do first)
2. **PriceLabs MCP connected** — unlocks every market comparison
3. **`financials_jsonb` backfill** — unlocks all revenue/ADR/RevPAR and YoY

Occupancy, pace, channel mix, direct share and reviews are all computable **today**, so a
personalised newsletter is shippable without (3) — it just omits dollar figures.

---

## Open items

- Connect the **PriceLabs MCP** (Nadim — claude.ai connector settings). Not in Claude's
  connector registry, so it needs adding as a custom server.
- Confirm whether **KeyData** exposes an API (AirDNA is login-only → manual quarterly pull).
- Decide multi-property format (one email vs per-listing).
- Note: an `owner_subscription_preferences` table already exists — check it before building
  any separate newsletter opt-out.
