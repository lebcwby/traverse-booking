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

## Open decisions for Nadim

1. **Cadence** — quarterly (recommended) or monthly?
2. **Market benchmark** — buy PriceLabs/AirDNA, or ship with honest YoY-vs-ourselves?
3. **Personalisation** — worth funding the financials backfill for Phase 2?
4. **Sender & channel** — from Alex/Nadim personally or "Traverse Hospitality"? Klaviyo
   (separate owner list, suppressed from guest campaigns) or direct/BCC?
5. **Anything deliberately excluded?** e.g. some managers avoid publishing portfolio-wide
   occupancy because owners compare themselves to the average and complain.
