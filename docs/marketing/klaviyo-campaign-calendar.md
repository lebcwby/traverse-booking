# Campaign Calendar & Cadence

**Written 2026-07-30.** Companion to `klaviyo-annual-plan.md` (strategy) and
`klaviyo-flow-setup.md` (flows). This one covers **campaigns** — the recurring sends
that re-engage the 15,522-person database.

---

## The two rules that drive everything

### Rule 1 — Plan backward from BOOKING lead time, not the stay date

Measured from **`reservations.booked_at`** (the real booking timestamp), stays since
2024-01-01, n = 421–2,524 per month:

| Stay month | n | Median lead | p75 | | Stay month | n | Median lead | p75 |
|---|---|---|---|---|---|---|---|---|
| Jan | 1,307 | 13 d | 42 | | Jul | 2,524 | 20 d | 55 |
| Feb | 1,647 | 19 d | 44 | | Aug | 1,866 | **28 d** | 90 |
| Mar | 1,885 | 23 d | 58 | | Sep | 1,307 | 15 d | 61 |
| Apr | 605 | 12 d | 31 | | Oct | 673 | 8 d | 34 |
| May | 860 | 16 d | 43 | | Nov | 421 | 9 d | 21 |
| Jun | 1,661 | 16 d | 49 | | Dec | 940 | 21 d | 54 |

> ⚠️ **Corrects an earlier version of this table.** The first pass used `created_at`, which
> is the CRM *sync* date for backfilled rows — it produced nonsense like "September = 93-day
> median lead". `booked_at` is populated on 98% of reservations back to 2019; use it.

**This is a short-lead business in every month — median 8–28 days, p75 21–90.** There is no
long-planning season. Promote a window **2–6 weeks before the stay dates**, and treat the
p75 as the outer edge worth reaching.

**The one exception is races** (see below), where the decision anchors to a registration
date rather than travel planning, and a 6–9 month lead is genuinely correct.

### Rule 2 — Fill the troughs, don't shout into the peaks

Bookings by check-in month: **Jul 2,316 · Jun 1,660 · Mar 1,509 · Aug 1,433 · Feb 1,348**
… **Oct 551 · Apr 521 · Nov 296**.

July fills itself. **Apr, Oct and especially Nov (296) are where email actually moves the
needle** — put the creative effort there.

---

## Your unfair advantage: a real event calendar

17 events already in `sp_events`. These are far better campaign anchors than generic
holidays, because they give people a *reason with a date*.

### Leadville is a race town — treat it as its own audience
| Event | Date |
|---|---|
| Trail 100 MTB Camp | Jun 11–14 |
| Trail 100 Run Camp | Jun 19–21 |
| Trail Marathon & Heavy Half | Jun 27 |
| Silver Rush 50 Run / MTB | Jul 11 / Jul 12 |
| MTB Stage Race | Jul 24–26 |
| **Leadville Trail 100 MTB** | **Aug 15** |
| Trail 10K Run | Aug 16 |
| **Leadville Trail 100 Run** | **Aug 22** |
| Boom Days | first weekend of August |
| Ski Joring | first weekend of March |

**Why this matters:** racers register months ahead, travel with crews/families (bigger
homes, longer stays), and **come back every year**. This is the most predictable,
highest-intent audience in the database — and it explains the August spike.

- Send race-lodging campaigns **3–5 months ahead**, not 3 weeks — the lead-time rule above
  doesn't apply here, because the booking decision is anchored to registration.
- Segment: `guesty_markets` contains **Leadville** + past stay in **June–August**.
- A "you raced with us last year — same week next year?" email to prior race-week guests
  should be one of the highest-converting sends you ever do.

### Crested Butte is a festival town
| Event | Date |
|---|---|
| **Wildflower Festival** | **Jul 10–19** |
| Music Festival | late Jun – Jul |
| Beer & Chili Festival | Sep 12 |
| Film Festival | Sep 24–27 |
| Vinotok | late Sep (equinox week) |
| Big Air on Elk | March |

