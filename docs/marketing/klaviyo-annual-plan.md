# Klaviyo Annual Plan — Driving Direct Bookings

**Written 2026-07-29.** Grounded in the actual Klaviyo account, the CRM reservation
history, and the booking-site DB — not generic email-marketing advice. Every number
below is measured; assumptions are labeled as such.

---

## 0. Where we actually stand (measured)

| Metric | Value | Source |
|---|---|---|
| **Klaviyo email subscribers gained in 2026** | **16** (8 May, 2 Jun, 6 Jul) | `Subscribed to Email Marketing` metric |
| Klaviyo lists | 3 — all Klaviyo defaults, none built | `get_lists` |
| Klaviyo flows | **1** (Abandoned Cart — Single Listing) | `get_flows` |
| Guests in CRM | 23,880 | CRM `guests` |
| — with a usable email | **3,026 (12.7%)** | CRM `guests` |
| — with **no email at all** | **20,561 (86%)** | CRM `guests` |
| Reservations (18mo window) | 12,655 | CRM `reservations` |
| — direct/website share | **~909 (7.2%)** | CRM `reservations.source` |
| Repeat guests | **1,210 of 19,297 (6.3%)** | CRM `reservations` |
| Avg length of stay | 2.8–4.2 nights | CRM `reservations` |

### ✅ The emails exist — in Guesty, not the CRM (verified 2026-07-29)

**Guests give us their personal email + marketing permission through the SuiteOp guest
portal at booking**, and those write back to Guesty. Measured against the **100 most recent
Guesty reservations**:

| | Count | |
|---|---|---|
| **Clean personal emails** | **47%** | usable + permissioned |
| OTA-masked | 14% | never mailable |
| No email | 39% | mostly older Airbnb |

By source (clean / masked / none): **VRBO 9/0/0 (100%)** · **Airbnb 20/0/38** ·
Expedia 3/10/1 · Booking 2/4/0 · BE-API 4/0/0 · manual+owner+website all clean.

**Two conclusions:**
1. **The CRM's 12.7% is a sync defect, not reality** — Guesty holds ~47% clean coverage on
   recent guests. Fixing the guest-email sync is the single highest-leverage task in this
   plan; it likely multiplies the addressable list several-fold over the CRM's 3,026.
2. **SuiteOp is already converting OTA guests into owned contacts** — 20 Airbnb guests with
   personal emails is exactly the asset that moves the 7.2% direct share. Coverage is
   time-dependent: recent guests are well-covered, the oldest 100 guests had *zero* emails.

**Consent:** guests opt into marketing in the SuiteOp portal, so clean (non-OTA) emails can
be imported to Klaviyo. Still exclude OTA-masked addresses permanently, honor unsubscribes,
and keep evidence of the SuiteOp opt-in on the profile (`consent_source = suiteop_portal`).

### The blocker is the list, not the campaigns

**16 marketing subscribers for the year.** A "year of email campaigns" built on that is
fiction — a campaign to 16 people is worth ~$0 no matter how good the creative is. The good
news is the raw material exists; it's a plumbing problem, not an acquisition problem.

Meanwhile the *tracking* is excellent and already live: `Viewed Listing`, `Added to Cart`,
`Started Checkout`, `Booked Reservation`, `Newsletter Signup`, `Requested Quote Email`,
`Requested Availability Notification`, `Submitted Contact Form`, `Created Account`,
`Active on Site`. **We have all the trigger data and almost nothing using it.**

So the sequencing is forced, and it is the opposite of how most plans are written:

> **List first → flows second → campaigns third.**
> Campaigns are the *last* thing to build, not the first.

---

## 1. Seasonality — what the calendar must serve

Bookings by check-in month (18mo, all channels):

