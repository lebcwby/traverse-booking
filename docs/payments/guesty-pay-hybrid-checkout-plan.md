# Hybrid checkout plan — GuestyPay (cards) + Stripe (Apple/Google Pay)

**Status:** Plan. Build-ready once the Guesty **sandbox BEAPI creds** land (same
blocker as the GuestyPay reactivation). Everything below is flag-gated; the live
Stripe checkout stays untouched until we flip the flag.

## Goal

Route payments **by method, not by device**:

- **Credit/debit cards (~87.5% of bookings) → GuestyPay.** Cheaper negotiated
  processing, card vaulted in Guesty → team can extend/refund/modify natively,
  kills the orphan/double-charge split for the card majority.
- **Apple Pay / Google Pay (~12.5%, skews mobile) → Stripe.** GuestyPay
  tokenization is **card-only** (confirmed: SDK + Guesty docs), so wallets *must*
  stay on Stripe. Keeping them preserves those (mostly-mobile) conversions.

Rejected alternative — *Stripe on mobile / GuestyPay on desktop*: splits on the
wrong axis. Most mobile bookings are still **card** payments (only ~12.5% overall
use a wallet), so device-routing would shove a large chunk of mobile *card*
bookings back onto Stripe and strand desktop wallet users. Method-routing is
strictly better.

## What already exists (reuse, don't rebuild)

**Stripe rail — `src/components/booking/checkout-form.tsx`:**
- `<ExpressCheckoutElement>` already renders Apple/Google Pay wallet buttons
  (auto-appears only on supporting device/browser).
- `handleExpressPaymentSuccess(piId, billingDetails)` → collects any missing
  guest fields via a modal → `handleExpressReservation(piId, expressGuest)` →
  creates the reservation via the current Stripe path (charge in Traverse's
  Stripe, `pm_…` fed to `createReservationInstant` as `ccToken`; card vaulted in
  Stripe). **This is the proven wallet flow — keep it verbatim.**
- Also renders `<PaymentElement>` for manual cards → **this is the part the
  hybrid replaces with GuestyPay.**

