# Email Programme Review — Sep 2026

**All five campaigns sent 2026-07-30 → 2026-09-09. Reviewed 2026-09-30.**

---

## 1. What we sent, and what happened

| # | Campaign | Sent | Recip | Deliv | Open | Clicks | CTR | CTO | Unsub | Spam | **Bookings** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Win-back | Jul 30 | 214 | 99.1% | 67.5% | 2 | 0.94% | 1.40% | 2.36% | 0 | **0** |
| 2 | Foliage — CB (rung 1) | Aug 30 | 265 | 98.9% | 55.3% | 2 | 0.76% | 1.38% | 1.91% | 0 | **0** |
| 3 | Foliage — LV (rung 1) | Aug 30 | 610 | 99.2% | 49.1% | 5 | 0.83% | 1.68% | 2.48% | 0 | **0** |
| 4 | Reminder — LV (rung 2) | Sep 9 | 1,256 | 99.0% | 21.9% | 6 | 0.48% | 2.21% | 1.37% | 1 | **0** |
| 5 | Reminder — CB (rung 2) | Sep 9 | 662 | 99.1% | 30.6% | 2 | 0.31% | 1.00% | 1.83% | 1 | **0** |
| | **Total** | | **3,007** | **99.0%** | — | **17** | **0.57%** | — | **1.7%** | 2 | **0** |

**3,007 emails → 17 clicks → 0 bookings.**

### The zero is real, not a tracking gap
Worth stating plainly because the opposite was assumed earlier. `Booked Reservation`
(`SuqpZn`) fires normally (~21/week), events carry `Guest Email`, and they resolve to
Klaviyo profiles correctly. Attribution works. With only 17 clicks across the whole
programme, the odds any clicker also booked inside the attribution window were always
near zero. **The campaigns genuinely did not drive bookings.**

---

## 2. What the numbers actually mean

### ⭐ Most opens are machines — the real rate is ~9–20%
`Opened Email` events by client:

| Window | Blank client (prefetch) | Identified clients |
|---|---|---|
| Rung 1 (Aug 30–Sep 7) | 442 (71%) | 176 |
| Rung 2 (Sep 9–19) | 562 (77%) | 168 |

A blank client name is the signature of Apple MPP and security scanners. Stripping them:

| | Delivered | Human open events | Implied real open rate |
|---|---|---|---|
| Rung 1 | 867 | 176 | **~20%** |
| Rung 2 | 1,899 | 168 | **~9%** |

The reported 49–67% open rates were never real. **Judge campaigns on clicks and bookings;
the "pause if opens < 15%" gate is meaningless under MPP.**

### ⭐ Widening the audience produced almost no extra humans
Rung 2 had **2.2× the recipients** of rung 1 and delivered **fewer** human open events
(168 vs 176). Every one of the extra ~1,040 recipients was, in aggregate, inert.

**Nadim's anniversary-window instinct was right, and diluting it was wrong.** The
345–389-day cohort engaged roughly twice as well as the 300–456-day cohort. Reach is not
the lever here; intent is.

### Plain vs designed — no answer, and the test was lost
Leadville click-to-open rose (1.68% → 2.21%), Crested Butte fell (1.38% → 1.00%). On 6 and
2 clicks that is noise, and audience changed at the same time as format. Two attempts at
this question have now produced nothing. **Stop trying to A/B it at this volume** — the
click rate is too low to detect anything short of a 3× effect.

### The good news: deliverability is genuinely solid
99.0% delivered, 2 spam complaints across 3,007 sends, bounces under 1.2%. The
`email.booktraverse.com` branded domain and the warming ladder did their job. **This is not
a deliverability problem, and no amount of further warming will help.**

### Unsubscribes are high but improving
1.7% blended against a 0.1–0.5% healthy benchmark. Rung 2 was better than rung 1
(1.37% vs 2.48% on Leadville), which suggests the plain format and tighter relevance helped
— the one weak positive signal in the set.

---

## 3. The commercial context that matters more

### The season filled anyway
Foliage weeks, Sep 8 → final:

| Week | CB | Leadville |
|---|---|---|
| Sep 14 | 36% → **64%** | 48% → **72%** |
| Sep 21 | 48% → **79%** | 47% → **74%** |
| Sep 28 | 24% → **66%** | 30% → **61%** |

A good autumn. None of it is attributable to email.

### Direct share is flat, before and after email
| Feb | Mar | Apr | May | Jun | Jul | Aug | Sep |
|---|---|---|---|---|---|---|---|
| 6.5% | 5.1% | 3.5% | 6.1% | 6.3% | 5.6% | **7.3%** | 6.5% |

