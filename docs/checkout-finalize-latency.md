# Checkout finalize latency — scope

**Status:** scoped, not started · **Written:** 2026-10-07

## The problem

A guest pays. The charge succeeds in seconds. But the reservation doesn't
exist yet — `finalizeReservation` still has to run, and only when it finishes
does the guest reach the confirmation page. That gap is the whole risk: the
card is charged, nothing is confirmed, and the guest is watching a spinner.

**GY-Z6iXznfG, 2026-10-07.** Joel Coggin sat in that window for 116 seconds,
decided it had failed, and paid again. The second charge landed 14 seconds
after his own reservation appeared, and Guesty refused it because his own
booking had taken the dates. He was charged $793.58 twice.

PR #67 stops the duplicate charge. It does not shorten the window that
provoked it.

### How wide the window is

`completed_at - created_at` on completed `pending_checkouts`, last 60 days
(n=163):

| p50  | p75  | p90  | p95  | max     |
| ---- | ---- | ---- | ---- | ------- |
| 125s | 251s | 484s | 715s | 18,799s |

**52% of checkouts take more than two minutes. 86% take more than one.**

⚠️ **Read that honestly.** The clock starts when the pending-checkout row is
written, just before the guest confirms payment, so it includes the guest's
own card entry and any 3DS step — not purely server time. It is an upper
bound on finalize, not a measurement of it. **Step 1 of this work is to
measure the server portion directly**, because everything below is sized
against a number we have not yet isolated.

## What the critical path actually does

Everything here is `await`ed before the guest gets a response. Worst-case
sleep budget is listed where the code sleeps on purpose.

| #   | Step                                                     | External                                   | Deliberate sleep    |
| --- | -------------------------------------------------------- | ------------------------------------------ | ------------------- |
| 1   | `getListingWithBeapiFallback`                            | BEAPI                                      | —                   |
| 2   | `stripe.paymentIntents.retrieve`                         | Stripe                                     | —                   |
| 3   | `getAuthoritativeQuoteContext`                           | BEAPI                                      | —                   |
| 4   | `createReservationInstant` ×3 attempts                   | BEAPI                                      | **6s** (2s + 4s)    |
| 5   | `stripe.paymentIntents.update` (writes confirmationCode) | Stripe                                     | —                   |
| 6   | fixed wait before invoice items                          | —                                          | **2s**              |
| 7   | `addInvoiceItem` ×2                                      | Guesty                                     | —                   |
| 8   | Supabase client + reservation row writes                 | DB                                         | —                   |
| 9   | `recordPaymentWithIndexingRetry` ×6 attempts             | Guesty                                     | **15s** (1+2+3+4+5) |
| 10  | `lookupFirstTouchAttribution`                            | DB                                         | —                   |
| 11  | `trackBookingServerSide`                                 | GA4 MP + Meta CAPI + Google Ads            | —                   |
| 12  | `markPendingCheckoutCompleted`                           | DB                                         | —                   |
| 13  | `sendBookingConfirmation`                                | Resend + dashboard Supabase + YoY calendar | **up to ~21s**      |

**The guest has everything they need after step 5.** `reservationId` and
`confirmationCode` both exist. Steps 6–13 are bookkeeping, analytics and an
_internal_ email — and the guest waits for all of it.

Two stand out:

- **Step 13 is an internal ops email**, to `bookings@` and `nadim@`. Before it
  sends, it does a dashboard Supabase lookup (two 5s-timeout fetches) and
  builds a year-over-year nightly rate table (a 10s-timeout fetch with a retry
  and 500ms sleeps). A paying guest waits on a rate-comparison table they will
  never see.
- **Step 9's 15s of backoff** exists for a real Guesty indexing race, but
  `/api/cron/record-payments` already backstops it.

## Why it is not simply "stop awaiting"

`trackBookingServerSide` is awaited **deliberately**, and the comment says why:

> MUST await — without it, the Stripe webhook returns 200 and Vercel freezes
> the lambda before the GA4 / Meta CAPI / Google Ads fetches land. That
> silently drops every BE-API purchase from GA4 (see missing GY-zBMnaYA8 /
> GY-dmwm6uVF on 2026-05-23).

Fire-and-forget was tried and lost purchase events. Any change here must keep
the work alive after the response, not just drop the `await`. That means
`waitUntil()` from `@vercel/functions`, **which is not currently a dependency**
and would need adding.

## Proposed phases

### Phase 0 — measure (do this first, ship nothing else until it lands)

Time each step and log a single structured line per finalize: total, plus
per-step durations for the 13 above. Emit on both the webhook and frontend
paths.

Answers the question the table above cannot: how much of the 125s p50 is ours?
If the server portion is 8s, most of this plan is not worth doing and the real
problem is the payment UX. If it is 60s, everything below is justified.

_Risk: none. Logging only._

### Phase 1 — move the internal email off the critical path

`sendBookingConfirmation` → `waitUntil()`. Nothing the guest sees depends on
it. Removes up to ~21s of third-party latency from the worst case.

_Risk: low. Needs `@vercel/functions`, and the email must be verified still
arriving after the change — it is the notification the team actually reads._

### Phase 2 — move analytics off the critical path

`trackBookingServerSide` → `waitUntil()`, keeping the promise alive so the
2026-05-23 regression cannot recur.

_Risk: medium. This is the exact failure that forced the await. Verify a real
booking lands in GA4 realtime with its `transaction_id` before and after.
Revert trigger: any booking missing from GA4._

### Phase 3 — return as soon as the reservation is real

Respond to the guest after step 5 and run steps 6–12 in `waitUntil()`.
Confirmation page already resolves everything server-side from the reservation
row, so it does not need the finalizer's return value.

_Risk: higher — this reorders the money path. `recordPayment` would move
behind the response, relying on `/api/cron/record-payments` as the backstop it
already is. Needs the Phase 0 numbers to justify, and its own careful review._

### Phase 4 — revisit the sleep budgets

The 2s fixed wait (step 6) and the 1+2+3+4+5s payment-record backoff were
tuned against a Guesty indexing race measured at ~3–9s. Re-measure; if
indexing is faster now, shorten. Only worthwhile if Phases 1–3 do not already
move the number.

_Risk: medium — these sleeps exist because the race is real. Shortening them
trades latency for more work landing on the recovery cron._

## Success criteria

- p50 and p95 of the **server-side** portion, before and after, from Phase 0's
  logging.
- No GA4 purchase regression: confirm the test booking appears with its
  `transaction_id` (allow 24–48h for the standard report; use realtime first).
- No increase in `paid-booking-manual-recovery` or `audit-payment-records`
  findings over the following two weeks.
- Target: the guest sees confirmation in **under 10s** server-side.

## Explicitly out of scope

- GuestyPay reactivation — parked separately, see
  `project_traverse_guesty_pay_reactivation`.
- The `withAdvisoryLock` wrapper. It is working and it is what stops two
  finalizers racing; the lock is held across steps 1–13 today, and Phase 3
  must keep it held across whatever remains in the critical section.
- Changing how reservations are created in Guesty (BE-API instant).

## One caution

CLAUDE.md's own ground rule applies here more than anywhere:

> **Money paths need real end-to-end tests**, not code review. Two orphaned
> test charges and one real double-charge came from shipping payment code that
> only _looked_ right.

Phases 2 and 3 move money-adjacent work behind the response. Neither should
ship on a green typecheck.
