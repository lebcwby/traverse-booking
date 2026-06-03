# The $3.71 Stripe-vs-Guesty reconciliation delta

**Status (2026-06-03):** root cause identified, awaiting written confirmation
from Guesty support (Lorenzo, Customer Experience). No code change required
beyond the already-shipped `resolveAmountVsBalance` safety net.

## Symptom

A direct booking with a paid extra (e.g. the **Pet Fee**, default **$50**)
is captured in full by Stripe, but recording that payment against the Guesty
reservation fails with:

```
Payment amount can't be greater than balance due
```

`resolveAmountVsBalance` (`src/lib/guesty-openapi.ts`) then fetches the
reservation's actual `money.balanceDue`, retries the record with that value,
and flags `mismatch: true`. The retried balance comes back **$3.71 short** of
the captured amount.

## Why it is NOT a platform fee

Guesty confirmed (2026-05-29) their quote engine and reservation engine agree
on `hostPayout`, so the delta is not a Guesty service/platform fee skimmed off
the top. The delta only appears on bookings that add an **invoice item**.

## Root cause (high confidence — tax-inclusive invoice item)

We add the extra via `addInvoiceItem` (`src/lib/checkout-finalizer.ts` →
`POST /v1/invoice-items/reservation/{id}` in `src/lib/guesty-openapi.ts`).
The body carries a bare `amount` plus an `accountFeeId` that references a
**predefined, taxable Guesty Account Fee**:

```ts
await addInvoiceItem(reservationId, {
  title: "Pet Fee",
  amount: 50,                    // DEFAULT_PET_FEE_PER_PET, src/lib/upsells.ts
  normalType: "AFE",
  secondIdentifier: "PET",
  accountFeeId: "67fc4907f2cc23000e67992c",
});
```

Because the item links to a taxable Account Fee, Guesty appears to interpret
the posted `amount` as **tax-INCLUSIVE (gross)** and back the tax out of it:

| Posted amount | Net fee on balance | Tax line | Reconstructed total |
|---|---|---|---|
| $50.00 | **$46.29** | **$3.71** (≈8.0%) | $50.00 |

`46.29 × 1.08 = 49.99`, and `50.00 − 46.29 = 3.71`. So the reservation's
`balanceDue` only rises by the **net $46.29**, while Stripe captured the full
**$50.00** the guest agreed to — leaving the $3.71 reconciliation gap.

## Open question for Guesty (see draft reply below)

We need a written answer to: *when an invoice item is POSTed with an `amount`
and an `accountFeeId` pointing at a taxable Account Fee, is `amount` treated as
tax-INCLUSIVE (gross, tax split out — what we observe) or tax-EXCLUSIVE (net,
tax added on top)?* The answer decides whether we should keep posting the
gross figure (guest's all-in price, matches Stripe) or switch to posting the
net so balanceDue lands on $50.

## Diagnostic

`scripts/probe-quote-money.ts` — READ-ONLY. Dumps a real quote's full `money`
object (creates ephemeral quotes only, never a reservation, never a charge) so
the `hostPayout` / `totalPrice` / `invoiceItems` fields can be compared
side by side.

```
unset ANTHROPIC_API_KEY && unset ANTHROPIC_BASE_URL
npx tsx --env-file=.env.local scripts/probe-quote-money.ts
```