**Wildflower is proven demand** — the blog guide pulled **249 views, 39% of all blog
traffic**. That's an audience telling you what it wants. The Sep events (Beer & Chili,
Film, Vinotok) are the lever for the **Sep→Oct shoulder**.

---

## The calendar

**Cadence: 2 sends/month.** One seasonal/promotional + one content/value. Resist more —
a young list burns out fast, and you're on a domain with almost no sending history.

| Month | Send 1 (seasonal) | Send 2 (content) | Fills |
|---|---|---|---|
| **Jan** | Ski season + President's week urgency | Altitude/first-timer ski guide | Feb–Mar |
| **Feb** | Late-season ski value; spring break | Where locals eat in CB | Mar–Apr |
| **Mar** | ⚠️ **Mud-season / long-stay offer** · Ski Joring · Big Air | Ski Joring explainer | **Apr trough** |
| **Apr** | Summer opens + **race-lodging (3–5mo ahead)** | Wildflower preview | Jun–Aug |
| **May** | Wildflower Festival + early summer | Leadville trail guide | Jun–Jul |
| **Jun** | July 4th + peak-week last chance · Silver Rush | Wildflower field guide | **Jul peak** |
| **Jul** | Late summer + **Leadville 100 race week** | Fall foliage preview | Aug |
| **Aug** | September shoulder · Beer & Chili · Film Fest | Fall colors guide | **Sep** |
| **Sep** | ⚠️ **Fall value** + early-ski-booking incentive | Vinotok explainer | **Oct trough** |
| **Oct** | ⚠️ **Thanksgiving push** + opening-day ski | Winter packing guide | **Nov trough (296!)** |
| **Nov** | Holiday availability + New Year's | Christmas in the mountains | Dec–Jan |
| **Dec** | Powder season · MLK / President's weekends | Year in review / thank you | Jan–Feb |

**Holiday sends worth their own slot:** Thanksgiving (booked ~Oct), Christmas/New Year
(booked ~Nov), MLK + President's weekends (booked ~Dec–Jan), July 4th (booked ~Jun),
Labor Day (booked ~Aug).

---

## ▶ READY TO SEND: Leadville fall shoulder (template `X7ddTt`) ⭐

**Built 2026-07-30. The single biggest unsold-inventory window in the portfolio.**

### The occupancy data that reframed this

Measured against the **85 authoritative active Leadville listings** (guesty_ids pulled from
the BE-API mirror — an earlier CRM-side join was noisy and overstated the listing count):

| Window | Occupancy | Homes empty **per night** |
|---|---|---|
| Race nights (Aug 15 MTB, Aug 22 Run) | **80–84%** | ~15 |
| Aug 16–19 (between the races) | 28–44% | **~60** |
| Aug 24–31 | 21–44% | **~48–67** |
| Sept 1–14 | 24–45% | **~47–65** |

**Race weekends are effectively sold out** — 80–84% is a practical ceiling once owner
blocks, maintenance and min-stay mismatches are accounted for. Chasing the last ~15 rooms
is not where the money is.

**The real opportunity is post-race:** roughly **50–65 homes sit empty every night for
three-plus weeks** from Aug 24 into mid-September. That is an order of magnitude more
unsold inventory than race weekend, and it recurs every year.

### The campaign

**Angle: not racing at all — the fall shoulder.** Golden aspens from mid-September, 60s–70s
hiking weather, empty trails, the 14ers after monsoon season and before snow. "The best
time to be here is the part nobody books."

- **Template `X7ddTt`** · Subject: *"The best time to be in Leadville is the part nobody books"*
- **Audience:** Leadville guests (11,544 in CRM) and/or summer guests (4,480). This is a
  broad-appeal send, not a niche one — widen beyond racers.
- ⚠️ **Exclude** anyone with `guesty_next_checkin` set.
- **Timing:** send now — and the corrected data says the timing is *good*, not late.
  September stays have a **15-day median lead (p75 61)**, so at 30–45 days out this lands
  right at the front of the booking window. Consider a second send ~2 weeks later to catch
  the median bookers.
