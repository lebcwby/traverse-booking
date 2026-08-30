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
