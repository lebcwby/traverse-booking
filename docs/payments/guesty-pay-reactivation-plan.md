# Guesty Pay re-activation plan

**Question that prompted this:** "If we used Guesty Pay instead of Stripe, could the
team extend/modify a reservation directly in Guesty?" **Yes** — and because Traverse
negotiated a Guesty Pay fee *lower* than Stripe, Guesty Pay now wins on cost,
native team modifications, and reliability at once.

This documents how payments work today, what's already built for Guesty Pay (a lot),
and a phased plan to switch.

> Status: investigation + plan. No code changed. Confidence is marked per item —
> **[code-verified]** = read in this repo; **[VERIFY]** = confirm with Guesty / a
> sandbox test before relying on it.

---

## 1. How payments work today (Stripe) — and why the team can't extend in Guesty

The live checkout charges through **your own Stripe account (HALTAN LLC)**, then creates
the Guesty reservation:

1. Guest pays via the Stripe PaymentElement → a Stripe PaymentIntent succeeds.
   `src/components/booking/stripe-payment.tsx`, `src/app/api/payment-intent/route.ts`.
2. The Stripe webhook finalizes: `src/app/api/stripe/webhook/route.ts` →
   `finalizeReservation()` in `src/lib/checkout-finalizer.ts`.
3. Finalize creates the Guesty reservation via `createReservationInstant()` — passing
   **`ccToken = paymentIntent.payment_method.id`** (a Stripe `pm_…` id), then records the
   Stripe-captured amount on Guesty's books via `recordPayment()`. **[code-verified]**
   (`checkout-finalizer.ts:363-398`)

**Why the team can't extend in Guesty:** the reservation's payment instrument is a
**Stripe payment method in your own Stripe account**, not a card vaulted in Guesty Pay.
Guesty's UI can change the dates, but it has no chargeable card on file, so it can't
collect the extra (or refund) — that has to happen in Stripe. The whole orphan /
double-charge class of bugs we fixed this cycle also stems from this **two-system split**
(Stripe charge + a *separate* Guesty reservation creation).

---

## 2. What already exists for Guesty Pay (the good news)

This started life as a **Guesty direct-booking template**, so the Guesty Pay path is
scaffolded — it was just never wired in (Traverse chose Stripe at launch; the component's
only git history is the initial commit). **[code-verified]**

- **`src/components/booking/guesty-pay-payment.tsx`** — a complete client component using
  Guesty's tokenization SDK (`@guestyorg/tokenization-js`, installed `^1.1.1`). It renders
  Guesty's card field in your *own* checkout, validates, and on submit returns a **real
  Guesty `ccToken`** via `onPaymentMethod(ccToken)`. Card-only (no Apple/Google Pay).
- **`createReservationInstant()`** (`guesty-beapi.ts:500`) already takes a `ccToken` and
  POSTs to Guesty `/api/reservations/quotes/{quoteId}/instant` — this is the call that, with
  a *real* Guesty token, makes Guesty Pay both **charge the card and vault it on the
  reservation**. **Both** the single-booking (`checkout-finalizer.ts`) and cart
  (`cart/checkout-coordinator.ts`) flows already call it. **[code-verified]**
- Sibling endpoints already wrapped for the SCA/3DS variant:
  `createInstantChargeReservation()` (`/instant-charge`) + `verifyPayment()`
  (`…/verify-payment`) in `guesty-beapi.ts:527-574`. **[code-verified]**
- CSP already allows `pay.guesty.com` (script/connect/frame) in `src/lib/csp.ts`.

**The core insight:** the reservation-creation call is *identical* in both worlds — it
already takes a `ccToken`. Switching to Guesty Pay is mostly: **change where the token
comes from (Guesty SDK instead of Stripe) and let Guesty's `/instant` endpoint do the
charge instead of Stripe.** This is a payment-*capture* swap, not a reservation-flow rebuild.

---

## 3. Target architecture (Guesty Pay)

1. Guest fills the checkout form (unchanged: dates, guest details, upsells, pets).
2. Payment field = **`GuestyPayPayment`** (Guesty tokenization) instead of the Stripe
   PaymentElement. On submit it tokenizes → **Guesty `ccToken`**.
3. Client POSTs `{ quoteId, ratePlanId, ccToken, guest, policy }` to a **new server route**
   → `createReservationInstant()` → Guesty **charges via Guesty Pay** (your lower
   negotiated rate) and **vaults the card on the reservation**. (Use `/instant-charge` +
   `verifyPayment` if SCA/3DS is required — see Phase 0.)
4. On success: fire purchase tracking, redirect to confirmation.

Net effects:
- **Card is on file in Guesty** → team extends/refunds/charges incidentals **natively in
  the Guesty UI**. The original ask is solved with zero custom tooling.
- **Atomic create+charge in one system** → the orphan ("charged, no reservation") and
  double-charge classes largely disappear; the Stripe↔Guesty reconciliation goes away.
- **Lower processing cost** on every booking.

---

## 4. What gets removed / simplified

- Stripe PaymentElement + **ExpressCheckout (Apple/Google Pay)** — `stripe-payment.tsx`.
- `POST/PATCH /api/payment-intent` (Stripe PI create/update) + its double-charge guard.
- `POST /api/stripe/webhook` as the booking finalizer (Guesty Pay finalizes inline on the
  tokenize→instant call, not via a Stripe webhook).
