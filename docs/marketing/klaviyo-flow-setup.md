# Klaviyo Flow Assembly Guide

**Written 2026-07-30.** Everything here is pre-built via API — templates, list, profile
properties. **Klaviyo has no API for creating flow structure or segments**, so the final
assembly is UI-only. This is the exact recipe.

Build order = value order. **#1 (win-back) is the single highest-value flow** given the
6.3% repeat rate, and returning guests book direct by default.

---

## What already exists

**List:** `S9Ezba` — "Email List" · **15,520 subscribers** (Guesty→Klaviyo sync, nightly)

**Templates (ready to use):**

| Template | ID | Status |
|---|---|---|
| Win-Back — Come back to the mountains | `T6Zdip` | ✅ **live in flow `YaZ63h`** |
| Post-Stay — Thanks + review request | `UqeNLS` | ✅ ready |
| Pre-Arrival — Your stay is coming up | `Xrh3qs` | ✅ ready |
| Browse Abandonment — Still thinking it over | `SSYrsq` | ✅ ready |
| Availability Alert — We're watching those dates | `YgRk2d` | ✅ ready |
| Welcome Series — Day 0 | `X3VSS9` | ⚠️ built May, never used |
| Welcome Series — Day 3 (booking-direct math) | `UD6cMp` | ⚠️ built May, never used |
| Welcome Series — Day 7 (from Alex & Nadim) | `VFQMbk` | ⚠️ built May, never used |
| Abandoned Cart #1 / #2 | `Shfpc4` / `SdNCVn` | ✅ already live in flow `Xpdwza` |

**Metrics already flowing** (use as triggers):

| Metric | ID |
|---|---|
| Booked Reservation | `SuqpZn` |
| Viewed Listing | `QQxkdN` |
| Started Checkout | `V4D6NT` |
| Added to Cart | `Tgddiq` |
| Requested Availability Notification | `Y5vn5X` |
| Newsletter Signup | `U6Yiwy` |
| Submitted Contact Form | `Xmf9Bx` |

**Profile properties** set by the nightly sync (use for segments + personalization):

| Property | Meaning |
|---|---|
| `guesty_last_stay` | most recent **past** check-in (YYYY-MM-DD) |
| `guesty_next_checkin` | earliest **future** check-in — drives pre-arrival |
| `guesty_stay_count` | total stays |
| `guesty_is_repeat_guest` | true/false |
| `guesty_markets` | list, e.g. ["Crested Butte"] |
| `guesty_booking_sources` | e.g. ["airbnb2","BE-API"] |
| `guesty_total_value` | lifetime host payout |
| `consent_source` | `suiteop_portal` (audit trail) |

> ⚠️ `guesty_last_stay` counts **past stays only** — a guest with an upcoming trip is not
> treated as "recently stayed", so win-back targeting stays correct.

---

## 1. Win-Back — rebook lapsed guests ⭐ highest value

**Why it matters:** only 1,220 of 18,403 guests have booked twice (6.6%). A returning guest
costs ~nothing to acquire and **books direct by default** — straight at the 7.2% direct-share
problem. Moving repeat rate to 9% is ~500 extra commission-free stays/year.

### 🚨 Do NOT send this to everyone at once

Measured audience sizes (guests with a past stay and **no upcoming booking**):

| Cohort | Size | Notes |
|---|---|---|
| Lapsed **12–18mo AND repeat guest** | **202** | ⭐ best first send — proven rebookers |
| **All** repeat + lapsed >6mo | **724** | week 2 |
| Lapsed **6–12mo** | 2,894 | freshest addresses |
| Lapsed **12–18mo** | 3,226 | |
| Lapsed **>18mo** | 7,926 | coldest; expect higher bounces |
| **Total lapsed >12mo** | **11,121** | ⚠️ never send this in one shot |

On a domain with ~16 emails of history, an 11k blast is a permanent spam-folder sentence.
**Ramp weekly**, watching bounce + spam rate before each widening:

> **wk1 → 202 · wk2 → 724 · wk3 → 2,894 · wk4 → 3,226 · then the >18mo tail**

This also front-loads the highest-converting audiences, so you learn from your best cohort
first.

### Build the segment

**Lists & Segments → Create Segment → "Win-Back — Tier 1 (repeat, 12–18mo)":**
- `guesty_last_stay` **is before** `360 days ago`, AND
- `guesty_last_stay` **is after** `540 days ago`, AND
- `guesty_next_checkin` **is not set** ← don't nag someone already booked, AND
- `guesty_is_repeat_guest` **equals** `true`, AND
- is subscribed to email marketing

Later tiers = the same segment with the date window widened / the repeat condition dropped.

### Build the flow

