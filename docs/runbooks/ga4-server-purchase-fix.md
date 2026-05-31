# Runbook: server-side GA4 purchase events not landing

**Symptom:** A reservation is confirmed + paid (visible in Guesty PMS and in our
`reservations` table with a `stripe_payment_intent_id` and `payment_recorded_at`),
but GA4 → Reports → Drive sales → *Ecommerce purchases* shows **0 items purchased**
for the day, even though *Items viewed* / *Items added to cart* populate normally.

**Examples seen:** GY-zBMnaYA8, GY-dmwm6uVF (flagged 2026-05-24), GY-XaH3sK9M
(2026-05-29).

---

## ⚡ STATUS as of 2026-05-30: pipeline VERIFIED HEALTHY

Ran `/api/admin/inspect-ga4?fire=true` against prod: `measurementId=G-8NK72KVMJJ`,
secret fingerprint `zY…_Q` (len 22), `liveFireStatus=204`, and the
`TEST-GA4-INSPECT` purchase **landed in G-8NK72KVMJJ Realtime**. So the MP
secret↔property pairing is **valid** and server-side purchases deliver. The
"secret minted under the old property" theory below is **disproven for prod** —
it was based on the *stale `.env.local` value* (`mK…qA`, paired with the old
G-C5098JP52V); prod uses a different, correct secret.

If a confirmed+paid booking still looks missing, it's almost always one of:
1. **Standard-report lag (24–48h).** The *Ecommerce purchases* report is the
   laggiest GA4 surface. Verify by searching the **next-day** report for
   `transaction_id = <confirmation code, e.g. GY-XaH3sK9M>` — don't judge from
   "today".
2. **Declined analytics consent.** server-tracking.ts gates the GA4 `purchase`
   on `consent.analytics !== false`. Guests who decline analytics produce no
   server GA4 purchase (structural, not a bug). Decide separately whether the
   server-side conversion should be consent-independent.
3. Single-listing `pending_checkouts` rows are **deleted on completion**, but
   the finalizer rebuilds `tracking` from `quoteContext.trackingDefaults`, so a
   missing pending row does NOT block the event — don't be alarmed by an empty
   `pending_checkouts` table.

The section below is retained for the historical (now-fixed) failure modes.

## Root cause (historical — verify before assuming)

We send purchases to GA4 **two ways**:

| Path | Where | Reliability |
|---|---|---|
| Client-side `purchase` | `track-confirmation.tsx` on the confirmation page, via gtag | Fragile — skipped if the guest closes the tab after paying, declines analytics consent, or uses an ad-blocker. |
| **Server-side `purchase`** | `trackBookingServerSide()` in `checkout-finalizer.ts` (Stripe webhook), via GA4 **Measurement Protocol** | Should never miss — fires for every confirmed+paid booking. **This is the safety net.** |

The server-side path is **silently dropped by GA4** when the
`GA4_MP_API_SECRET` does not belong to the property in
`NEXT_PUBLIC_GA4_MEASUREMENT_ID`.

> ⚠️ The Measurement Protocol production endpoint (`mp/collect`) **always
> returns HTTP 204**, even for an invalid `measurement_id` + `api_secret`
> pair. So the finalizer logs success while GA4 throws the event away.
> The `debug/mp/collect` endpoint does **not** help either — it validates
> payload *shape* only, not secret↔property ownership. Both return "valid".

**How we got here:** the canonical property was flipped
`G-C5098JP52V` → **`G-8NK72KVMJJ`** on 2026-05-13. Production's
`NEXT_PUBLIC_GA4_MEASUREMENT_ID` was updated to G-8NK72KVMJJ (confirmed: the
live site embeds only `G-8NK72KVMJJ`), but the **MP API secret was minted
under the OLD property** and never regenerated. Result: client funnel events
land correctly in G-8NK72KVMJJ; server-side purchases are sent to
G-8NK72KVMJJ with a secret GA4 won't honor → dropped.

---

## Confirm (pick one, ~1 min)

1. **GA4 Admin (definitive):**
   Admin → **Data streams** → *Book Traverse* (**G-8NK72KVMJJ**) →
   **Measurement Protocol API secrets**.
   Is the secret currently in Vercel (fingerprint `mK…qA`, len 22) listed here?
   - **Listed** → pairing is fine; the cause is elsewhere (see "If the secret is correct").
   - **Not listed** (only exists under the old G-C5098JP52V stream) → confirmed root cause.

2. **Live-fire test:** signed in as an admin, open
   `https://www.booktraverse.com/api/admin/inspect-ga4?fire=true`, then watch
   GA4 → **Realtime** (or DebugView) for a `TEST-GA4-INSPECT` purchase under
   G-8NK72KVMJJ. No show within ~60s → secret not paired with this property.

---

## Fix

1. GA4 Admin → Data streams → **G-8NK72KVMJJ** web stream →
   **Measurement Protocol API secrets** → **Create** (nickname e.g.
   "server-side booking events"). Copy the **secret value**.
2. In **Vercel → traverse-booking → Settings → Environment Variables**, set
   `GA4_MP_API_SECRET` (Production) to the new value. *(Nadim performs the paste.)*
   - This is **not** a `NEXT_PUBLIC_*` var, so the `--force` cache rule does not
     apply, but a redeploy is still required to pick up the new value.
3. Redeploy prod: `npx vercel@53.1.0 deploy --prod --yes` (or push to `main`).
4. **Verify:** re-run the live-fire test (step 2 under *Confirm*). The
   `TEST-GA4-INSPECT` purchase should appear in **Realtime/DebugView** under
   G-8NK72KVMJJ within ~60s. Then the next real booking's server-side purchase
   will land automatically.
5. Update `.env.local` so local matches prod (it currently still has the OLD
   `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-C5098JP52V` paired with the secret —
   set it to `G-8NK72KVMJJ` and use the new secret).

---

## If the secret IS correct (pairing confirmed in Admin)

Then server-side is fine and the gap is one of:
- **Processing lag** — the standard *Ecommerce purchases* report settles 24–48h
  behind. Check **Realtime/DebugView** for recent bookings instead.
- **Client-only undercount** is irrelevant once server-side works (server fires
  for every booking).
- Check Vercel **function logs** for the Stripe webhook around the booking time:
  grep `[GA4 MP] purchase failed` (logged on non-204) and confirm
  `trackBookingServerSide` ran.

---

## Important caveats

- **No backfill.** MP rejects events older than ~72h, so bookings missed before
  the fix (GY-XaH3sK9M et al.) will **not** retroactively appear in GA4. GA4
  purchase/revenue is **undercounted** until the secret is fixed — but the
  bookings are safe in Guesty + the `reservations` table, which is the revenue
  source of truth, not GA4.
- After fixing, the canonical-flip cleanup (GTM container `GTM-WMD2QJS6` GA4
  config tag, Google Ads link `AW-16519101211`) still points at old properties —
  see CLAUDE.md "P3 deferred". Those are separate from this MP-secret fix.