Email launched Jul 30. Direct volume grew (41 → 85/month) but so did total bookings; **share
has not moved.** Two months is short, but there is no signal to point at.

### What *is* working, per UTMs on live booking events
`google / gbp / grand-lodge` · `travelcrestedbutte / referral` · `lodging_featured_partner`.
Google Business Profile, local tourism referrals and partner listings are producing
bookings right now. These get a fraction of the attention email has had.

---

## 4. Recommendations

### ① Stop broad campaigns. They are not working.
Five sends, 3,007 recipients, zero bookings, and a 1.7% unsubscribe rate means each send
**burns list faster than it earns**. At ~15.5k subscribers with ~9–20% real opens, continuing
to broadcast is spending a finite asset for no return.

### ② Move the effort to flows, where intent already exists
This is the single highest-value change. Broadcast email asks "want a holiday?"; triggered
email answers a question the guest already has.

| Flow | Status | Why it matters |
|---|---|---|
| **Post-stay** | designed, never assembled | ~1,300 guests checked out this September. Warmest audience of the year, currently caught by nothing. Drives reviews *and* rebooking. |
| **Pre-arrival** | designed, never assembled | Upsells, late checkout, local guide. Guest is already paying. |
| **Availability alert** | designed, never assembled | Pure intent — they asked. |
| **Abandoned cart** | live | Already the best-performing email asset we have. |

### ③ If we campaign at all, campaign narrow
Only the anniversary cohort (345–389 days since last stay) showed real engagement. Send to
~600 people with intent rather than 1,900 without it. Smaller list, better rate, less burn.

### ④ Put the freed attention on the channels that are converting
GBP, tourism-board referrals and partner listings appear on real bookings. Email does not.

### ⑤ Housekeeping
- **Rotate the Klaviyo private key** — it passed through a chat transcript.
- **Fix `guesty_next_checkin`** — the sync never clears it, so every segment needs an
  awkward `is not set OR before today` clause. One line in `klaviyo-guest-sync.ts`.

---

## 5. October plan — build, don't broadcast

### Why October is the wrong month to push
Forward occupancy, checked 2026-09-30:

| Week | CB | Leadville |
|---|---|---|
| Oct 19 – Dec 7 | **0–6%** | 6–19% |
| Dec 21 | 12% | 31% |
| Dec 28 | 20% | 34% |

Late October to early December is **mud season** — the mountain is shut and there is little
to sell. Pushing email at genuinely empty, genuinely unattractive dates is how a list gets
trained to ignore you.

### And Christmas does NOT need rescuing
| Season | On books by Sep 30 | Final | % on books |
|---|---|---|---|
| **2026** | **111** | — | — |
| 2025 | 50 | 409 | 12% |
| 2024 | 18 | 337 | 5% |

**+122% ahead of last year**, and historically only 5–12% of holiday bookings exist by now.
⚠️ A "Christmas is empty, book now!" campaign would be factually wrong — the same trap that
nearly produced a bogus "September is empty" campaign in August. **Always pace against the
same point last year before calling a period soft.**

Holiday lead times also argue against October: median **20 days**, p75 57 days, only 24%
book 60+ days out. **The Christmas push belongs in late November, not October.**

### The plan

| Week | Focus | Deliverable |
|---|---|---|
| **Oct 1–7** | **Post-stay flow** | Assemble and switch on. ~1,300 September guests just left. Review request + rebooking offer. Highest-value thing we can build. |
| **Oct 8–14** | **Pre-arrival flow** | Trigger 5 days before check-in. Upsells, local guide, late checkout. |
| **Oct 15–21** | **Availability alert flow** + fix `guesty_next_checkin` | Both small; clear the segment trap permanently. |
| **Oct 22–28** | **One narrow campaign** — Leadville early season, anniversary cohort only (~600) | The controlled test: does a small, high-intent list beat a big one? Leadville Oct/Nov has real inventory (19–30%) where CB does not. |
| **Oct 29–31** | **Prep the holiday campaign** | Built and ready, scheduled to send **late November**, matched to the 20-day median lead. Check Thanksgiving pacing against last year *before* framing it as soft. |

### How we will know it worked
Not opens. Three measures:
1. **Post-stay flow** → review submissions + repeat bookings from September guests
2. **Narrow campaign** → click-to-open versus the 1.0–2.2% broadcast baseline
3. **Direct share** → does it break out of the flat ~6% band

If the narrow campaign also produces zero bookings, that is the answer: **this audience does
not book from email**, and the budget belongs with GBP, referrals and partnerships. Worth
being willing to conclude that rather than running a sixth campaign.