- Conversion metric: **Booked Reservation** (`SuqpZn`).

### The race template (`XLmLGA`) — send it in NOVEMBER, not spring

Still well-written, but its premise ("still need a house for the 100?") is wrong for 2026 —
race weekend is already full. The measured booking curve says exactly when to use it.

**Race-week bookings (Aug 10–26) by month booked:**

| Booked | 2024 race | 2025 race | 2026 race |
|---|---|---|---|
| Oct | 3 | 3 | 6 |
| **Nov** | 4 | 2 | **15** |
| **Dec** | **9** | **12** | **14** |
| **Jan** | **8** | **9** | **16** |
| Feb–Jun | 30 | 79 | 58 |
| **Jul** | 25 | 57 | **55** |
| Aug (race month) | 115 | 113 | — |

**There is a real, repeatable Nov→Jan planning wave** — consistent with the Leadville lottery
/ registration cycle — and it is **growing**: 45 bookings in Nov–Jan for the 2026 race vs 23
for 2025. It now begins in **November**, not January.

**Three sends, not one:**
1. **Early-to-mid November** — get *in front* of the wave rather than chasing it. ⭐ the key send.
2. **Early January** — catches lottery-result decisions.
3. **Mid-June** — ahead of the July surge (~55 bookings).

Pair send #1 with a *"you raced with us last year — same week again?"* angle to the **464
prior race-week guests** (stayed Aug 10–26 in 2024/2025). They already know the drill and
book the best houses first.

**Also worth selling in Nov–Jan:** the **midweek gap between the two races** (Aug 16–19 runs
28–44% occupancy, ~60 homes empty) — for athletes doing both events or families making a
week of it. That inventory never sells itself.

**Lesson worth keeping:** check occupancy *before* writing the campaign. The obvious
event-driven campaign was aimed at nearly-sold-out dates; the money was in the trough on
either side of it.

**Audience (measured):**

| Segment | Size (CRM) | Use |
|---|---|---|
| **Prior race-week guests** (stayed Aug 10–26 in 2024 or 2025) | **464** | ⭐ send this one |
| Leadville summer guests (Jun–Aug) | 4,480 | widen only if inventory remains |
| All Leadville guests | 11,544 | too broad — don't |

Prior race-week guests are the highest-intent audience in the database: they've *already*
done race weekend with you, and this cohort books annually. Expect ~200–350 to be mailable
in Klaviyo — a sensible next step in the deliverability ramp after the 216 win-back send.

**Klaviyo segment:**
- `guesty_markets` contains `Leadville`, AND
- `guesty_last_stay` **is in the last** `730` days, AND
- (optional tightening) `guesty_stay_count` ≥ 1
- ⚠️ **exclude** anyone with `guesty_next_checkin` **is set** — they're already booked

*(Klaviyo can't express "stayed during a specific August window" directly from current
properties. If you want the exact 464, the cleanest route is a future sync enhancement
adding a `guesty_race_week_guest` boolean — worth doing before next August.)*