- The orphan-sweep cron + double-charge detection become **largely redundant** for *new*
  bookings (keep them running through the transition for legacy Stripe reservations).
- **Keep:** the read-only diagnostics (`reservation-tools` actions) — still useful.

---

## 5. Open questions to resolve FIRST (Phase 0 — de-risk)

These decide feasibility/scope. Don't start UI work until these are answered.

1. **Apple Pay / Google Pay — the biggest risk.** Guesty's tokenization component is
   **card-only** here, and mobile is our real audience (Grand Lodge funnel). Losing one-tap
   wallet checkout could dent mobile conversion. **[VERIFY]** whether Guesty tokenization
   supports wallets at all; if not, quantify the expected conversion impact and decide if
   it's acceptable.
2. **Does `/instant` actually charge via Guesty Pay with a real token?** Today we pass a
   Stripe `pm_…` as `ccToken` and *also* charge via Stripe, so Guesty's charge is currently
   effectively a no-op/record. **[VERIFY]** in a Guesty sandbox: a real Guesty token →
   `/instant` charges the card through Guesty Pay (the listing's payment provider) and vaults
   it. Confirm there's no double-charge.
3. **SCA / 3DS.** Card payments may need a verification step. The repo already wraps
   `/instant-charge` + `verify-payment` for this. **[VERIFY]** whether to use `/instant`
   (no 3DS) or `/instant-charge` + `verifyPayment` (handles 3DS) for live US cards.
4. **`paymentProviderId` source.** The tokenization render needs the listing's Guesty
   payment-provider id. Nothing fetches it today. **[VERIFY]** the BEAPI field/endpoint that
   exposes it per listing (likely on the listing or quote payload / an `activeAccounts` call).
5. **SDK version.** `@guestyorg/tokenization-js` is pinned `^1.1.1` but the component calls
   `loadScript({ version: "v2" })` / `GuestyTokenizationV2Namespace`. **[VERIFY]** the
   installed package exposes the v2 API used (may need an upgrade).
6. **Payouts / disputes / reporting** move from your Stripe to Guesty. **[VERIFY]** payout
   timing, any reserve, and that chargeback handling via Guesty is acceptable.
7. **Fee confirmation** — record the negotiated Guesty Pay rate vs current Stripe effective
   rate so the savings are quantified.

---

## 6. Work breakdown (after Phase 0 passes)

**Phase 1 — server plumbing** (~2–3 days)
- Add a `paymentProviderId` lookup per listing/quote.
- New server route `POST /api/reservations/guesty-instant` (or extend an existing one):
  validate quote, call `createReservationInstant()` (or `/instant-charge` + `verifyPayment`),
  return the confirmation. Add **idempotency** keyed on quote/stay so a retry can't
  double-book.
- Reuse the existing finalize side-effects (DB upsert, tracking) minus the Stripe pieces.

**Phase 2 — checkout UI** (~3–5 days)
- Wire `GuestyPayPayment` into `checkout-form.tsx` in place of `stripe-payment.tsx`
  (keep the guest form, upsells, pets, terms). Update to the confirmed SDK version; handle
  errors + 3DS flow.

**Phase 3 — tracking parity** (~1–2 days)
- Re-fire GA4 / Meta / Klaviyo purchase events off the Guesty success (server + client),
  matching today's `item_variant`/value semantics.

**Phase 4 — modifications** (mostly validation)
- Confirm the team can extend/shorten/refund/charge incidentals natively in Guesty on a
  Guesty-Pay reservation. Optionally re-point the *guest* self-serve extend
  (`extend-stay.tsx`) at the new rail.

**Phase 5 — cutover** (~2–4 days + monitoring)
- Feature-flag both rails; canary a small % of bookings on Guesty Pay; watch conversion
  (esp. mobile), charge success, and reservation creation; then flip the default.
- **Run both rails during transition:** existing **Stripe-paid reservations still need
  Stripe** for their refunds/extends. The small Stripe admin-extend tool (separately
  proposed) may still be worth building for the legacy Stripe cohort.
- Decommission the Stripe checkout once new-booking volume is fully on Guesty Pay and the
  legacy Stripe cohort has aged out (past all check-outs + refund windows).

---

## 7. Risks & decisions summary

| Risk / decision | Notes |
|---|---|
| **Apple/Google Pay loss** | Biggest unknown; verify wallet support; mobile conversion impact. |
| **Legacy Stripe reservations** | Keep Stripe rail alive for their mods/refunds during/after cutover. |
| **SCA/3DS** | Use `/instant-charge` + `verifyPayment` if live cards need it. |
| **Tracking parity** | Must re-wire purchase events; verify GA4 ecommerce + Meta/Klaviyo. |
| **Payouts/disputes** | Move to Guesty; confirm timing/reserve acceptable. |
| **"No booking fees" branding** | Unaffected — guest price unchanged; *your* cost drops. |

---

## 8. Recommendation

**Proceed — start with Phase 0.** The economics now favor Guesty Pay (cheaper), it solves
the team-modification gap natively, it removes the bug-prone two-system split, and the
integration is **already substantially built** (tokenization component exists;
`createReservationInstant` already takes a `ccToken` in both flows). The migration is much
smaller than a typical payment re-platform.

The single gating item is **Apple Pay / wallet support** (Phase 0, item 1) — resolve that
before committing to the UI work, since it's the one place this could regress conversion.

Rough effort after Phase 0: ~2–3 weeks of focused work plus a careful canaried cutover.
