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

## Domain authentication (blocking) — and an urgent finding

Current DNS on `booktraverse.com`, checked 2026-08-10:

```
SPF    v=spf1 include:dc-aa8e722993._spfm.booktraverse.com ~all
DMARC  v=DMARC1; p=reject; adkim=r; aspf=r; rua=...onsecureserver.net
Klaviyo DKIM   ABSENT
```

⚠️ **DMARC is `p=reject`.** Unauthenticated mail claiming to be from `booktraverse.com` is
**rejected outright** by Gmail/Outlook/Yahoo — not spam-foldered. Klaviyo currently signs with
`klaviyomail.com`, which fails DKIM alignment against the From address, so DMARC fails and the
message is refused at the door.

**This very likely explains the win-back campaign's results — check those bounce numbers
before drawing any conclusion from that test.**

**Setup:**
1. Klaviyo → Settings → Domains & Hosting → **Branded Sending Domain**
2. Use a **subdomain**: `email.booktraverse.com`. This isolates marketing reputation from the
   root domain that carries Resend booking confirmations — if a campaign ever goes badly,
   transactional mail is unaffected.
3. Add the ~3 generated CNAMEs in GoDaddy DNS, then Verify in Klaviyo, then send a test.

Because DMARC uses **relaxed alignment** (`adkim=r`), DKIM signed by `email.booktraverse.com`
still aligns with a `hello@booktraverse.com` From address — so the From address stays as-is
*and* we get subdomain reputation isolation.

**Do not weaken DMARC to `p=none` to make sending work.** `p=reject` is protecting the domain
from spoofing; authenticate properly instead.

---

## Sequence

1. Nadim authenticates `email.booktraverse.com` in Klaviyo ← **blocking**
2. Decide the discount question
3. Build market × recency segments in the Klaviyo UI
4. Create the two market templates (variant A / variant B)
5. Send rung 1 (both markets), check gates at 24h, proceed down the ladder

## Housekeeping
Test profiles still live in the account and should be deleted before any send:
`ngtannous+kvtest1@gmail.com`, `ngtannous+kvtest3@gmail.com`, plus `+kvfix-old` / `+kvfix-new`.