```
Trigger: Segment "Win-Back — Tier 1"
  └─ Email: template T6Zdip
       Subject:  "The mountains miss you"
       Preview:  "No booking fees — your next Colorado trip starts here"
```

Optional 2nd touch 5–7 days later, with a conditional split on `guesty_markets` for a
ski-vs-summer angle. Add it only after tier 1 looks clean.

**Flow settings:** Smart Sending ON. Set the conversion metric to **Booked Reservation
(`SuqpZn`)** so revenue attribution works.

---

## 2. Post-Stay + Review Request

**Trigger: Metric — `Booked Reservation`**, then delay past checkout.

```
Booked Reservation
  └─ Time delay: 4 days   (covers the ~3.0–4.2 night average stay)
       └─ Email: template UqeNLS
            Subject: "How was your stay?"
```
**Better (once available):** trigger on a checkout-date property so the delay is exact.
The 4-day delay is a reasonable approximation of avg stay + 1 day.

Feeds both the reviews program and the rebook seed.

---

## 3. Pre-Arrival

**Trigger: Date property — `guesty_next_checkin`, 7 days before.**

```
Date property: guesty_next_checkin  →  7 days BEFORE
  └─ Email: template Xrh3qs
       Subject: "Your Colorado stay is almost here"
```
Optionally add a second send at 2 days before with check-in logistics.

⚠️ The nightly sync refreshes `guesty_next_checkin`, so a booking made <24h before
check-in may miss the 7-day window. Acceptable — those guests get the Guesty/SuiteOp
transactional messages anyway.

---

## 4. Welcome Series — templates already exist, just assemble

**Trigger: Added to List — `S9Ezba`**

```
Added to list S9Ezba
  ├─ Email: X3VSS9  (Day 0 — Welcome)
  ├─ Delay 3 days → Email: UD6cMp  (Day 3 — the math on booking direct)
  └─ Delay 4 days → Email: VFQMbk  (Day 7 — from Alex & Nadim)
```
⚠️ **Add a trigger filter to exclude the backfill cohort**, or all 15,520 synced guests
will receive it at once — a deliverability disaster on a cold domain. Filter to profiles
where `consent_source` is **not** `suiteop_portal`, so only genuinely new signups enter.

---

## 5. Browse Abandonment

**Trigger: Metric — `Viewed Listing` (`QQxkdN`)** · **Template: `SSYrsq`**

```
Viewed Listing
  └─ Time delay: 4 hours
       └─ Conditional split: has NOT done "Started Checkout" since starting this flow
            └─ Email: template SSYrsq
                 Subject: "Still thinking about {{ event.Title }}?"
```
⚠️ **Add a flow filter:** has NOT done `Booked Reservation` since starting — don't chase
someone who already booked. Also cap frequency (Klaviyo's "don't re-enter within X days")
so a heavy browser isn't emailed daily.

The template uses live event data: the listing photo (`event.ImageURL`), title, city, and a
**price-comparison strip** (direct vs `event.AirbnbPrice` / `event.VrboPrice`) — all already
sent with the event. It degrades gracefully via `{% if %}` when a field is missing.

---

## 6. Availability Alert ⭐ highest-intent signal in the account

**Trigger: Metric — `Requested Availability Notification` (`Y5vn5X`)** · **Template: `YgRk2d`**

```
Requested Availability Notification
  └─ Email: template YgRk2d   (send immediately — they just asked)
       Subject: "We're watching those dates"
```

**Design note — deliberately honest:** we have no mechanism to detect when dates actually
free up, so the email does **not** promise a notification we can't deliver. Instead it
confirms the request, sets a realistic expectation (cancellations happen), and pivots to
the 189 homes that *are* available for those dates. That converts better than a dead-end
"we'll let you know" — and doesn't over-promise.

Uses `{{ event|lookup:'Listing Title' }}` / `'Check-In'` / `'Check-Out'` (the property
names have spaces, hence `lookup`).

**Future upgrade:** if we ever add real availability polling, this becomes a genuine alert
flow — the trigger and template are already in place.

---

## 🚨 Before turning ANY of this on

1. **Warm the domain.** 15,520 subscribers, ~16 emails of sending history. Blasting
   everyone will land you in spam permanently. Start with a few hundred of the most recent
   guests, ramp over 2–4 weeks.
2. **Add the welcome-series exclusion filter** (see #4) or the backfill cohort all gets it.
3. **Smart Sending on** (Klaviyo default) so a guest can't receive multiple flows at once.
4. **Send yourself a test of every email** before it goes live.
5. **Delete two test profiles** created while probing the API:
   `ngtannous+kvtest1@gmail.com`, `ngtannous+kvtest3@gmail.com`.
