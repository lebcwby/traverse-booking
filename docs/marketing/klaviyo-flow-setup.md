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
| Win-Back — Come back to the mountains | `T6Zdip` | ✅ new |
| Post-Stay — Thanks + review request | `UqeNLS` | ✅ new |
| Pre-Arrival — Your stay is coming up | `Xrh3qs` | ✅ new |
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

**Create → Flow → From scratch. Trigger: Segment (build the segment first).**

**Segment "Lapsed Guests":**
- `guesty_last_stay` is **before** `360 days ago`, AND
- `guesty_next_checkin` **is not set** (don't nag someone already booked), AND
- Email marketing consent = subscribed

**Flow:**
```
Segment: Lapsed Guests
  └─ Email: template T6Zdip
       Subject: "The mountains miss you"
       Preview: "No booking fees — your next Colorado trip starts here"
```
Optionally add a 2nd touch 5–7 days later with a market-specific angle (ski vs summer),
using a conditional split on `guesty_markets`.

**Why it matters:** 1,210 of 19,297 guests have booked twice (6.3%). Moving that to 9% is
~500 extra stays/year, commission-free.

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

**Trigger: Metric — `Viewed Listing`**

```
Viewed Listing
  └─ Delay 4 hours
       └─ Conditional split: has NOT done "Started Checkout" since starting this flow
            └─ Email: (needs a template — not built yet)
```
Trigger data is already flowing and nothing uses it today.

---

## 6. Availability Alert

**Trigger: Metric — `Requested Availability Notification` (`Y5vn5X`)**

Guests explicitly asked to be told when dates open — this is the highest-intent signal in
the account and currently has **no flow at all**. Needs a template + a check that the dates
actually freed up.

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
