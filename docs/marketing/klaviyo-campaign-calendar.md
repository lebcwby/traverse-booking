# Campaign Calendar & Cadence

**Written 2026-07-30.** Companion to `klaviyo-annual-plan.md` (strategy) and
`klaviyo-flow-setup.md` (flows). This one covers **campaigns** — the recurring sends
that re-engage the 15,522-person database.

---

## The two rules that drive everything

### Rule 1 — Plan backward from BOOKING lead time, not the stay date

Measured medians (reliable for May–Sep; see the annual plan for why winter data is an artifact):

| Stay month | Median lead | 75th pct | ⇒ Send the campaign |
|---|---|---|---|
| May | 9 days | 11 | ~2–3 weeks out |
| Jun | 16 days | 30 | ~3–5 weeks out |
| Jul | 20 days | 51 | ~4–7 weeks out |
| Aug | 35 days | 86 | ~5–12 weeks out |
| Sep | 93 days | 123 | ~3–4 months out |

**Most guests book 2–5 weeks ahead.** A "book your summer!" email in January is mistimed —
it lands months before anyone is ready to act. The exception is **races** (below), where
people plan around a registration date and book far earlier.

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
