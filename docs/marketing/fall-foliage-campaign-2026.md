# Fall Foliage Campaign — 2026 (early turn)

**Drafted 2026-08-10.** Draft only — nothing scheduled, nothing sent.

## Why now

Nadim reports the aspens are turning **earlier than expected**. Two things make this urgent:

1. **Median booking lead time is 8–28 days** (verified from `booked_at`, Jul 2026). A send in
   mid-August lands directly on September arrivals. Waiting until September means the color
   window is already closing when the email arrives.
2. **The best foliage weeks are our emptiest weeks.** Verified 2026-08-10:

| Week of | Crested Butte | Leadville |
|---|---|---|
| Sep 14 | 29% | 42% |
| **Sep 21** | **34%** | **40%** |
| **Sep 28** | **16%** | **25%** |
| Oct 5 | 4% | 15% |

84 units per market. The last week of September — typically prime color — is **16% booked**
in Crested Butte. There is a lot of inventory to sell and a short window to sell it in.

## Supersedes the existing draft

Campaign `01KYYQ9QEPQE7KQ7FAWYWY70CT` ("October / Fall Colors — DRAFT, send ~Sept 10-15",
template `YsP6nv`) is now **mistimed and misframed** — it sells October and sends in September.
Repoint it at early-to-mid September and send in **mid-August**. Reuse the campaign, replace
the copy.

---

## Audience: two near-disjoint databases

Verified 2026-08-10 across all past guests:

| Audience | Past guests |
|---|---|
| Leadville only | **12,903** |
| Crested Butte only | **5,124** |
| Both | **51** |
| Other markets | 2,511 |

**51 guests out of ~18,000 have stayed in both towns.** These are not overlapping segments —
they are two separate audiences sharing one list. Leadville is 2.5× the size of Crested
Butte, which is easy to underestimate.

That makes a single generic email the wrong call. Each guest should see their own town in
the subject line, not in paragraph four.

### ✅ No code change needed — the data is already there
`klaviyo-guest-sync.ts` already writes **`guesty_markets`** (an array of city names), and it
is confirmed populated on live profiles — e.g. `guesty_markets: ["Crested Butte"]` alongside
`guesty_last_stay`, `guesty_stay_count`, `guesty_booking_sources`, `guesty_total_value`.

### Segment recipes (build in the Klaviyo UI — no segment API)
- **CB Fall** — `guesty_markets` contains `Crested Butte` AND does not contain `Leadville`
- **Leadville Fall** — `guesty_markets` contains `Leadville`
- Both AND: `guesty_next_checkin` is not set OR is before today (excludes guests who have
  already booked a fall stay)
- Then split each by `guesty_last_stay` recency for the warming rungs

---

## Email copy — variant A: Crested Butte

**From:** Traverse Hospitality · hello@booktraverse.com

**Subject:** The aspens on Kebler Pass are turning early
**Preview:** A cool, dry August has the color running ahead of schedule — and late September
is still wide open.

