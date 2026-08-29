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

## Email copy

**From:** Traverse Hospitality · hello@booktraverse.com
**Reply-to:** hello@booktraverse.com

### Subject lines (A/B test)
- **A —** The aspens are turning early this year
- **B —** Colorado's gold is arriving ahead of schedule

**Preview text:** A cool, dry August has the aspens turning early. Mid-September now looks
like peak — and the good weeks are still open.

### Body

> **The aspens are turning early.**
>
> Every autumn the high country goes gold for about two weeks. This year, a cool and dry
> August has the color running ahead of schedule — we're expecting peak in **mid-to-late
> September** rather than the usual end-of-month.
>
> If you've been meaning to come back for fall, this is the year to move early.
>
> **Crested Butte**
> Kebler Pass holds one of the largest aspen groves in North America. When it turns, the
> road becomes a tunnel of gold for miles. It's a 20-minute drive from town and it is the
> single best foliage drive in Colorado.
>
> **Leadville**
> At 10,152 feet, Leadville turns first. Independence Pass and the shoreline at Turquoise
> Lake give you gold aspens against the Sawatch peaks — several of them already dusted with
> early snow.
>
> **The good weeks are still open.**
> Late September is usually the hardest week of the fall to book. This year it's still wide
> open in both towns — but at a 2-to-4 week booking window, that won't last.
>
> [**See what's available →**]
>
> Booking direct with us means no third-party service fees, and you're talking to the local
> team that actually manages the home.
>
> See you in the gold,
> **The Traverse Team**

### Notes on the copy
- No fabricated urgency — the scarcity claim is true and backed by the occupancy table.
- Kebler Pass is a genuinely ownable hook; it's a real superlative and competitors in
  Denver/Front Range marketing don't use it.
- Two distinct market blocks so the email works for both audiences without segmenting.
- **Open question: do we discount?** Oct 5 week is 4% booked in CB. A 15% "early color"
  offer on Sep 28–Oct 12 would move otherwise-dead inventory. Not included — needs Nadim's
  call, and it's an owner-revenue decision.

---

## ⚠️ Blocker before any send

**The sending domain is not yet authenticated (DKIM/SPF) in Klaviyo.** Sending 15.5k emails
from an unauthenticated domain will land in spam, and it puts the reputation of
`booktraverse.com` at risk — the same domain that carries booking confirmations.

**This must be done first.** It is a DNS change in GoDaddy plus verification in Klaviyo.

---

## Batch plan

The list is ~15.5k, and **only ~215 profiles have ever been sent a campaign** (win-back
Tier 1). The rest is a cold, imported list going back years. A single blast would produce a
bounce spike and spam complaints, which is exactly how a sending domain gets blacklisted.

So we warm it in a ladder, ordered **most recent stay first** — recent guests are the most
likely to have live addresses and to engage, which builds positive reputation early.

| Batch | Audience | Size | Day |
|---|---|---|---|
| 1 | Stayed within 12 months | 500 | Day 1 |
| 2 | Stayed within 12 months (rest) | 1,500 | Day 3 |
| 3 | Stayed 12–24 months | 3,000 | Day 5 |
| 4 | Stayed 24–36 months | 5,000 | Day 7 |
| 5 | Remainder | ~5,500 | Day 9 |

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
Klaviyo has no API for building segments — the recency tiers must be created in the UI, using
the `guesty_last_stay` property the sync writes. Campaigns themselves are API-creatable, so
once the segments exist I can clone the campaign per batch.

---

## Sequence

1. Nadim authenticates the sending domain in Klaviyo ← **blocking**
2. Decide the discount question
3. Build 5 recency segments in the Klaviyo UI (`guesty_last_stay` tiers)
4. Rewrite template `YsP6nv` with the copy above
5. Send batch 1, check gates at 24h, proceed down the ladder
