# Guesty Pay — sandbox test runbook

The Guesty Pay rail is built and dormant behind flags (Phases 1–2). This is how
to exercise it end-to-end **without touching the live Stripe checkout**, and the
two things the test must confirm before we enable it for real.

See `guesty-pay-reactivation-plan.md` for the why/architecture.

## Flags

| Env var | Effect |
|---|---|
| `NEXT_PUBLIC_GUESTY_PAY_ENABLED=true` | `/book` renders `GuestyPayCheckout` instead of Stripe; enables `POST /api/reservations/guesty-instant` |
| `NEXT_PUBLIC_GUESTY_PAY_SANDBOX=true` | loads the **sandbox** Guesty tokenization SDK (test cards) |

Both are `NEXT_PUBLIC_*` → they bake in at **build time**. Set them **scoped to
Preview** in Vercel and **redeploy the preview branch** (a prod redeploy won't
pick up Preview-scoped vars). **Do NOT set these in Production** until the test
passes — production stays on Stripe.

## Two ways to run it

### Option A — Guesty sandbox account (recommended, no real money)
Requires a **Guesty sandbox account** with sandbox **BEAPI credentials** and a
GuestyPay sandbox provider on a test listing. The catch: tokenization sandbox
mode (`NEXT_PUBLIC_GUESTY_PAY_SANDBOX`) tokenizes against Guesty's test env, but
the **backend reservation create uses the BEAPI token** — so for a true sandbox
run the `GUESTY_BEAPI_*` creds on the preview must also point at the **sandbox
account** (otherwise a sandbox token won't validate against the prod BEAPI).
Ask Guesty for sandbox BEAPI client id/secret + a sandbox listing.

### Option B — controlled live test (real money, do once)
On a preview with `NEXT_PUBLIC_GUESTY_PAY_ENABLED=true` (sandbox flag **off**,
prod BEAPI), book a **real low-cost stay with a real card**, confirm it works +
the card is vaulted in Guesty (try an extend), then **cancel/refund**. Simplest
if sandbox BEAPI creds are hard to get.

## Steps

1. Set the flag(s) on the **preview** branch in Vercel; redeploy it.
2. Open a property on the preview, pick dates → **Book** → `/book/[quoteId]`.
   Confirm you see `GuestyPayCheckout` (guest form + a Guesty card field), **not**
   the Stripe form.
3. Fill guest details, accept terms, enter a card:
   - Sandbox: a Guesty/Amaryllis **test card** (get the list from Guesty).
   - Live test: a real card.
4. Click **Confirm and pay**. Watch for:
   - **Success** → redirect to `/book/confirmation/[id]`.
   - **3DS** → redirect to a Guesty auth page (test with a 3DS-required test card).

## What to verify

- ✅ Reservation appears **in Guesty** (sandbox or live) with the right dates/guest.
- ✅ The **charge succeeded** in Guesty (balance $0 / paid status).
- ✅ Card is **vaulted on the reservation** in Guesty → the team can **extend /
  refund / charge** it natively in the Guesty UI. *(This is the whole point.)*
- ✅ A row lands in our `reservations` table (via the guesty-instant route).
- ✅ The confirmation page renders.
- ✅ GA4 / Meta / Klaviyo **purchase** event fires.
- ✅ No `GUESTY PAY — …` alert to admin@ unless something genuinely failed.

## The two things this test must CONFIRM (then finish the code)

These are wired defensively but with `TODO(sandbox)` markers — the sandbox
response tells us the exact shapes:

1. **Charge verification fields** — `src/app/api/reservations/guesty-instant/route.ts`
   checks `paymentStatus` / `money.balanceDue` to decide paid-vs-failed. Confirm
   the **actual field names** in the sandbox reservation response and tighten the
   check. (If the "CHARGE STATUS UNCONFIRMED" alert fires on a normal paid
   booking, the field check needs fixing.)
2. **3D Secure flow** — the route returns `{ requiresAuth, authUrl }` and the
   client redirects. Confirm the **exact authURL field** and the **post-auth
   return flow** (Guesty redirects back to a success URL → likely a
   `verifyPayment(quoteId, reservationId)` call to finalize). Wire the return
   handler once observed.

## After the test passes

- Tighten the two TODO(sandbox) items above.
- Handle **upsells / pet fees** on this rail (`TODO(upsells)` in `GuestyPayCheckout`)
  — add them as Guesty invoice items or fold into the quote.
- Then **canary**: enable in Production for a slice of traffic and watch **mobile
  conversion** (the 12.5% Apple-Pay trade-off), before flipping everyone over.
- Keep the Stripe rail for **legacy Stripe reservations** (their refunds/extends).
