# Making listing pages cacheable

**Scoping only. Nothing here is built.** Scoped 2026-10-13, following issue #82.

## The problem

Every page view on booktraverse.com is a full origin render. Production headers,
normal Chrome user agent:

| Path             | `x-vercel-cache` | `cache-control`               |
| ---------------- | ---------------- | ----------------------------- |
| `/`              | MISS             | `private, no-cache, no-store` |
| `/properties`    | MISS             | `private, no-cache, no-store` |
| `/crested-butte` | MISS             | `private, no-cache, no-store` |

Three sequential requests to the same listing page returned MISS every time. The
CDN holds nothing, for guests or for the dozen AI crawlers now explicitly
invited in by robots.txt. `/properties/[id]` declares `revalidate = 300` and has
never once used it.

The 208 listing pages are the bulk of both crawl and guest traffic, so they are
the prize. This document scopes getting _them_ cacheable specifically.

## ⚠️ Correcting the framing in #82

I previously described the root-layout fix and the listing-page fix as
alternatives — "do the listing pages instead". **That was wrong. The layout fix
is a hard prerequisite.**

In the App Router, a root layout that calls `headers()` or `cookies()` forces
dynamic rendering for _every_ route beneath it. Fixing `/properties/[id]` alone
changes nothing while `src/app/layout.tsx` reads both. The order is not
negotiable.

## What forces the listing page dynamic

Two independent causes. Both must go.

### 1. The root layout — three reads (issue #82)

| Line            | Read                                                  | Feeds                                                                                      |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `layout.tsx:66` | `readAnonymousMatching()` → `headers()` + `cookies()` | Meta CAPI advanced matching (edge geo + visitor uuid), inlined as `window.__sp_anon_match` |
| `layout.tsx:71` | `headers().get("x-nonce")`                            | CSP nonce on every inline `<script>`                                                       |
| `layout.tsx:77` | `headers().get("host")`                               | `ConduitWidget` detecting the landing subdomains                                           |

The nonce is the awkward one. Non-sensitive paths get a CSP with
`'unsafe-inline'` and do not need it; `/book/*`, `/login`, `/contact`,
`/account/*` and `/auth/reset-password` get a nonce-based CSP _without_
`unsafe-inline`, and a layout cannot tell which it is on without reading
headers.

**Approach: route-group split.** Route groups do not change URLs.

- `app/layout.tsx` → thin static shell: `<html>`, `<body>`, fonts. No dynamic reads.
- `app/(public)/layout.tsx` → analytics scripts with **no** nonce. Static.
- `app/(secure)/layout.tsx` → reads `headers()` for the nonce, renders the same
  scripts **with** it. Dynamic, which is correct for checkout anyway.

`readAnonymousMatching` must become client-side regardless, since the public
pages need it too. `host` can come from `window.location.host` in a client
component, or follow the existing `body:has(.audit-page)` CSS convention the
landing pages already use for exactly this reason.

### 2. The page's own `searchParams`

`src/app/properties/[id]/page.tsx:473`:

```ts
const [{ id }, sp] = await Promise.all([params, searchParams]);
```

Four params, three consumers — and **all three are already `"use client"`**,
which is what makes this tractable:

| Consumer            | Uses                                                                      | File                     |
| ------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `DateRangeProvider` | `checkIn`, `checkOut`, `guests` (as `initialDateRange` / `initialGuests`) | `date-range-context.tsx` |
| `BookingSidebar`    | `pointofsale`                                                             | `booking-sidebar.tsx`    |
| `MobileBottomBar`   | `pointofsale`                                                             | `mobile-bottom-bar.tsx`  |

Each can call `useSearchParams()` itself instead of receiving a prop. There is
precedent in the codebase — `floating-search-bar`, `property-card`,
`map-card-carousel` and others already do.

⚠️ `useSearchParams()` inside a statically-rendered route **must** sit under a
`<Suspense>` boundary or the build fails. Those three components need wrapping.

### 3. The canonical redirect

`page.tsx:565-573` 308s a non-canonical slug to the canonical one, carrying the
query string. It reads `sp` to do so.

This is **already handled at the edge** by `validateListingUrl`
(`src/lib/listing-url-validator.ts:153-159`), which emits a real 308 and
carries the query string explicitly. The page-level version is a fallback that,
per the Next 16 streaming behaviour documented in CLAUDE.md known-issue #8,
cannot reliably emit its 308 anyway.

⚠️ But the edge validator **fails open** when it cannot load the id set, and
only canonicalises ids it knows about. Removing the page-level redirect narrows
that safety net. Decide deliberately: either accept the edge as the only
canonicaliser, or keep a redirect that does not read `searchParams` (canonical
slug only, dropping the query) — which would silently lose a guest's dates.
Neither is free.

## Build plan

| #   | Step                                                                      | Size  | Depends on |
| --- | ------------------------------------------------------------------------- | ----- | ---------- |
| 1   | Route-group split; root layout becomes a static shell                     | **L** | —          |
| 2   | `readAnonymousMatching` → client-side                                     | **M** | 1          |
| 3   | `host` read → client or CSS                                               | **S** | 1          |
| 4   | Three consumers read `useSearchParams()`; add Suspense boundaries         | **M** | —          |
| 5   | Drop `searchParams` from the page; settle the canonical-redirect question | **S** | 4          |
| 6   | Optional: `generateStaticParams` to prebuild all 208 at deploy            | **S** | 1–5        |

Steps 1–3 are issue #82 and unlock ~20 content pages on their own (homepage, six
market pages, building pages, blog, `/property-management`, `/contact`). Steps
4–5 add the 208 listing pages on top. Step 6 only changes _when_ the work
happens — ISR fills the cache on demand without it.

## Risks

- **Meta advanced matching (step 2).** Moving anon-matching client-side adds a
  round trip before `fbq('init')`. Edge geo headers are not readable from the
  browser, so it needs a small endpoint. Degrading EMQ here is the exact failure
  the server-side `_fbp`/`_fbc` minting exists to prevent. **Check EMQ after
  deploy, not just a green build.**
- **CSP on checkout (step 1).** Getting the nonce wrong blocks inline scripts and
  breaks GTM and Google Ads enhanced conversions on `/book`. Prior incident.
- **Date prefill (steps 4–5).** A guest arriving with `?checkIn=…` must still see
  those dates selected. This is a conversion path; verify in a browser, not only
  in tests.
- **Stale pricing.** At `revalidate = 300` a listing page's "from" price can be
  five minutes old. Acceptable — the page already says "Add dates for prices"
  and the real quote is fetched live at checkout — but it is a change from
  always-fresh.

## How to verify

Production headers are the only proof. `next dev` always sends
`no-cache, must-revalidate` regardless of what middleware or the route sets, so
a local check proves nothing.

```bash
curl -s -o /dev/null -D - "https://www.booktraverse.com/properties/<slug>" | grep -iE "^(cache-control|x-vercel-cache)"
```

Success is `x-vercel-cache: HIT` on a second request and a `cache-control`
without `no-store`. Also confirm `npm run build` marks `/properties/[id]` as `●`
rather than `ƒ`.

And confirm the things that must not change: a guest with `?checkIn=…` still
sees their dates; `/book` still loads GTM without CSP violations in console;
Meta events still carry advanced matching.
