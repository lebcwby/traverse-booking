# traversehospitality.com → booktraverse.com — full 301 migration

`traversehospitality.com-redirects.csv` (`traversehospitality-redirects.csv`) is
an **upload-ready Cloudflare Bulk Redirects list**. It completes the migration
that was only ever done on the homepage — see
`../../docs/geo/profile-directory-kit.md` and the diagnosis below.

## Why this exists
Only `traversehospitality.com/` (the homepage) redirected to booktraverse.com.
Every other URL **404'd, served stale content, or redirected to a dead old
page** — and Google had de-indexed the site down to ~3 pages. The single
biggest lost asset was `/leadville-colorado-vacation-rentals/` (1,084 clicks /
31,411 impressions over 16 months in Search Console — ~half the domain's
organic traffic), which now 301s to a dead page instead of a live site. This
list passes that equity (and the rest) to booktraverse.

## What the list does
- **High-value pages** mapped 1:1 (Leadville rentals → `/leadville`,
  property-management, Vail, owners portal, the W-9 form, etc.).
- **All 22 blog posts** mapped from their old `/traversehospitality/blog/<old-slug>/`
  URL to the new `/blog/<slug>`.
- **Catch-alls** so nothing 404s: unmapped blog → `/blog`, the old Guesty
  booking subdomain `reservations.traversehospitality.com/*` → `/properties`,
  and everything else on the domain (+ `www.` and stray subdomains like
  `hottubs.`, `petfriendly.`) → the booktraverse homepage.

All redirects are **301 (permanent)**, target **www.booktraverse.com**, and use
`include subdomains = true` on the specific rows so they catch both `apex` and
`www`. Cloudflare evaluates the **longest matching source first**, so the
specific rows automatically win over the catch-alls — no manual ordering needed.

## ⭐ Cloudflare Free plan — use Redirect Rules, not the CSV (chosen approach)
The CSV below needs **Bulk Redirects**, which Free caps at **20 items** (this
list has 36 → "maximum number of items" error). On Free, set up **Redirect
Rules** instead (Rules → Redirect Rules on the traversehospitality.com zone) —
separate quota, wildcard support, only ~5 rules needed. **Order matters: the
catch-all goes LAST.** Each is `Static redirect`, status `301`, preserve query
string `off`.

1. **Leadville (highest value)** — `(http.host eq "traversehospitality.com" or http.host eq "www.traversehospitality.com") and http.request.uri.path eq "/leadville-colorado-vacation-rentals/"` → `https://www.booktraverse.com/leadville`
2. **Property management** — `(http.host eq "traversehospitality.com" or http.host eq "www.traversehospitality.com") and http.request.uri.path eq "/property-management/"` → `https://www.booktraverse.com/property-management`
3. **Blog** — `(http.host eq "traversehospitality.com" or http.host eq "www.traversehospitality.com") and starts_with(http.request.uri.path, "/traversehospitality/blog")` → `https://www.booktraverse.com/blog`
4. **Old booking subdomain** — `http.host eq "reservations.traversehospitality.com"` → `https://www.booktraverse.com/properties` (ensure the subdomain is proxied / orange-cloud)
5. **Catch-all (LAST)** — `http.host eq "traversehospitality.com" or http.host eq "www.traversehospitality.com"` → `https://www.booktraverse.com/`

`reservations.traversehospitality.com` confirmed NOT taking live bookings
(2026-06-19), so rule #4 is safe. The CSV below is retained for if you upgrade
to **Cloudflare Pro** (500 Bulk Redirect items) and want the full 22-blog 1:1
mapping.

## How to upload the CSV (Pro/Business — Bulk Redirects)
1. Cloudflare dashboard → your **account** (not a single zone) → **Bulk
   Redirects**.
2. **Create a bulk redirect list** → name it e.g. `traversehospitality-migration`.
3. **Upload CSV** → select `traversehospitality-redirects.csv`.
   - If Cloudflare's downloadable template uses slightly different header text,
     match its header row exactly — the columns/order here are:
     `source url, target url, status, preserve query string, include subdomains,
     subpath matching, preserve path suffix, ignore case`.
4. Create/enable a **Bulk Redirect Rule** that uses this list (Cloudflare needs
   one rule to "activate" the list account-wide).
5. The `traversehospitality.com` (and `reservations.`) DNS must be on this
   Cloudflare account for the redirects to fire — it is (the current homepage
   301 is already served by Cloudflare).

## ⚠️ Before you enable
- **Confirm `reservations.traversehospitality.com` is no longer taking live
  bookings.** It was the old Guesty booking site; the homepage already
  redirects, so it's almost certainly retired — but verify so you don't redirect
  away an active funnel. (Leave `leadvillevacationhomes.com` untouched — that's
  a separate, still-active, #1-ranking site, gated for a later decision.)
- After enabling, spot-check a few URLs (the Leadville page, a blog post, a
  random deep path) resolve to the right booktraverse page, then in Search
  Console submit a **Change of Address** (traversehospitality.com → booktraverse.com)
  and watch the old URLs migrate over 4–8 weeks.

## Verify after upload
```
curl -sI https://traversehospitality.com/leadville-colorado-vacation-rentals/   # → 301 → /leadville
curl -sI https://traversehospitality.com/traversehospitality/blog/historic-houses-in-leadville/  # → 301 → /blog/historic-houses-leadville
curl -sI https://traversehospitality.com/some-random-old-path                   # → 301 → homepage
```
