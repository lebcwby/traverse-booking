# GTM container audit — GTM-WMD2QJS6

Audited 2026-10-19 by reading the published container directly:
`https://www.googletagmanager.com/gtm.js?id=GTM-WMD2QJS6`. No GTM login
needed — a published container is public. Re-run that fetch any time to
re-check.

Production loads **GTM-WMD2QJS6** (confirmed: the id appears 3× in the live
homepage HTML). ⚠️ `site-shell.tsx` falls back to **`GTM-KN2S5WQV`** if
`NEXT_PUBLIC_GTM_ID` is ever unset — a different container entirely. If that
env var goes missing, every finding below stops applying.

---

## What is actually in the container

**GA4 event tags — there are exactly two:**

| Tag       | Event                    | Target property              | Ecommerce |
| --------- | ------------------------ | ---------------------------- | --------- |
| `__gaawe` | `click_book_reservation` | `G-8NK72KVMJJ` (live)        | off       |
| `__gaawe` | **`page_view`**          | **`G-C5098JP52V` (archive)** | off       |

**Config tags (`__googtag`):** one for `G-C5098JP52V`, one for `G-8NK72KVMJJ`.

**No `purchase` tag exists.** The 7 occurrences of the word in the container
are all GTM's own built-in ecommerce vocabulary, not a configured tag.

**`booking_completed` appears zero times.** Our checkout pushes
`dataLayer.push({ event: "booking_completed", ecommerce: {...} })` on every
booking (`src/lib/tracking.ts`) and **nothing in this container listens for
it.** That push is currently dead code.

---

## 1. 🔴 Fix first: `page_view` is being sent to the archive property

The `page_view` tag targets `G-C5098JP52V`, which `CLAUDE.md` describes as a
read-only archive of WordPress-era data. The reasoning for treating it as
harmless was that its `gtag.js` CDN returns 404 — but **GTM does not load
tags through that CDN**, it loads them through its own container. So this tag
very likely works, and page views have been flowing into the dead property
while purchases go to the live one. That is the split reporting that makes
session counts and landing pages untrustworthy in _both_ properties.

**Change:** Tags → the `page_view` tag → either

- **repoint** its Measurement ID to `G-8NK72KVMJJ` — but read §3 first, it may
  be redundant; or
- **pause/delete** it, which is the likely right answer.

Then Tags → the `__googtag` config tag for `G-C5098JP52V` → **pause**. Keeping
the property as a historical archive does not require still writing to it.

---

## 2. ⛔ Do NOT add a GA4 purchase tag

It is tempting to wire a purchase tag to the `booking_completed` push. **Don't.**

`purchase` is already sent server-side via the Measurement Protocol
(`src/lib/server-tracking.ts`), which is the path that carries `client_id`,
`session_id`, `user_id` and attribution. Adding a GTM purchase tag would send
a **second** purchase for every booking. GA4 dedupes the Ecommerce
_transactions_ metric by `transaction_id` but **not the purchase event
count** — so event totals and the revenue reported against them would inflate.

Either leave the `booking_completed` push as an unused hook, or remove it from
`tracking.ts`. It is harmless today, just misleading to read.

---

## 3. ❓ Unverified: is the live property getting two page views?

Every page load currently does **both**:

1. the app's own gtag — `gtag("config", "G-8NK72KVMJJ")` in `site-shell.tsx`
2. the GTM container's `__googtag` config tag for the same `G-8NK72KVMJJ`

Two configs for one measurement ID _can_ produce two `page_view` hits. Google's
unified tag often dedupes this, so it may be fine — **I could not confirm
either way**, because the site's consent manager blocks all Google requests
until a visitor accepts, and accepting on your behalf would both require your
permission and add my visit to your analytics.

**How to check, 2 minutes:**

1. Open booktraverse.com in Chrome, **accept the cookie banner**.
2. DevTools → Network → filter `g/collect`.
3. Reload. Count the requests whose query string contains `en=page_view`, and
   read each one's `tid=` parameter.

Expected healthy result: **exactly one** `en=page_view` with
`tid=G-8NK72KVMJJ`, and **none** with `tid=G-C5098JP52V`.

- Two hits to `G-8NK72KVMJJ` → remove the GTM config tag for it (the app's own
  gtag is the one to keep; it carries the consent wiring).
- Any hit to `G-C5098JP52V` → §1 is confirmed and live.

GTM **Preview** mode shows the same thing from the tag side if you prefer it.

---

## What this does NOT explain

The GA4 purchase gap (70 events vs 59 real bookings, Sep 18 – Oct 17) is
**not** GTM — there is no purchase tag. The remaining candidates are server
retries, which #92 now dedupes by `transaction_id`, and
`/api/admin/inspect-ga4?fire=1`, which used to post a real $100 purchase and
now posts $0 with a unique id.

The "(not set)" attribution was the measurement-id bug fixed 2026-10-07;
session capture went 0% → ~97% at that date. Any re-measurement should use an
**Oct 8 or later** window.
