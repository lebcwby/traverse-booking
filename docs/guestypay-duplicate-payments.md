# GuestyPay double-capture — what the data actually says

Investigated 2026-10-14. Fix shipped in #90 and proven on one reservation; **~100 dormant
rows remain to be voided** — see CLAUDE.md → Open work → item 1 for the commands.

> Two successive explanations of this bug were confidently documented and both were
> wrong. Sections 1 and 2 below are the evidence, not the narrative. If you are about to
> act on a claim in here, re-run the scripts in section 5 first.

---

## 1. The documented fix would not have worked

CLAUDE.md and `audit-payment-records` both state the mechanism as:

> `createReservationInstant` passes the Stripe payment method as `ccToken`, so Guesty
> has a chargeable card on every direct booking, and the auto-payment rule can and
> does use it.

**The payment records contradict this.** A MongoDB ObjectId embeds its creation time, so
every `paymentMethodId` can be dated exactly:

| Reservation | Card that was actually charged | Created                   |
| ----------- | ------------------------------ | ------------------------- |
| GY-hNBNy23v | `6a6e8fe595…`                  | **+51 min** after booking |
| GY-SHHhdMpj | `6a5671fb4e…`                  | **+943 min** (16 h)       |
| GY-5RAz3apL | `6a62af7fa7…`                  | **+5,703 min** (4 days)   |

Our `ccToken` is passed at reservation creation, t=0. **The card that was charged did not
exist yet** — in one case for four days. Removing `ccToken` would not have prevented any
of these three.

Our own Stripe-noted rows all use `58a1930e85…`, created **February 2017** — an
account-level "external payment" record, not a card.

### What appears to happen instead

In all three cases the auto-rule capture used the **same `paymentMethodId` as a later
manual charge** — a $50 pet fee, "$85.54 guest added September 14", "$160.51 added
July 28". The shape:

1. On listings where the rule is enabled, booking creates a note-less payment row
   alongside ours. It starts **PENDING** — there is no card it can charge.
2. It sits dormant, sometimes for days.
3. Someone later collects an extra through GuestyPay. That vaults a real card.
4. The dormant row fires for the **full original amount**.

⚠️ This fits the three known cases. It is **not proven** as the only trigger.

---

## 2. Scope

Across all **319** direct BE-API reservations, **150** carry both a Stripe row and an
auto-rule row:

|                                                  | count   | value           |
| ------------------------------------------------ | ------- | --------------- |
| 🔴 Double-charged                                | **4**   | $3,289.15       |
| 🟡 Dormant duplicates (PENDING, matching amount) | **109** | **$102,875.15** |
| ✅ PENDING but legitimate (real balances owed)   | 9       | —               |

The double-charged four:

```
GY-hNBNy23v  2026-08-01  $592.90    stripeRow=CANCELLED
GY-5RAz3apL  2026-07-20  $357.19    stripeRow=CANCELLED
GY-SHHhdMpj  2026-07-14  $1,738.41  stripeRow=CANCELLED
GY-cZNjjLNX  2026-06-29  $600.65    stripeRow=CANCELLED
```

Three are the known cases. **GY-cZNjjLNX is a fourth** that was not on the list —
memory records it as "genuinely $50 short", which is a _separate_ issue on the same
reservation; it also carries a $600.65 duplicate.

### ⚠️ The 9 legitimate rows are why this needs care

A PENDING auto-rule row is **not automatically a landmine**. Where the amount is
_complementary_ rather than matching, the rule is collecting a real remaining balance:

```
GY-reaVneZq   Stripe $8,567.65 + auto $1,261.56 = $9,829.21 = hostPayout  ✓
GY-x9pmWpCq   Stripe $1,317.24 + auto $251.10   = $1,568.34 = hostPayout  ✓
```

Any remediation that voids PENDING rows indiscriminately would stop us collecting money
we are genuinely owed. The duplicate signature is **same amount as an existing Stripe
row** — the rule `audit-payment-records` already uses for `guestypay_shadow_charge`.

_(An earlier pass of this analysis counted 14 double-charges by treating every SUCCEEDED
auto-rule row as a duplicate. That was wrong — most were balance collections. The figure
above uses the amount-matching rule.)_

---

## 3. Resolved since

- ✅ **All 4 were refunded.** Confirmed in Stripe by Nadim 2026-10-14. No guest is out of
  pocket. Guesty's own record showed no refund on either leg, because Stripe refunds do
  not appear in Guesty — a reminder that Guesty's ledger cannot answer this question.
- ✅ **Guesty CAN void a PENDING row:** `PATCH /v1/reservations/{id}/payments/{paymentId}/cancel`,
  wrapped as `cancelReservationPayment`.
- ✅ **Cancelling does NOT resurrect a balance.** Guesty's docs warn the cancelled amount
  is "typically added back to balance due"; proven on GY-BQH77T7H that this does not
  apply to a row that never captured — `balanceDue` held at 0, verified by an independent
  read.

Still unknown: whether the "a later collection vaults a card" trigger is the only one,
and whether Guesty RE-CREATES a row after we cancel it.

---

## 4. The fix (shipped, #90)

`/api/cron/void-duplicate-payments` cancels the dormant row before it can fire.

A sweeper rather than a finalizer hook on purpose: a Guesty write inside checkout would
add a new failure mode to the money path, and a sweeper is dry-runnable, independently
testable, and handles both new bookings and the backlog with one piece of code.

Dry run is the default; `?apply=1` is required; `?code=` restricts to one reservation;
every candidate is re-fetched and re-checked immediately before the write; writes are
capped per run; a SUCCEEDED row is never touched.

**Proving run, GY-BQH77T7H, 2026-10-14:**

|                           | before            | after         |
| ------------------------- | ----------------- | ------------- |
| dormant `PENDING $255.75` | present           | **CANCELLED** |
| guest's Stripe payment    | SUCCEEDED $255.75 | **unchanged** |
| `balanceDue`              | 0                 | **0**         |

⚠️ **When a fired one appears: refund the STRIPE leg, never the GuestyPay one** —
GuestyPay is what the reservation is actually paid with, so reversing it leaves the stay
unpaid. Check Stripe for an existing refund first; all four were already refunded by the
time anyone looked.

---

## 5. Reproduce

The detection rule itself is `src/lib/duplicate-payment-rows.ts`
(`findDormantDuplicate`), covered by 12 unit tests including the
complementary-amount case that makes a naive sweep dangerous.

To re-survey live data without writing anything:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.booktraverse.com/api/cron/void-duplicate-payments"
```

That is the same code path the apply run uses, so a dry run is an honest preview rather
than a separate implementation that can drift.

To date the card behind any capture — the step that disproved the `ccToken` theory — take
the `paymentMethodId` and decode the ObjectId's first 4 bytes as a Unix timestamp:

```js
new Date(parseInt(paymentMethodId.slice(0, 8), 16) * 1000);
```

A card created AFTER the booking cannot be anything we supplied at booking time.