> **Kebler Pass is about to go gold — earlier than usual.**
>
> Every autumn, one of the largest aspen groves in North America turns all at once, and the
> road over Kebler becomes a tunnel of gold for miles. It's twenty minutes from town and
> it's the best foliage drive in Colorado. We're not neutral about this, but we're also not
> wrong.
>
> This year a cool, dry August has the color running ahead of schedule. We're expecting peak
> **mid-to-late September** rather than the usual end of the month.
>
> If the drive isn't enough: Ohio Pass and Washington Gulch are quieter and just as good, and
> the aspens along Gothic Road turn a week or so after the high country.
>
> **The best weeks are still open.**
> Late September is normally the hardest week of the fall to book in Crested Butte. This year
> it's still wide open — but people book fall trips two to four weeks out, so that changes
> quickly.
>
> [**See what's available in Crested Butte →**]
>
> Booking direct means no third-party service fees, and you're talking to the local team that
> actually manages the home.
>
> See you in the gold,
> **The Traverse Team**

---

## Email copy — variant B: Leadville

**From:** Traverse Hospitality · hello@booktraverse.com

**Subject:** Leadville turns first — and it's early this year
**Preview:** At 10,152 feet the aspens go before anywhere else in Colorado. Peak looks like
mid-September.

> **The highest city in North America turns first.**
>
> At 10,152 feet, Leadville's aspens go gold before anywhere else in Colorado — and this
> year, a cool and dry August has them running ahead of schedule. We're expecting peak around
> **mid-September**.
>
> Independence Pass is the drive everyone knows, and it earns it. But the quieter ones are
> better: the shoreline at **Turquoise Lake**, where gold aspens sit under the Sawatch peaks
> with the first snow already on them, and **Hagerman Pass** if you have the clearance for it.
>
> If you'd rather walk it than drive it, the **Mineral Belt Trail** loops 11.6 paved miles
> right out of town, straight through the aspens. It's the easiest good decision you'll make
> all weekend.
>
> **There's real availability — for now.**
> Mid-to-late September still has genuine choice across our Leadville homes, which is not
> usually true this close in. Fall trips get booked two to four weeks out, so this window is
> short.
>
> [**See what's available in Leadville →**]
>
> Booking direct means no third-party service fees, and you're talking to the local team that
> actually manages the home.
>
> See you up high,
> **The Traverse Team**

### Notes on the copy
- Every scarcity claim is backed by the occupancy table — nothing invented.
- Each variant leads with a landmark that market genuinely owns: **Kebler Pass** (a real
  superlative nobody else markets on) and **Leadville turning first** (a straightforward
  consequence of elevation, and a good reason to book *now* rather than late September).
- The secondary spots (Ohio Pass, Washington Gulch / Turquoise Lake, Hagerman, Mineral Belt)
  do real work — they signal local knowledge, which is the whole pitch of booking direct.
- **Open question: do we discount?** Oct 5 week is 4% booked in CB. A 15% "early color" offer
  on Sep 28–Oct 12 would move otherwise-dead inventory. Not included — it's an owner-revenue
  decision and Nadim's call.

---

## Deliverability is fine — the problem is engagement

⚠️ **A theory recorded here earlier was wrong and is corrected below.** `booktraverse.com`
publishes `DMARC p=reject`, and I inferred from that plus a failed DNS lookup that Klaviyo
mail was being rejected outright. **It is not.** The domain is authenticated (Klaviyo status:
*warming*); the lookup failed only because the sending subdomain has a different name than
the ones probed.

**Win-back campaign actuals — sent 2026-07-30, 214 recipients:**

| Metric | Result | Read |
|---|---|---|
| Delivery rate | **99.1%** (212/214) | Excellent — not a deliverability problem |
| Bounces | 2 (0.93%) | Healthy for a first send to aged contacts |
| Spam complaints | **0** | Clean |
| Open rate | **67.5%** | Excellent (some Apple MPP inflation) |
| **Click rate** | **0.94%** (2 clicks) | ⚠️ Click-to-open ≈1.4% vs 10–15% normal |
| Unsubscribes | 5 (2.3%) | ⚠️ ~5× a healthy rate |
| **Bookings** | **0** | — |

**The subject line works; the body does not.** People open and then don't act. That is the
single most important input to the foliage campaign:

- Put **real listings — photo, nightly price, town** — in the email. Not one generic
  "see what's available" link.
- **Repeat the CTA near the top**, not only at the foot.
- Deep-link into a **date-filtered search** so the click lands on availability, not the
  homepage.
- The 2.3% unsubscribe rate says list fatigue is real on aged contacts — which is an argument
  for the batch ladder below, and against a second follow-up send to non-openers.

### Still verify before a 15.5k send
Confirm the exact branded sending subdomain in Klaviyo → Settings → Domains & Hosting, and
check its CNAMEs resolve. Nothing resolves at `email.` / `send.` / `mail.` / `em.` /
`marketing.` / `news.` / `klaviyo.` `.booktraverse.com` (checked against GoDaddy's own
nameserver `ns52.domaincontrol.com`), so the live name is something else.

Keep `DMARC p=reject` as-is — it protects the domain from spoofing and is not causing a
problem.

---

## Send timing — derived from booking behaviour (2026-08-30)

**Not from open rates.** One campaign, 143 opens, heavily Apple-MPP-inflated — no usable
day/time signal. Booking events are both a larger sample and the actual conversion.

⚠️ **`booked_at` is `timestamptz`.** Use `booked_at AT TIME ZONE 'America/Denver'`. Doing
`AT TIME ZONE 'UTC' AT TIME ZONE 'America/Denver'` double-shifts by 6h and produces a fake
curve that peaks at 3am — it looks plausible in a table and is completely wrong.

### Best day — Sunday or Monday
Direct bookings only (`website` + `BE-API`, n=919, 24 months):

| Sun | Mon | Tue | Wed | Thu | Fri | Sat |
|---|---|---|---|---|---|---|
| **16.1%** | **16.0%** | 13.8% | 13.3% | 14.7% | **12.0%** | 14.1% |

Sunday and Monday lead; **Friday is the worst day**. Spread is modest and the sample is small,
so treat this as "favour Sun/Mon, avoid Fri" rather than a precise ranking.

### Best time — land by mid-morning
Direct bookings run a broad plateau **9am–9pm MT**, peaking at **5pm (7.8%)** with a midday
shoulder (12pm 7.1%, 3pm 7.2%). All 15,251 bookings show the same shape, peaking 7–8pm.

Send **~10:00am recipient-local time**. That buys the full 9am–9pm booking runway rather than
betting on the single 5pm spike, and email is typically opened within an hour or two of
arrival. Use Klaviyo's **local-time delivery** (`send_strategy.options.is_local`) so 10am
means 10am for each recipient — the list spans several time zones.

### The dates are forced by the calendar
Median booking lead time is **8–28 days**. As of 2026-08-30:
- Leadville target **Sep 18–21** → 19 days out — **squarely in the window now**
- Crested Butte target **Sep 25–28** → 26 days out — in the window, marginally early

**Leadville is the more urgent of the two** and also the larger audience (12.9k vs 5.1k), so
run it a rung ahead.

### Proposed schedule (Labor Day 2026 = Mon Sep 7)

| Date | Day | Rung | Size |
|---|---|---|---|
| Mon Aug 31 | Mon ✅ | 1 | 500 |
| Wed Sep 2 | Wed | 2 | 1,500 |
| Thu Sep 3 | Thu | 3 | 3,000 |
| *Sep 4–7* | *Fri + Labor Day wknd* | — | *hold* |
| Tue Sep 8 | Tue | 4 | 5,000 |
| Thu Sep 10 | Thu | 5 | ~5,500 |

Holding Fri Sep 4 through Labor Day: Friday is the weakest booking day and holiday-weekend
sends usually under-engage. Finishing Sep 10 still puts the last rung **8 days** before the
Leadville weekend and 15 before Crested Butte — inside the lead-time window for both.

If the domain warming forces smaller steps, stretch the tail rather than the head: rungs 1–3
are the time-critical ones.

---

## Batch plan

The list is ~15.5k, and **only ~215 profiles have ever been sent a campaign** (win-back
Tier 1). The rest is a cold, imported list going back years. A single blast would produce a
bounce spike and spam complaints, which is exactly how a sending domain gets blacklisted.

So we warm it in a ladder, ordered **most recent stay first** — recent guests are the most
likely to have live addresses and to engage, which builds positive reputation early.

Each rung is **split by market** — same day, two sends, each with its own variant. Total
daily volume is what builds reputation, so splitting costs nothing on the warming curve
while roughly tripling relevance.

| Rung | Recency tier | Total | ≈ Leadville | ≈ CB | Day |
|---|---|---|---|---|---|
| 1 | Stayed within 12 months | 500 | 360 | 140 | Day 1 |
| 2 | Stayed within 12 months (rest) | 1,500 | 1,070 | 430 | Day 3 |
| 3 | Stayed 12–24 months | 3,000 | 2,150 | 850 | Day 5 |
| 4 | Stayed 24–36 months | 5,000 | 3,570 | 1,430 | Day 7 |
| 5 | Remainder | ~5,500 | ~3,930 | ~1,570 | Day 9 |

Split at the observed 71/29 Leadville:CB ratio. Ten sends total; I can clone the campaign
per rung/market via API once the segments exist.

Roughly 9 days end-to-end, finishing well before the color window closes.

### Gates between batches — stop and diagnose if any of these trip
- **Bounce rate > 2%** → stop; the list needs cleaning before continuing
- **Spam complaints > 0.1%** → stop; this is the metric that gets domains blocked
- **Open rate < 15%** → pause; likely landing in spam already

### Suppressions
- Anyone with a **future `guesty_next_checkin`** — don't sell a fall stay to a guest who has
  already booked one. (Property already exists from the guest sync.)
- Win-back Tier 1 recipients (`T3usyy`) if their send was within the last 14 days, to avoid
  fatiguing the only warm cohort we have.

### Implementation note
Klaviyo has no API for building segments — the market × recency tiers must be created in the
UI from `guesty_markets` and `guesty_last_stay`. Campaigns and templates *are* API-creatable,
so once the segments exist the rest is scriptable.

---

## 🔔 RUNG 2 — FALL REMINDER (built 2026-09-08, scheduled Wed 2026-09-09 10am local)

| Market | Campaign | Segment | Excludes | Template | Segment size |
|---|---|---|---|---|---|
| Leadville | `01M216GCRHFWTJ87V3DSS2B37T` | `RktPb8` | `Tc8KQF` | `TATeFq` | 1,875 |
| Crested Butte | `01M216GF1R3WYX83TM3JH6KCGP` | `UL55vi` | `VfYUuX` | `XRXyye` | 931 |

Both **Draft**, templates attached, from **"Nadim at Traverse Hospitality"**
`<hello@booktraverse.com>`, UTM tracking on, send strategy
`static / is_local: true / 2026-09-09T10:00`. Rung-1 recipients are excluded at campaign
level, so net send ≈ **1,264 LV + 666 CB ≈ 1,930**.

Sources: `docs/marketing/templates/fall-reminder-{leadville,crested-butte}.html`

### ⚠️ Klaviyo REST revision `2024-10-15` differs from the MCP connector's
Two shapes bit us when creating campaigns directly over REST (the MCP uses a newer revision):
- campaign-message attributes are **flat** — `channel` + `content` at the top level, *not*
  wrapped in `definition`
- send strategy uses **`options_static`** (`{datetime, is_local, send_past_recipients_immediately}`),
  not `datetime` + `options`

### Segment creation is REST-only
The Klaviyo MCP connector exposes `get_segment`/`get_segments` but **no create tool**, so
segments must be made either in the UI or via `POST /api/segments` with a key carrying
`segments:write`. The condition-group JSON that works:

```
condition_groups: [                      # groups are AND-ed
  [ markets contains "Leadville" ],
  [ last_stay after  2025-06-08 ],
  [ last_stay before 2025-11-13 ],
  [ next_checkin not-set, next_checkin before today ]   # 2 conditions in ONE group = OR
]
```

### 🚨 Assigning a template CLONES it — editing the source does nothing
`POST /campaign-message-assign-template` copies the template into the campaign
(`"Clone of TATeFq"`). The campaign then renders **its clone**, not the source. So a later
`PATCH /templates/{source}` silently has no effect on the campaign, and the Klaviyo preview
keeps showing the old copy — exactly how the withdrawn pricing line survived into the
scheduled Leadville campaign and was only caught by eye.

The clone is **not patchable** either — it doesn't exist in the `/templates` collection
(404). **The fix is to re-assign the corrected source template**, which re-clones it.

✅ **Always verify against the campaign message, never the source template:**
`GET /campaign-messages/{id}/template` → check the html actually contains your change.

### ⛔ A/B variations are UI-only
`POST /campaigns` with two entries in `campaign-messages` returns
`"Only a single campaign-message may be provided"`. There is no endpoint to add a variation
to an existing campaign either. A/B setup must be done by hand in the campaign editor.

### ✅ A/B: plain vs designed — TRUE 50/50, no auto-winner

| Variant | Leadville | Crested Butte |
|---|---|---|
| **A — plain text** (from Nadim, no images) | `TATeFq` | `XRXyye` |
| **B — designed** (navy header, photo cards) | `Tycu6q` | `Yit5Ze` |

**Both variants say exactly the same thing** — same listings, prices, dates, arguments, sign-off.
Only the format differs, so the test isolates format alone.

⚠️ **Set the test group to 100% of the audience in the Klaviyo UI.** The default is ~10% test
/ 90% winner, which is what destroyed the rung-1 subject-line test (winners picked off 26–61
recipients). At 100% it's a genuine 50/50 with no winner phase.

At ~965 per arm this detects roughly a 3× difference, not a 1%→2% move — so treat it as
directional and pool with rung 3 for a firmer read. **An underpowered clean test still beats
the confounded alternative**: comparing rung 2 against rung 1 would vary audience (345–389 vs
300–456 days) and calendar week at the same time as format, so any difference would be
uninterpretable.

### ⚠️ Never publish the pricing mechanism
An early draft of the Leadville copy read *"our rates come down as a date gets close and the
house is still empty."* True, but it teaches guests that **waiting is rewarded** — it trains
the exact behaviour that erodes lead time and ADR. Cut before send.

Replaced with a per-person framing, which is compelling and reveals nothing about strategy:
the Governor's Mansion is **$36/person/night** across 14 people, the Ice Palace $29, the
Rosemont $27. Urgency now comes from the colour window, not the price.

### Format change: plain-text style, from Nadim
Rung 1 proved the constraint is *real opens*, not design. These are minimal — no images, no
buttons, one column, system font, signed by Nadim personally. Cheap to produce and it reads
like a note rather than a newsletter.

**No A/B this time — deliberately.** At ~450 per market a 50/50 split gives ~225 per arm;
detecting a move from 1% to 2% click rate needs thousands per arm. Instead this is a
*sequential* test: the designed format now has two data points (win-back and rung 1, both
~1.4–1.7% click-to-open), so the whole of rung 2 goes plain and we compare against that
baseline. Underpowered either way, but it doesn't waste half the audience on a known quantity.

### ⚠️ Everything had to be re-quoted — 4 of 6 rung-1 listings had sold
Checked 2026-09-08: **all three Crested Butte** homes and one Leadville home from rung 1 were
gone. Prices on the survivors had also **fallen sharply** as dynamic pricing discounts unsold
fall inventory:

| Listing | Aug 30 | Sep 8 |
|---|---|---|
| Governor's Mansion | $2,065 | **$1,506** (−27%) |
| The Rosemont | $878 | **$734** (−16%) |

That price drop is now a genuine, honest hook in the Leadville copy.

### The calendar forced a different pitch per market
- **Leadville Sep 18–21** — 9 homes genuinely available. Straight "the aspens turned, come now".
- **Crested Butte Sep 25–28** — only **3** homes bookable for a 3-night stay. Far tighter than
  the 24% weekly occupancy implies, because weekend nights book heaviest. Too thin to point
  668 people at, so the CB email leads with that real scarcity and redirects to **Oct 2–5**,
  which is 3–5% booked with 7+ homes open.

### ⚠️ Two gotchas hit while building this
- **`/api/quotes/batch` caps at 10 lines** ("Too many cart lines"). Split larger checks.
- **`NOT IN (subquery)` returns nothing if the subquery contains a NULL.** An availability
  query using `listing_id NOT IN (...)` silently returned zero rows because one reservation
  had a null `listing_id`. Use `NOT EXISTS`.

### Segments to build (UI — no segment API)
Window: `guesty_last_stay` **after Jun 8, 2025** AND **before Nov 13, 2025** (300–456 days).
Remember: **separate condition blocks = AND**, stacked in one block = OR.

1. `guesty_markets` contains the text `Leadville` *(or `Crested Butte` + doesn't contain `Leadville`)*
2. AND `guesty_last_stay` **after** `Jun 8, 2025`
3. AND `guesty_last_stay` **before** `Nov 13, 2025`
4. AND ( `guesty_next_checkin` **is not set** **OR** **before** today )

Rung-1 recipients are excluded at the *campaign* level via `audiences.excluded`
(`Tc8KQF` / `VfYUuX`) rather than in the segment — simpler and avoids a fifth condition.

Expected ≈ **1,346 Leadville / 668 CB** (CRM counts; Klaviyo will show fewer).

---

## 📊 RUNG 1 RESULTS — analysed 2026-09-06 (7 days post-send)

| Metric | Leadville | Crested Butte | Combined |
|---|---|---|---|
| Recipients | 610 | 265 | **875** |
| Delivered | 605 (99.2%) | 262 (98.9%) | 867 (99.1%) |
| Bounced | 5 (0.82%) | 3 (1.13%) | 8 (0.92%) |
| Spam complaints | **0** | **0** | **0** |
| Opens (reported) | 293 (48.4%) | 141 (53.8%) | 434 (49.6%) |
| **Clicks** | **5 (0.83%)** | **2 (0.76%)** | **7 (0.80%)** |
| Unsubscribes | 14 (**2.31%**) | 3 (1.15%) | 17 (1.94%) |
| **Bookings** | **0** | **0** | **0** |

**Gates: all passed** — bounce 0.92% (<2%), complaints 0% (<0.1%). The domain and the
warming worked. Nothing here blocks rung 2.

### ❌ The redesign did NOT improve click-through
| | Win-back (Jul 30) | Fall foliage (Aug 30) |
|---|---|---|
| Click rate | 0.94% | **0.80%** |
| Click-to-open | ~1.4% | 1.4–1.7% |
| Bookings | 0 | **0** |

Real listing cards, above-the-fold CTA, date-filtered deep links, market segmentation and
anniversary targeting produced **no lift**. Two campaigns, ~1,100 recipients, 12 clicks total,
zero attributable bookings. The "fix the body" diagnosis was wrong.

### ⭐ Why: the open rate is mostly machines
`Opened Email` events Aug 30 – Sep 7, grouped by Client Name:

| Client | Events | Share |
|---|---|---|
| **(blank)** | 442 | **71%** |
| Gmail image proxy | 127 | 21% |
| Chrome | 39 | 6% |
| Mobile Safari / Android / Apple Mail | 10 | 2% |

A 71% blank-client share is the signature of automated prefetch (Apple MPP and security
scanners), which Klaviyo can't attribute to a real client. So the true human open rate is
plausibly **~15–17%, not 49%** — and click-to-open on *real* opens is roughly **5%**, which is
mediocre rather than catastrophic.

**This reframes the problem.** The binding constraint isn't the email body — it's how few
people genuinely open. Levers are the subject line, the sender, and audience intent. Design
effort past "clean and fast" has low marginal return.

⚠️ It also means **the "pause if open rate < 15%" gate is meaningless** while opens are
MPP-inflated. Judge on clicks and bookings.

### ❌ The A/B test taught us nothing
Klaviyo ran test-then-winner, not 50/50, and picked winners off tiny samples:

| | Variation A | Variation B |
|---|---|---|
| Leadville | 61 sent, 55.7% open, 0 clicks | **549 sent**, 47.6% open, 5 clicks |
| Crested Butte | **239 sent**, 53.4% open, 2 clicks | 26 sent, 57.7% open, 0 clicks |

It chose B for Leadville and A for Crested Butte from test groups of 61 and 26 — pure noise.
In both cases the small test group then *out-opened* the "winning" variation.

**Rule going forward: under ~2,000 recipients, use a true 50/50 split with no auto-winner, or
don't A/B at all.**

### Other signals
- **Leadville unsubscribes ran 2× Crested Butte** (2.31% vs 1.15%). Both are above a healthy
  0.1–0.5%. Re-sending to the same rung-1 people carries real fatigue risk.
- **23 direct bookings** landed in the 7 days after the send (13 for foliage dates), including
  one Leadville website booking **28 minutes** after it went out. Klaviyo attributed none of
  them. `Booked Reservation` (`SuqpZn`) *is* firing — 21 events that week — so this is a
  genuine zero, not a tracking gap. Direct booking is happening; the email isn't causing it.

---

## 🚀 Rung 1 — SENT 2026-08-30

| Market | Campaign ID | Segment | Size |
|---|---|---|---|
| Leadville | `01M1AF4KNWNJA02RP3SN6PJV30` | `Tc8KQF` | **611** |
| Crested Butte | `01M1AF5B8S9VGEDEX50VRG3W35` | `VfYUuX` | **265** |

Both Draft, templates attached, UTM tracking on. **876 total.**

### Targeting: the anniversary cohort, not recent stayers
Nadim's call, and the data backs it. Repeat-booking intervals spike hard at **360–374 days**
(174 bookings, ~4× the neighbouring buckets); by 390+ it's back to baseline. So rung 1 targets
`guesty_last_stay` between **Aug 5 and Sep 19, 2025** — 345–389 days ago.

Two things align there: it's the anniversary rebooking window *and* those guests stayed in
late summer / early autumn last year, so they already like Colorado at this exact time of year.

**The original recency-first ladder was wrong.** Its premise was that fresher addresses
deliver better — but the win-back went to a 360–540-day cohort and got **99.1% delivery, 0
spam complaints, 67.5% opens**. Year-old addresses on this list are fine, so ordering by
intent beats ordering by recency.

Revised ladder: 345–389d → 300–450d → 180–540d → everything else.

### ⚠️ Two Klaviyo segment traps (both bit us)
1. **Conditions stacked in ONE block are OR'd; separate blocks are AND'd.** Both date rules
   in one block gave `after Aug 4 OR before Sep 20` = everyone → 9,695 of 12,954 Leadville
   profiles. It looks like a working segment. Always sanity-check the count against expected
   population size.
2. **`guesty_next_checkin` is never cleared.** The sync writes it only when a future check-in
   exists (`...(g.nextCheckIn ? {...} : {})`) and never nulls it, so stale past dates persist
   forever. `is not set` alone therefore excludes anyone who *ever* had a booking — 450 → 103.
   The rule must be `is not set` **OR** `before today`.
   → **Fix worth making:** have the sync write `guesty_next_checkin: null` when absent. Also
   means the **Win-Back Tier 1 segment is under-counting** (it uses `not-set` alone).

---

## Templates — BUILT 2026-08-30

| Market | Klaviyo template | Source of truth |
|---|---|---|
| Crested Butte | **`Yk6VXg`** | `docs/marketing/templates/fall-foliage-crested-butte.html` |
| Leadville | **`RELc44`** | `docs/marketing/templates/fall-foliage-leadville.html` |

Both carry the three fixes the win-back data called for: **real listing cards** (photo, size,
exact price), **CTA above the fold** and repeated, and **date-filtered deep links** so a click
lands on live availability rather than the homepage.

Featured homes are verified available for the target weekend, and every link was checked
(200 + correct listing rendered + dates prefilled in the search bar).

- **Crested Butte, Sep 25–28:** Black Bear 204 ($2,350) · Hot Tub Condo ($1,673) · 1BR Pool &
  Hot Tub ($1,199)
- **Leadville, Sep 18–21:** Governor's Mansion ($2,065) · The Rosemont ($878) · Loft Home
  ($1,000)

### ⚠️ Pricing trap — do not use `nightlyFrom` for date-specific marketing
The `listing_pricing_cache` in `kv_store` samples **one window chosen by the cron**, not the
dates you are promoting. For these foliage weekends the cached "from" prices were **2–4× too
low**:

| Listing | Cached `nightlyFrom` | Real all-in, 3 nights |
|---|---|---|
| Black Bear 204 | $195/nt | **$2,350** |
| Governor's Mansion | $346/nt | **$2,065** |
| The Rosemont | $154/nt | **$878** |

Shipping those would have been a bait-and-switch against the very page the email links to.

**Use `POST /api/quotes/batch`** (public, used by the cart) for exact figures on specific
dates. Verified: it returns precisely what the property page renders — `cb1` $2,350 and `lv1`
$2,065 both matched the live page exactly.

Cards now show **all-in totals** rather than a nightly rate. That is more honest, matches the
click destination, and leans on the no-fees positioning.

⚠️ **Re-quote before sending.** These prices are live and will drift. Re-run the batch quote
on send day and update both templates if anything moved.

---

## DNS reference (checked 2026-08-10)

```
SPF    v=spf1 include:dc-aa8e722993._spfm.booktraverse.com ~all
DMARC  v=DMARC1; p=reject; adkim=r; aspf=r; rua=...onsecureserver.net
```

`p=reject` with **relaxed alignment** (`adkim=r`) means DKIM signed by any
`*.booktraverse.com` subdomain still aligns with a `hello@booktraverse.com` From address — so
the branded subdomain gives reputation isolation from the Resend transactional path while the
From address stays unchanged. That is the correct setup and it is already working.

---

## Sequence

1. Confirm the branded sending subdomain name + that its CNAMEs resolve
2. Decide the discount question
3. Build market × recency segments in the Klaviyo UI
4. Create the two market templates — **with real listings, prices and a date-filtered CTA**
   (see the engagement finding above; this is the highest-leverage change)
5. Send rung 1 (both markets), check gates at 24h, proceed down the ladder

## Housekeeping
✅ **Done 2026-08-30** — the four test profiles (`ngtannous+kvtest1`, `+kvtest3`, `+kvfix-old`,
`+kvfix-new`) were suppressed via bulk job `01M188Z8D95GXPN88R3PRSP937` (4/4, 0 skipped).
Note the Klaviyo API has no true profile delete — suppression stops sends and is reversible;
permanent deletion is UI-only or via a data-privacy request.
