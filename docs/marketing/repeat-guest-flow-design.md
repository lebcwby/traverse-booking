# Repeat-Guest Flow — design + platform choice

**Analysed 2026-10-04.** Answers: what flow maximises repeat bookings, and whether it belongs
in Conduit, Guesty or Klaviyo.

---

## The finding that decides it

**Your repeat guests are Airbnb guests, and most of them you cannot email.**

Repeat guests (2+ stays since Jan 2024), by booking source:

| Market | Source | Repeat guests | Mailable | % reachable |
|---|---|---|---|---|
| Leadville | **airbnb2** | **462** | 160 | **35%** |
| Crested Butte | airbnb2 | 129 | 64 | 50% |
| Leadville | VRBO | 89 | 33 | 37% |
| Leadville | website | 75 | 25 | 33% ⚠️ |
| Leadville | owner | 40 | 37 | 93% |
| Leadville | Booking.com | 21 | 1 | **5%** |

Roughly **860 repeat guests across both markets; around 600 came via an OTA; Klaviyo can
reach maybe 300 of them.**

⚠️ The `website` row at 33% is almost certainly a CRM data gap rather than a real reach
problem — direct bookers hand over a real email at checkout. The Klaviyo sync reads Guesty,
not this table, so `guests.email` here is likely just incomplete. Worth confirming before
anyone quotes that number.

### Repeat rate is a Leadville story
| Market | Guests | Repeat | Rate | 4+ stays |
|---|---|---|---|---|
| **Leadville** | 9,879 | 754 | **7.6%** | **133** |
| Crested Butte | 5,509 | 207 | 3.8% | 12 |

Leadville repeats at twice the rate and holds a dense core of 133 guests averaging **7.4
stays each**. That cohort is worth more than the entire 15.5k marketing list has produced.

### Two distinct rebooking rhythms
| Cohort | Guests | Avg stays | Avg nights | Avg gap |
|---|---|---|---|---|
| Leadville, 4+ stays | 133 | 7.4 | 4.3 | **62 days** |
| Leadville, 2–3 stays | 605 | 2.2 | 4.1 | 213 days |
| Crested Butte, 2–3 stays | 217 | 2.2 | 3.8 | 192 days |

The 62-day cohort looks like recurring/work-driven travel. The ~200-day cohort is leisure,
and matches the annual spike at **360–374 days** found earlier. **One cadence will not serve
both.**

---

## Platform: it's a handoff, not a choice

**The binding constraint is email capture, not email content.** Pick the platform that fixes
the constraint first.

| | Reach | Trigger quality | Content/segmentation | Verdict |
|---|---|---|---|---|
| **Guesty** | **100% of guests** — messages ride the booking channel, no email needed | Native reservation lifecycle (checkout, nights-after) | Basic templates | ✅ **Capture stage** |
| **Klaviyo** | Only guests with a real email (~35–50% of OTA repeats) | Good, via `Booked Reservation` / profile properties | Excellent — branching, timing, merge data | ✅ **Conversion stage** |
| **Conduit** | Inbound conversation only | Reactive, not scheduled | AI-drafted replies | ❌ Wrong tool |

**Conduit is out.** It answers inbound guest messages; it is not a scheduled outbound engine.
It also currently sits at a 44% copilot accept rate with an explicit autopilot NO-GO, so it
should not be driving revenue-critical outreach unsupervised.

### 🚨 Compliance limit — do not skip this
**You cannot solicit direct bookings inside an Airbnb thread.** Airbnb's terms prohibit
directing guests off-platform, and enforcement ranges from message blocking to listing
suspension. With `airbnb2` as the dominant repeat source, that risk is concentrated exactly
where the opportunity is.

What is legitimate in the OTA thread: excellent service, a review request, and inviting the
guest to register in the **SuiteOp portal** for check-in details, local guides and support.
That registration is where a real email and marketing consent are obtained — and once the
guest is a subscriber, marketing to them is your relationship, not Airbnb's.

---

## The flow

### Stage 1 — Capture (Guesty) · fixes the 35% problem
A reservation-lifecycle message to **every** guest regardless of channel, pushing SuiteOp
portal registration. This is the highest-leverage change available: moving Leadville Airbnb
repeat reach from 35% toward the 93% seen on owner bookings would roughly **triple** the
addressable repeat audience.

No offer, no direct-booking pitch — just the practical reason to register.

### Stage 2 — Convert (Klaviyo) · for guests with a real email
A post-stay sequence, branched by the two rhythms above:

| Touch | Timing | Audience | Purpose |
|---|---|---|---|
| 1 | **Day 2** after checkout | all | Thank-you + review request. Feeds the 16k-review asset and Google ranking. No selling. |
| 2 | **Day 45** | high-frequency cohort (Leadville, 2+ stays, gaps < 120d) | "Coming back up?" — ahead of the 62-day gap |
| 3 | **Month 6** | everyone else | Seasonal re-engagement, matched to the ~200-day gap |
| 4 | **Day 345** | all non-returners | The anniversary window — the only cohort that showed real engagement all programme |

Touch 4 is the one with evidence behind it: the 345–389-day cohort engaged roughly twice as
well as any wider segment.

### Why this beats another campaign
Five broadcast campaigns produced 3,007 sends, 17 clicks and zero bookings. A post-stay flow
is triggered by a real event, reaches a guest who has just experienced the product, and —
unlike a campaign — compounds: every stay feeds it automatically.

---

## Measuring it
Not opens. Three numbers:
1. **Portal registration rate** on OTA bookings — the capture-stage KPI, currently the bottleneck
2. **Repeat rate by market** — Leadville 7.6%, Crested Butte 3.8% today
3. **Direct share** — flat at ~6% all year; this is the flow designed to move it

If portal registration doesn't move, nothing downstream can — fix that before building
touches 2–4.