**Send as a Campaign** (not a flow — it's a one-time, date-anchored send):
- Template **`XLmLGA`** · Subject: *"Still need a house for the 100?"*
- Preview: *"A handful of homes left for Aug 15 & Aug 22 — no booking fees"*
- Conversion metric: **Booked Reservation** (`SuqpZn`)
- **Send within the next few days** — this decays to worthless by Aug 15.

**Why the copy works for this audience:** it leads with race logistics racers actually care
about (3am kitchen, bike storage, crew beds, sleeping at 10,150 ft to acclimate) rather
than generic vacation-rental language. The no-fees savings is the closer, not the hook.

---

## 📅 Pacing check — read this before writing any campaign

**An empty forward calendar is the normal state here, not a crisis.** With median leads of
8–28 days, most inventory is unsold until the final weeks. The only meaningful question is
**"are we behind last year at the same point?"** — measured with `booked_at`.

Bookings made **by July 30** for that year's stays:

| Market / month | 2024 | 2025 | 2026 | Final total (prior yr) | Pace |
|---|---|---|---|---|---|
| Crested Butte — Sep | 6 | 25 | **66** | 214 | **+164%** ✅ |
| Leadville — Sep | 39 | 95 | **150** | 494 | **+58%** ✅ |
| Crested Butte — Oct | 6 | 5 | **7** | 97 | flat |
| **Leadville — Oct** | 6 | 32 | **27** | 352 | **−16%** ⚠️ |

Note how much arrives late: Leadville September went **95 → 494** after July 30. So
"September looks empty" was never the right read — it was pacing 58% *ahead*.

**Run this pacing query before committing creative to a month.** It's the difference
between rescuing real softness and shouting at inventory that always fills.

---

## ▶ NEXT TWO CAMPAIGNS (drafted, ready to schedule)

### Campaign A — "The aspens are about to turn" · template `WNt7WJ`
- **Target month:** October (portfolio trough, 551 bookings/yr; Leadville Oct −16% on pace)
- **Send:** ~**Sept 10–15**, second wave ~**Sept 28**
  (Oct median lead = 8 d, p75 34 → mid-Sept lands just ahead of the booking window)
- **Audience:** full list, minus anyone with `guesty_next_checkin` set
- **Subject:** *"The aspens are about to turn"* · Preview: *"Two weeks of gold, then it's gone"*
- **Angle:** scarcity that's genuinely true — peak color lasts 2–3 weeks and can't be moved.
  No discounting required.

### Campaign B — "Thanksgiving up here hits different" · template `Xn3qiF`
- **Target month:** **November — the worst month in the portfolio (296 bookings/yr)**
- **Send:** ~**Oct 15**, second wave ~**Nov 1**
  (Nov median lead = 9 d, p75 21 → mid-Oct is early enough for big-group planning,
  which runs longer than the median)
- **Audience:** full list; consider prioritising **high `guesty_total_value`** and past
  large-group bookers — holiday weeks skew to big houses
- **Subject:** *"Thanksgiving up here hits different"*
- **Angle:** the house *is* the product for holidays — kitchen, space, everyone under one
  roof — plus late-November opening day at CB.

**Both:** conversion metric **Booked Reservation** (`SuqpZn`), Smart Sending on, one CTA,
send yourself a test first.

---

## Segmentation — don't blast all 15,522

Use the `guesty_*` properties the nightly sync maintains:

| Segment | Definition | Use for |
|---|---|---|
| **Ski affinity** | past stay in Dec–Mar | winter campaigns |
| **Summer affinity** | past stay in Jun–Aug | summer campaigns |
| **Leadville racers** | `guesty_markets` = Leadville + stay in Jun–Aug | race lodging ⭐ |
| **CB regulars** | `guesty_markets` = Crested Butte | festival campaigns |
| **Repeat guests** | `guesty_is_repeat_guest` = true | loyalty / early access |
| **Big groups** | high `guesty_total_value` | large homes, race crews |

A wildflower email to CB summer guests will beat the same email to everyone — better
open rates, fewer unsubscribes, and it protects deliverability.

---

## Best-practice guardrails

1. **Warm up first.** 15,522 subscribers, ~16 emails of history. Ramp over 2–4 weeks
   before any full-list send, and **authenticate the sending domain** (DKIM/SPF) — that's
   the single biggest deliverability lever.
2. **Don't discount by default.** The blog proves content earns opens (wildflower guide =
   39% of blog traffic). Discount emails train people to wait for discounts; the
   "no booking fees, 10–15% less than Airbnb" angle is a permanent advantage that costs
   nothing.
3. **Suppress recent bookers** on every send — exclude anyone with `guesty_next_checkin`
   set. Nobody wants a "book now!" email the week before their trip.
4. **Sunset the unengaged.** After ~6 months, stop mailing anyone with zero opens. It
   protects the sender reputation that everything else depends on.
5. **Set the conversion metric to `Booked Reservation` (`SuqpZn`)** on every campaign, or
   you can't tell what worked.
6. **One clear CTA per email.** Two competing asks halve both.