**GuestyPay rail — built + flag-gated (PRs #48/#49/#50):**
- `src/components/booking/guesty-pay-checkout.tsx` — guest form +
  `<GuestyPayPayment>` tokenization field → `onPaymentMethod(ccToken)` →
  `POST /api/reservations/guesty-instant`.
- `src/app/api/reservations/guesty-instant/route.ts` — `createReservationInstant`
  with the real Guesty ccToken (GuestyPay charges + vaults) → persist +
  `trackBookingServerSide`; advisory-locked per quote; 3DS via
  `{requiresAuth, authUrl}`; defensive charge-verification.
- `src/app/book/[quoteId]/page.tsx` — flag `NEXT_PUBLIC_GUESTY_PAY_ENABLED`
  chooses `<GuestyPayCheckout>` vs `<CheckoutForm>` (default OFF → Stripe).

## Target architecture

A **single checkout component** (extend `GuestyPayCheckout` → `HybridCheckout`, or
compose both) that renders, top-to-bottom:

1. **Wallet zone (Stripe):** `<ExpressCheckoutElement>` configured to **only**
   `applePay` + `googlePay` (no card, no Link/PayPal). Wraps in the existing
   Stripe `<Elements>` provider (needs a PaymentIntent for the amount). On tap →
   the existing `handleExpressPaymentSuccess` → Stripe reservation path.
   - The element auto-hides on devices without a wallet, so desktop-no-wallet
     users simply don't see it.
2. **Divider:** "or pay with card".
3. **Card zone (GuestyPay):** shared guest form + `<GuestyPayPayment>` →
   `onPaymentMethod(ccToken)` → `/api/reservations/guesty-instant`.

Both paths converge on `/book/confirmation/[reservationId]`.

### Routing (by control used)

| Guest action | Rail | Charge / vault | Reservation created by |
|---|---|---|---|
| Taps Apple/Google Pay | **Stripe** | Traverse Stripe | existing `handleExpressReservation` |
| Enters card + Reserve | **GuestyPay** | Guesty (amaryllis) | `/api/reservations/guesty-instant` |

## Build checklist

1. **`HybridCheckout` component** — compose the Stripe `<Elements>` +
   `<ExpressCheckoutElement>` (wallets-only) with the GuestyPay guest form +
   `<GuestyPayPayment>`. Share one guest-info state between both.
2. **Wallets-only Express config** — pass
   `paymentMethods={{ applePay: 'auto', googlePay: 'auto', link: 'never' }}` (or
   equivalent) and drop `<PaymentElement>` from this component.
3. **Mutual-exclusion guard** — one `submitting` flag disables the other rail
   while a payment is in flight (belt-and-suspenders over the server dedup).
4. **`/book` flag branch** — introduce `NEXT_PUBLIC_CHECKOUT_MODE` =
   `stripe` (default) | `guestypay` (cards only, no wallets) | `hybrid`. Map:
   - `hybrid` → `<HybridCheckout>` (this plan)
   - `guestypay` → `<GuestyPayCheckout>` (existing)
   - `stripe`/unset → `<CheckoutForm>` (current live)
   Keep `NEXT_PUBLIC_GUESTY_PAY_SANDBOX` for the SDK sandbox.
5. **Upsells/pet fees on the GuestyPay rail (PREREQUISITE)** — the GuestyPay path
   is currently base-booking-only (`TODO(upsells)` in guesty-instant). The hybrid
   card path must include upsells + pet fee so the **charged amount matches** the
   Stripe wallet path. Wire `resolveUpsellsForListing` / `petFeePerPet` into the
   guesty-instant total. **This must be done before hybrid go-live.**
6. **Amount parity check** — assert the Stripe PI amount and the Guesty charge
   both equal `quote.pricing.total + upsellTotal` (guard against divergence).
7. **Tracking** — both rails already fire `trackBookingServerSide`/completed;
   confirm `add_payment_info` fires for the GuestyPay card path too (today it's
   Stripe-card-gated), else the funnel undercounts card-info entry.

## Risks & guards

- **Wallet subset keeps Stripe limitations.** Cards from Apple/Google Pay live in
  Stripe, not Guesty → those ~12.5% reservations still can't be modified natively
  in Guesty, and still need the **orphan-sweep + double-charge guards** running.
  Accepted tradeoff (minority; the alternative is losing wallet conversions).
- **Two rails permanently** = two reconciliation paths + more surface area. Keep
  the Stripe finalizer/webhook and its guards; add GuestyPay charge-verification
  (already built).
- **Double-booking** — same quote could in theory hit both rails. Mitigations:
  UI mutual-exclusion + guesty-instant advisory lock + Stripe finalizer's
  `booking-identity` fingerprint dedup. Verify in the test matrix.
- **3DS/SCA** — GuestyPay path redirects via `authUrl`; Stripe handles wallet SCA
  natively. Both need a clean return to confirmation.
- **Amount mismatch** — the #6 parity assert is the safety net.

## Test matrix (needs sandbox creds)

- Card via GuestyPay — success, decline, **3DS challenge** (authUrl round-trip).
- **Apple Pay** via Stripe on a real iPhone/Safari; **Google Pay** on Android/Chrome.
- Desktop, no wallet → only the GuestyPay card form shows.
- Express **missing-info modal** (wallet with no phone/email).
- **Upsells + pet fee** on *both* rails → identical charged total.
- Double-submit / rapid retry → exactly one reservation.
- Charge-verification: reservation created but payment failed → blocked (402), alerted.

## Cutover / canary

Flag-based rollout: enable `hybrid` on a **preview** deploy first, run the matrix,
then canary in prod (small %, or a single test listing) watching **mobile
conversion**, **wallet success rate**, **GuestyPay charge success**, and
**reconciliation (no new orphans on the card path)**. Ramp once clean.

## Effort & blocker

- Effort after the upsells prerequisite: ~**1–1.5 weeks** to build + a canaried
  cutover — most pieces (both rails) already exist; this is composition + routing.
- **Blocker (unchanged):** Guesty **sandbox BEAPI creds + test listing** to run
  the payment tests. Nothing ships until that test passes.

Related: `docs/payments/guesty-pay-reactivation-plan.md`,
`docs/payments/guesty-pay-sandbox-test.md`.