```
Jul  ████████████████████ 2,316   ← peak
Jun  ██████████████ 1,660
Mar  █████████████ 1,509          ← ski peak
Aug  ████████████ 1,433
Feb  ███████████ 1,348            ← ski peak
Sep  ████████ 1,010
May  ███████ 851
Jan  █████ 598
Dec  ████ 562
Oct  ████ 551                     ← shoulder trough
Apr  ████ 521                     ← shoulder trough
Nov  ██ 296                       ← worst month
```

**Two peaks** (summer Jun–Aug, ski Feb–Mar) and **three troughs** (Apr, Oct, **Nov**).

### Booking lead time (this drives campaign timing)

✅ **Corrected 2026-07-30.** An earlier version of this section used `created_at`, which is
the CRM *sync* date for backfilled rows — it produced impossible figures (winter "227–272
days", September "93 days"). The real field is **`reservations.booked_at`**, populated on
98% of reservations back to 2019.

Median days from booking to check-in, stays since 2024-01-01 (n = 421–2,524 per month):

| Stay month | Median | p75 | | Stay month | Median | p75 |
|---|---|---|---|---|---|---|
| Jan | 13 d | 42 | | Jul | 20 d | 55 |
| Feb | 19 d | 44 | | Aug | **28 d** | 90 |
| Mar | 23 d | 58 | | Sep | 15 d | 61 |
| Apr | 12 d | 31 | | Oct | 8 d | 34 |
| May | 16 d | 43 | | Nov | 9 d | 21 |
| Jun | 16 d | 49 | | Dec | 21 d | 54 |

**Implication — this is a short-lead business in every single month.** Median 8–28 days,
p75 21–90. There is no long-planning season, winter included. **Promote a window 2–6 weeks
before the stay dates.** A "book your summer in January" push would badly miss.

**The one exception is the Leadville races**, where the decision anchors to registration
rather than travel planning and a genuine Nov→Jan booking wave exists — see
`klaviyo-campaign-calendar.md`.

---

## 2. Phase 0 — Build the list (Months 1–2) ⛔ *blocks everything else*

Three sources, in order of value:

### 2a. ⭐ Sync guest emails from Guesty → Klaviyo (the unlock)

**Guesty is the source of truth, not the CRM.** Recent reservations carry ~47% clean
personal emails (SuiteOp-captured, marketing-permissioned) while the CRM shows only 12.7% —
so the emails are already earned and simply aren't reaching Klaviyo.

Build a **Guesty → Klaviyo sync** (a cron, mirroring the existing `sync-listings` pattern):

1. Enumerate guests via Guesty Open API, reading `guest.email` / `guest.emails[]`.
2. **Hard-filter OTA-masked domains** — `airbnb`, `@guest.booking.com`, `expedia`, `vrbo`,
   `homeaway`, `tripadvisor`, any `@guest.*` relay. These must never enter Klaviyo.
3. Upsert as Klaviyo profiles with `consent_source = suiteop_portal`, subscribed to
   marketing, plus properties that make segmentation possible on day one:
   `market`, `last_stay_date`, `stay_count`, `listing`, `booking_source`.
4. Run nightly so new SuiteOp captures flow in continuously — the list then compounds
   automatically with every stay.

**Also fix the CRM sync** so `guests.email` matches Guesty (it's the reporting surface and
currently under-reports the audience by ~4x).

**Expected outcome:** several thousand permissioned subscribers instead of 3,026 —
concentrated in recent guests, who are also the most likely to rebook.

### 2b. Close the remaining gap (39% of recent guests still have no email)

- **Airbnb is the weak spot** — 38 of 58 recent Airbnb guests had no email, vs VRBO at
  100% coverage. Worth finding out why SuiteOp capture converts so much better on VRBO and
  applying the same treatment to Airbnb; that single fix could add thousands of contacts.
- **Strengthen the in-stay ask** — the SuiteOp portal already works; add a second touch
  (check-in message / house-guide QR) offering something useful (local guide, late-checkout
  request) for guests who skipped it.
- OTA-masked addresses are permanently unusable — filter, never mail.

### 2c. Capture from live traffic and stays

- **Site capture** — we have ~4,400 real monthly users (GA4, bot-excluded) and capture
  almost none. Add: exit-intent offer, footer signup, and a "not your dates? get notified"
  capture. Note `Requested Availability Notification` already exists as a metric — wire a
  flow to it.
- **In-stay capture** — a check-in / house-guide email or QR code that asks for a personal
  email in exchange for something useful (local guide, late checkout request). This is how
  you convert OTA guests into *your* list, which is the whole ballgame for shifting the
  7.2% direct share.
- **Post-stay review request** — doubles as capture and feeds the reviews program.

**Phase 0 target: several thousand permissioned subscribers within 30–60 days** — most of
it arriving from the Guesty sync (2a) rather than new acquisition. Then it compounds
nightly as SuiteOp captures each new guest.

---

## 3. Phase 1 — Flows (Months 1–3) — the real revenue engine

Flows beat campaigns for this business: they're always-on, triggered by intent, and don't
depend on list size to start earning. Build in this order (highest ROI first):

| # | Flow | Trigger (metric already live) | Why it matters here |
|---|---|---|---|
| 1 | **Welcome / re-permission** | `Subscribed to Email Marketing`, `Newsletter Signup` | Converts new capture immediately; highest open rate you'll ever get. |
| 2 | **Pre-arrival** (7 & 2 days out) | `Booked Reservation` + date offset | Upsells, reduces support load, sets up the post-stay ask. |
| 3 | **Post-stay + review request** (2–3 days after checkout) | `Booked Reservation` + checkout offset | Feeds reviews program **and** plants the rebook seed. |
| 4 | **Win-back / rebook** (anniversary of last stay, and 60d pre-season) | past `Booked Reservation` | **6.3% repeat rate is the biggest single opportunity** — see below. |
| 5 | **Browse abandonment** | `Viewed Listing` w/o `Started Checkout` | Trigger data already flowing; nothing uses it. |
| 6 | **Availability alert** | `Requested Availability Notification` | Metric exists, no flow — pure waste today. |
| 7 | *(live)* Abandoned cart | `Started Checkout` | Already running; ~26% structural reach. |

### The repeat-guest opportunity is the headline

**6.3% repeat rate is low** for vacation rentals in destination ski/summer markets, where
guests often return annually. 1,210 of 19,297 guests have booked twice.

A returning guest costs ~nothing to acquire and **books direct by default** — which is
exactly the 7.2% → higher direct-share goal. If the win-back flow lifts repeat bookings
from 6.3% to even 9%, that's **~500 additional stays/year**, and they'd skip the OTA
commission entirely.

**This one flow is likely worth more than the entire campaign calendar.**

---

## 4. Phase 2 — Campaign calendar (Months 3–12)

Only meaningful once Phase 0 delivers a list. Cadence: **2 sends/month** (1 seasonal +
1 value/content). Resist more — a small list burns out fast.

Timing follows the measured lead times: promote a season **3–8 weeks** before its stays,
not 6 months.

| Month | Primary goal | Campaign |
|---|---|---|
| **Jan** | Fill Feb–Mar ski peak | Ski-season availability; President's week urgency |
| **Feb** | Fill Mar + seed Apr trough | Late-season ski value; spring-break gap |
| **Mar** | ⚠️ **Fill Apr trough (521)** | "Mud season" locals-rate / long-stay offer |
| **Apr** | Seed summer (May lead = 9 days!) | Summer opens; wildflower season teaser |
| **May** | Fill Jun–Jul peak | Wildflower Festival, early-summer availability |
| **Jun** | Fill Jul peak (2,316) | July 4th; peak-week last-chance |
| **Jul** | Fill Aug (lead 35d) | Late-summer + early-fall foliage |
| **Aug** | Fill Sep (lead 93d) | Fall colors, quieter-shoulder pitch |
| **Sep** | ⚠️ **Fill Oct trough (551)** | Fall value; early-ski-booking incentive |
| **Oct** | ⚠️ **Fill Nov (296 — worst month)** | Thanksgiving push; opening-day ski |
| **Nov** | Fill Dec holidays + Jan | Holiday availability; New Year's |
| **Dec** | Fill Jan–Feb | Powder season; MLK/President's weekends |

**Trough months (Apr, Oct, Nov) deserve the most creative effort** — that's where email
moves the needle most, because peak months largely fill themselves.

### Content that isn't discounting
The blog already proves demand for local content — the **Crested Butte wildflower guide
alone drew 249 views (39% of all blog traffic)** and the best-engaged posts are practical
guides (1m14s–1m39s avg engagement). Recycle that into email: it earns opens without
training the list to wait for a discount.

---

## 5. Segmentation (build alongside Phase 1)

Start simple — over-segmenting a small list is a classic failure:

- **Market**: Crested Butte / Leadville / Vail / Avon / Granby / Twin Lakes
- **Season affinity**: ski vs summer (derive from past check-in months)
- **Guest type**: families (based on `guest_count` / bedrooms) vs couples
- **Lifecycle**: never-stayed (site capture) · stayed-once · repeat · lapsed (>18mo)
- **Engagement**: for sunset/re-engagement — protects deliverability on a young domain

---

## 6. Measurement

Track monthly:

- **Subscribers** (net growth) ← the Phase 0 KPI; everything else is downstream
- **Direct booking share** — currently **7.2%**; this is the north-star business metric
- **Repeat-guest rate** — currently **6.3%**
- **Revenue per recipient** by flow and campaign
- **Flow revenue vs campaign revenue** (expect flows to dominate — that's healthy)
- **Deliverability**: bounce, spam rate, unsub — critical on a domain with no sending history

⚠️ **Warm up the domain.** With effectively zero send history, dumping 3,000 emails at once
risks landing in spam permanently. Ramp: start with the most engaged few hundred, grow
volume over 2–4 weeks.

---

## 7. Effort & sequencing

| Phase | What | Effort | Dependency |
|---|---|---|---|
| **0** | **Guesty → Klaviyo email sync** (+ OTA filter, profile properties) + CRM sync fix | ~1 week eng | ⛔ blocks all |
| **1** | 6 flows (welcome, pre-arrival, post-stay, win-back, browse, availability) | 2–3 weeks | needs Phase 0 |
| **2** | Campaign calendar, 2/month | ~1 day/month ongoing | needs Phase 0 |
| **3** | Segmentation + measurement dashboard | 1 week | alongside Phase 1 |

### If you only do three things

1. **Build the Guesty → Klaviyo email sync.** ✅ *Verified the emails are there* — Guesty
   has ~47% clean coverage on recent guests while Klaviyo has 16 subscribers. This one job
   turns a dead channel into a live one; nothing else matters until it's done.
2. **Build the win-back flow.** The 6.3% repeat rate is the biggest and cheapest win, and
   repeat guests book direct by default — straight at the 7.2% direct-share problem.
3. **Fix Airbnb email capture.** VRBO converts at 100%, Airbnb at ~34%. Closing that gap
   converts the largest OTA channel into owned audience.

---

## Open questions / assumptions to verify

- ~~Consent posture~~ — **resolved**: guests opt into marketing via the SuiteOp portal;
  clean non-OTA emails are importable. Record `consent_source = suiteop_portal`.
- **Total clean-email count across all 79,610 Guesty guest records** — the 47% figure is
  from the 100 most recent reservations, and coverage is clearly time-dependent (the oldest
  100 guests had zero). Run a full pass during the sync build to get the true list ceiling.
- **Why Airbnb capture (~34%) lags VRBO (100%)** — SuiteOp config, or Airbnb's messaging
  restrictions? Determines how much of the gap is recoverable.
- **Winter booking lead time** — current data is a backfill artifact; re-measure Jan 2027.
- **Revenue per booking by channel** — needed to price the OTA→direct shift precisely
  (commission saved per shifted booking is the real ROI of this whole program).
