import { getStripeServer } from "@/lib/stripe";
import {
  recordPayment,
  addInvoiceItem,
  isAlreadySettledPaymentError,
  recordPaymentCapped,
  resolveAmountVsBalance,
  type RecordPaymentResult,
} from "@/lib/guesty-openapi";
import { dollarsToCents } from "@/lib/money";
import { paymentTargetColumnsExist } from "@/lib/db-features";
import { toE164US } from "@/lib/phone";
import {
  createReservationInstant,
  getQuote,
  createQuote,
} from "@/lib/guesty-beapi";
import {
  buildStripeDashboardPaymentUrl,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
  sendBookingConfirmation,
} from "@/lib/alerts";
import {
  parseGA4SessionId,
  trackBookingServerSide,
} from "@/lib/server-tracking";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool, withAdvisoryLock } from "@/lib/db";
import { getSelectedUpsells, getUpsellTotal } from "@/lib/upsells";
import { getEffectiveServerConsent } from "@/lib/consent";
import {
  markPendingCheckoutCompleted,
  markPendingCheckoutError,
  type PendingCheckoutRecord,
} from "@/lib/pending-checkouts";
import { getListingWithBeapiFallback } from "@/lib/listing-utils";
import { sendAccountCreationEmail } from "@/lib/emails/account-creation-email";
import {
  lookupFirstTouchAttribution,
  persistVisitorAttribution,
} from "@/lib/visitor-attribution";

export interface ReservationFinalizeInput {
  paymentIntentId: string;
  quoteId: string;
  guest: PendingCheckoutRecord["guest"];
  tracking?: PendingCheckoutRecord["tracking"];
  upsells?: string[];
  pets?: number;
  cookies?: {
    attribution?: string;
    firstTouch?: string;
    ga?: string;
    gaSession?: string;
    consent?: string;
    legacyCcpaOptOut?: string;
    fbp?: string;
    fbc?: string;
  };
  requestContext?: {
    clientIp?: string;
    clientUserAgent?: string;
  };
}

export interface ReservationFinalizeResult {
  reservationId: string;
  confirmationCode?: string;
  status: string;
  guestId?: string;
  eventId: string;
  chargedAmount: number;
  duplicate?: boolean;
  upsellStatus?: { charged?: number; errors?: string[] };
  appliedUpsells?: string[];
  appliedPets?: number;
  tracking?: PendingCheckoutRecord["tracking"];
  // Billing zip + country from Stripe payment_method.billing_details. Returned
  // so the browser can pass them into trackBookingCompleted's user_data — Google
  // Enhanced Conversions requires firstName + lastName + postalCode + country
  // together, otherwise the entire address block (including name) is dropped.
  billingPostalCode?: string;
  billingCountry?: string;
}

export class ReservationPendingRecoveryError extends Error {
  /**
   * The underlying Guesty failure, kept OFF `message` on purpose.
   *
   * `message` is shown to the guest, so it must stay the reassuring
   * "payment received, still finalizing" text. But it was also the only thing
   * thrown, so recover-checkouts caught it and wrote that generic sentence
   * over the detailed `... Guesty error: <cause>` the finalizer had just
   * recorded. Every stuck checkout therefore ended up with 122 characters of
   * boilerplate and no cause — which is why Yang Zhang (2026-09-16) and Ed
   * Frank (2026-10-05) both had to be diagnosed from scratch.
   */
  readonly detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "ReservationPendingRecoveryError";
    this.detail = detail;
  }
}

// Guesty needs ~3-9s to index a freshly created reservation before it accepts
// payment recording. Retry the recordPayment call with progressive backoff so
// the webhook records the payment in-line instead of leaving it to a cron.
// Total budget ≈ 15s (1+2+3+4+5), well inside the 60s webhook maxDuration and
// Stripe's 30s webhook delivery window.
const PAYMENT_RECORD_BACKOFFS_MS = [1000, 2000, 3000, 4000, 5000];

export type RecordPaymentFinal =
  | { outcome: "full" }
  | { outcome: "short"; recordedCents: number; shortfallCents: number }
  | { outcome: "no_op" };

/**
 * Attempt to record a Stripe-captured charge against a Guesty reservation,
 * using the new cents-tracked reserve-then-record protocol when the schema
 * supports it and falling back to the legacy `resolveAmountVsBalance` path
 * when it does not.
 *
 * Post-migration path: a conditional UPDATE in Postgres reserves the top-up
 * amount on the reservation row (CAS on `payment_recorded_cents = observed`
 * AND the new running total `<= payment_target_cents`). ONLY if that UPDATE
 * affects exactly 1 row do we call `recordPaymentCapped`. On anything other
 * than `full`, a REVERT UPDATE rolls the row back by the overshoot amount.
 *
 * Legacy path (pre-migration): the old behavior is preserved verbatim so a
 * code-ahead-of-migration deploy still accepts bookings.
 */
export async function recordPaymentWithIndexingRetry(
  reservationId: string,
  chargedAmount: number,
  paymentIntentId: string
): Promise<RecordPaymentFinal> {
  const pool = getPool();
  const useNewProtocol = await paymentTargetColumnsExist(pool);
  if (!useNewProtocol) {
    await recordPaymentLegacy(reservationId, chargedAmount, paymentIntentId);
    return { outcome: "full" };
  }

  const targetCents = dollarsToCents(chargedAmount);
  let lastError: unknown;
  for (
    let attempt = 0;
    attempt <= PAYMENT_RECORD_BACKOFFS_MS.length;
    attempt++
  ) {
    try {
      const result = await attemptReserveAndRecord({
        reservationId,
        paymentIntentId,
        targetCents,
      });
      if (result.outcome === "full") {
        return { outcome: "full" };
      }
      if (result.outcome === "no_op") {
        // Nothing moved — either Guesty's balance was already 0 (duplicate
        // webhook catching up) or our row was taken by a parallel attempt.
        // Retry a few times while Guesty indexes; the next attempt reads
        // the fresh state.
        lastError = new Error("recordPaymentCapped returned no_op");
      } else {
        // Partial record. The DB running total has advanced to the balance
        // Guesty accepted; the cron will top up the shortfall. We DO NOT
        // keep looping — further in-request attempts won't close the
        // Guesty-side gap (the fee has to land first).
        return {
          outcome: "short",
          recordedCents: result.recordedCents,
          shortfallCents: result.shortfallCents,
        };
      }
    } catch (err) {
      lastError = err;
    }
    const delay = PAYMENT_RECORD_BACKOFFS_MS[attempt];
    if (delay === undefined) break;
    console.warn(
      `[Reservation] recordPayment attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
      lastError instanceof Error ? lastError.message : lastError
    );
    await new Promise((r) => setTimeout(r, delay));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("recordPayment failed after retries");
}

/**
 * The reserve-then-record CAS protocol. Shared by the single-flow finalizer,
 * the cart coordinator, and the top-up cron. All in integer cents.
 *
 *   1. Read the current `payment_recorded_cents` (CAS observation).
 *   2. Conditional UPDATE that advances `payment_recorded_cents` by
 *      `topupCents` ONLY if the row's current value still equals `observed`
 *      AND the new total stays `<= payment_target_cents`. If the UPDATE
 *      affects 0 rows, another worker is ahead of us — return `no_op`.
 *   3. If the reservation held (rowCount = 1), call `recordPaymentCapped`.
 *      - `full` → done. The reserve UPDATE already stamped `payment_recorded_at`
 *                 if we hit target.
 *      - `short`/`no_op`/throw → REVERT the overshoot. On throw, rethrow
 *        after the revert.
 *
 * `topupCents` must be `target - observed` for a top-up call; for the
 * first-record call it is the whole target (observed = 0).
 */
export async function attemptReserveAndRecord(args: {
  reservationId: string;
  paymentIntentId: string;
  targetCents: number;
  observedCents?: number;
}): Promise<RecordPaymentResult> {
  const pool = getPool();
  const { reservationId, paymentIntentId, targetCents } = args;

  let observedCents = args.observedCents;
  if (observedCents === undefined) {
    const { rows } = await pool.query<{ payment_recorded_cents: number }>(
      `SELECT payment_recorded_cents FROM reservations WHERE guesty_id = $1`,
      [reservationId]
    );
    observedCents = Number(rows[0]?.payment_recorded_cents ?? 0);
  }
  const topupCents = targetCents - observedCents;
  if (topupCents <= 0) {
    return { outcome: "no_op" };
  }

  const now = Date.now();
  const reserve = await pool.query<{ new_recorded: number }>(
    `UPDATE reservations
        SET payment_recorded_cents = payment_recorded_cents + $1,
            payment_recorded_at = CASE
              WHEN payment_recorded_cents + $1 >= payment_target_cents
                THEN COALESCE(payment_recorded_at, $4)
              ELSE payment_recorded_at
            END
      WHERE guesty_id = $2
        AND payment_recorded_cents = $3
        AND payment_target_cents IS NOT NULL
        AND payment_recorded_cents + $1 <= payment_target_cents
     RETURNING payment_recorded_cents AS new_recorded`,
    [topupCents, reservationId, observedCents, now]
  );

  if (reserve.rowCount !== 1) {
    // CAS lost — another worker moved the row since our read, or the
    // topup would overflow target. Don't call Guesty.
    return { outcome: "no_op" };
  }

  try {
    const result = await recordPaymentCapped(
      reservationId,
      topupCents,
      paymentIntentId
    );
    if (result.outcome === "full") {
      return result;
    }
    const accepted = result.outcome === "short" ? result.recordedCents : 0;
    const overshoot = topupCents - accepted;
    if (overshoot > 0) {
      await revertReserve(reservationId, overshoot);
    }
    return result;
  } catch (err) {
    await revertReserve(reservationId, topupCents).catch(() => {});
    throw err;
  }
}

async function revertReserve(
  reservationId: string,
  overshootCents: number
): Promise<void> {
  if (overshootCents <= 0) return;
  const pool = getPool();
  await pool.query(
    `UPDATE reservations
        SET payment_recorded_cents = payment_recorded_cents - $1,
            payment_recorded_at = CASE
              WHEN payment_recorded_cents - $1 < payment_target_cents
                THEN NULL
              ELSE payment_recorded_at
            END
      WHERE guesty_id = $2
        AND payment_recorded_cents >= $1`,
    [overshootCents, reservationId]
  );
}

/**
 * Pre-migration code path, kept verbatim. See `resolveAmountVsBalance`
 * deprecation notice for why this is still here. Delete alongside
 * `resolveAmountVsBalance` once the migration is confirmed applied.
 */
async function recordPaymentLegacy(
  reservationId: string,
  chargedAmount: number,
  paymentIntentId: string
): Promise<void> {
  let lastError: unknown;
  for (
    let attempt = 0;
    attempt <= PAYMENT_RECORD_BACKOFFS_MS.length;
    attempt++
  ) {
    try {
      await recordPayment(reservationId, chargedAmount, paymentIntentId, {
        retries: 1,
        timeoutMs: 5000,
      });
      return;
    } catch (err) {
      if (isAlreadySettledPaymentError(err)) {
        try {
          const resolution = await resolveAmountVsBalance(
            reservationId,
            chargedAmount,
            paymentIntentId
          );
          if (resolution.mismatch) {
            const stripeUrl = buildStripeDashboardPaymentUrl(paymentIntentId);
            await sendAlert(
              `Payment amount mismatch — Stripe $${resolution.originalAmount.toFixed(2)} vs Guesty $${resolution.balanceAmount.toFixed(2)}`,
              [
                "<p>The payment was recorded successfully in Guesty, but the amount Stripe captured did not match Guesty's outstanding balance.</p>",
                "<p>Guesty's books are correct (the balance is now $0). The delta below is revenue that lives in Stripe but isn't reflected on the Guesty invoice — usually an unsynced upsell, a fee, or a rounding artifact.</p>",
                renderAlertDetails([
                  ["Reservation", reservationId],
                  ["PaymentIntent", paymentIntentId],
                  [
                    "Stripe captured",
                    `$${resolution.originalAmount.toFixed(2)}`,
                  ],
                  [
                    "Guesty balance (now recorded)",
                    `$${resolution.balanceAmount.toFixed(2)}`,
                  ],
                  [
                    "Delta (extra in Stripe)",
                    `$${resolution.delta.toFixed(2)}`,
                  ],
                ]),
                renderAlertLinks([{ label: "Stripe payment", url: stripeUrl }]),
              ].join(""),
              `amount-mismatch-${reservationId}`
            );
          }
          return;
        } catch (resolveErr) {
          lastError = resolveErr;
        }
      } else {
        lastError = err;
      }
      const delay = PAYMENT_RECORD_BACKOFFS_MS[attempt];
      if (delay === undefined) break;
      console.warn(
        `[Reservation] recordPayment attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        lastError instanceof Error ? lastError.message : lastError
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("recordPayment failed after retries");
}

// ─── TEST BOOKING DETECTION ─────────────────────────────────────
// Prevents test/dev bookings from inflating GA4/Meta/Klaviyo conversion data.
// Real cancellations are handled by refund events; this prevents the purchase
// event from firing at all for obvious test bookings.

const KNOWN_TEST_EMAILS = new Set([
  "trevor.stout164@gmail.com",
  "test@booktraverse.com",
  "testing1@booktraverse.com",
  "testing2@booktraverse.com",
  "trevor@164investments.com",
  "bolton.osaz@gmail.com",
]);

function isLikelyTestBooking(email: string, checkIn?: string): boolean {
  if (KNOWN_TEST_EMAILS.has(email.toLowerCase().trim())) return true;

  // Check-in date > 18 months out is almost certainly a test
  if (checkIn) {
    const checkInDate = new Date(checkIn);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + 18);
    if (!isNaN(checkInDate.getTime()) && checkInDate > cutoff) return true;
  }

  return false;
}

function getRequestedExtrasAmountCents(upsells: string[]) {
  // No pet component. `pet-fee` is filtered by the caller and is never
  // chargeable — see src/lib/upsells.ts.
  return Math.round(getUpsellTotal(upsells) * 100);
}

async function getAuthoritativeQuoteContext(quoteId: string) {
  let quote = await getQuote(quoteId);

  // If the quote has expired, create a fresh one with the same parameters
  const expiresAt = quote?.expiresAt
    ? new Date(quote.expiresAt as string).getTime()
    : 0;
  if (expiresAt > 0 && expiresAt < Date.now()) {
    console.warn(
      `[Checkout] Quote ${quoteId} expired at ${quote.expiresAt}, creating fresh quote`
    );
    quote = await createQuote({
      listingId: quote.unitTypeId as string,
      checkIn: quote.checkInDateLocalized as string,
      checkOut: quote.checkOutDateLocalized as string,
      guestsCount: Number(quote.guestsCount || 1),
    });
  }

  const rp = quote?.rates?.ratePlans?.[0];
  if (!rp?.ratePlan?._id) {
    throw new Error("No valid rate plan found for quote");
  }
  const listingId = quote.unitTypeId as string;
  const listing = await getListingWithBeapiFallback(listingId);
  const money = rp.ratePlan.money || {};

  return {
    quote,
    quoteId: (quote._id as string) || quoteId,
    ratePlanId: rp.ratePlan._id as string,
    trackingDefaults: {
      listingId,
      listingTitle: listing?.nickname || listing?.title || "",
      listingNickname: listing?.nickname || null,
      picture: listing?.picture || listing?.pictures?.[0] || null,
      propertyType: listing?.property_type || null,
      city: listing?.address?.city || null,
      checkIn: quote.checkInDateLocalized as string,
      checkOut: quote.checkOutDateLocalized as string,
      guests: Number(quote.guestsCount || 0),
      stayTotal:
        typeof money.hostPayout === "number" ? money.hostPayout : undefined,
    },
  };
}

export async function finalizeReservation(
  input: ReservationFinalizeInput
): Promise<ReservationFinalizeResult> {
  const { paymentIntentId, quoteId, guest } = input;
  if (!paymentIntentId || !quoteId || !guest?.email) {
    throw new Error("paymentIntentId, quoteId, and guest are required");
  }

  // Serialize concurrent finalizers for the same PaymentIntent. The Stripe
  // webhook and the frontend POST /api/reservations both fire after a
  // successful charge; without this lock they race past the pre-flight dedup
  // below and both call BEAPI /instant, producing a spurious
  // "no availability" 400 from the losing caller.
  return withAdvisoryLock(`finalize:${paymentIntentId}`, () =>
    finalizeReservationLocked(input)
  );
}

async function finalizeReservationLocked(
  input: ReservationFinalizeInput
): Promise<ReservationFinalizeResult> {
  const { paymentIntentId, quoteId, guest } = input;
  const stripe = getStripeServer();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  });
  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
  }
  if (paymentIntent.metadata.quoteId !== quoteId) {
    throw new Error("Payment intent does not match the provided quote");
  }

  const pool = getPool();
  const existingRes = await pool.query(
    `SELECT guesty_id, confirmation_code, status FROM reservations WHERE stripe_payment_intent_id = $1`,
    [paymentIntentId]
  );
  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    await markPendingCheckoutCompleted(
      paymentIntentId,
      String(existing.guesty_id)
    ).catch(() => {});
    const duplicateUpsells = Array.isArray(input.upsells) ? input.upsells : [];
    const duplicatePets =
      typeof input.pets === "number" && input.pets > 0 ? input.pets : 0;
    return {
      reservationId: String(existing.guesty_id),
      confirmationCode: existing.confirmation_code
        ? String(existing.confirmation_code)
        : undefined,
      status: String(existing.status || "confirmed"),
      duplicate: true,
      eventId: input.tracking?.eventId || `purchase_${existing.guesty_id}`,
      chargedAmount: paymentIntent.amount / 100,
      appliedUpsells: duplicateUpsells,
      appliedPets: duplicatePets,
      tracking: input.tracking,
    };
  }

  const quoteContext = await getAuthoritativeQuoteContext(quoteId);
  const tracking = {
    ...quoteContext.trackingDefaults,
    ...input.tracking,
    listingId:
      input.tracking?.listingId || quoteContext.trackingDefaults.listingId,
    listingTitle:
      input.tracking?.listingTitle ||
      quoteContext.trackingDefaults.listingTitle,
    listingNickname:
      input.tracking?.listingNickname ??
      quoteContext.trackingDefaults.listingNickname,
    picture: input.tracking?.picture ?? quoteContext.trackingDefaults.picture,
    propertyType:
      input.tracking?.propertyType ??
      quoteContext.trackingDefaults.propertyType,
    city: input.tracking?.city ?? quoteContext.trackingDefaults.city,
    checkIn: input.tracking?.checkIn || quoteContext.trackingDefaults.checkIn,
    checkOut:
      input.tracking?.checkOut || quoteContext.trackingDefaults.checkOut,
    guests: input.tracking?.guests || quoteContext.trackingDefaults.guests,
    stayTotal: quoteContext.trackingDefaults.stayTotal,
    totalPaid: paymentIntent.amount / 100,
    eventId: input.tracking?.eventId || `purchase_${paymentIntentId}`,
  };

  const ccToken =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || "";

  let reservation: Record<string, unknown>;
  try {
    let lastGuestyError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        reservation = await createReservationInstant({
          quoteId: quoteContext.quoteId,
          ratePlanId: quoteContext.ratePlanId,
          ccToken,
          guest: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            // Guesty silently drops non-E.164 phone numbers — bare 10 digits
            // ("5082371715") result in an empty guest.phone field on the
            // reservation. Convert to "+15082371715" so SMS, profile lookup,
            // and ops contact info actually work. See src/lib/phone.ts.
            phone: toE164US(guest.phone),
          },
          policy: {
            privacy: {
              version: 1,
              dateOfAcceptance: new Date().toISOString(),
              isAccepted: true,
            },
            termsAndConditions: {
              dateOfAcceptance: new Date().toISOString(),
              isAccepted: true,
            },
          },
        });
        break;
      } catch (error) {
        lastGuestyError = error;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
        }
      }
    }
    if (!reservation!) {
      throw lastGuestyError instanceof Error
        ? lastGuestyError
        : new Error("Guesty reservation creation failed");
    }
  } catch (guestyError) {
    const message =
      "Your payment was received, but your reservation is still being finalized. Please do not retry. Our team has been notified.";
    const stripePaymentUrl = buildStripeDashboardPaymentUrl(paymentIntentId);
    // Hand the payment to the recovery net BEFORE deciding whether to shout.
    // If this write lands, /api/cron/recover-checkouts owns the booking: it
    // retries every 10 minutes and raises "Checkout Recovery Still Failing"
    // once the row is 15 minutes old and still stuck.
    let handedToRecovery = true;
    try {
      await markPendingCheckoutError(
        paymentIntentId,
        `${message} Guesty error: ${guestyError instanceof Error ? guestyError.message : "Unknown"}`,
        "paid_pending_reservation"
      );
    } catch {
      handedToRecovery = false;
    }

    // Only alert from here when the recovery net is GONE.
    //
    // This alert used to fire immediately on every failed finalize, and it was
    // a false alarm 52 times out of 54 over the 30 days to 2026-10-09: the
    // client-side finalize or the recovery cron created the reservation
    // seconds later. Tiffany Sekunnq's booking on 2026-10-09 alerted at
    // 03:10:20 and completed at 03:10:30 — ten seconds.
    //
    // That noise had a cost. Nathan Smith's genuinely stranded $217.63 on
    // 2026-09-19 produced the same subject line as the 52 that healed
    // themselves, and went unrefunded for weeks.
    //
    // So: if the row was marked, stay quiet and let the age-gated cron alert
    // speak — it has the pending age and the real history. If the mark FAILED,
    // nothing else will ever look at this payment, and it must be shouted
    // about right now.
    if (!handedToRecovery) {
      await sendAlert(
        "PAID BOOKING NEEDS MANUAL RECOVERY",
        [
          "<p><strong>A Stripe payment succeeded, Guesty reservation creation failed, and the pending-checkout row could not be written.</strong></p>",
          "<p>The recovery cron will NOT pick this up, because there is no row for it to find. This one needs a human.</p>",
          renderAlertDetails([
            ["PaymentIntent", paymentIntentId],
            ["Quote ID", quoteContext.quoteId],
            ["Guest email", guest.email],
            [
              "Guest name",
              [guest.firstName, guest.lastName].filter(Boolean).join(" "),
            ],
            ["Listing", tracking.listingTitle],
            ["Check-in", tracking.checkIn],
            ["Check-out", tracking.checkOut],
            ["Guests", tracking.guests],
            ["Charged amount", `$${(paymentIntent.amount / 100).toFixed(2)}`],
            [
              "Guesty error",
              guestyError instanceof Error ? guestyError.message : "Unknown",
            ],
            [
              "Next action",
              "Create the reservation in Guesty manually and record the Stripe payment against it. Do NOT ask the guest to repay — they have already been charged.",
            ],
          ]),
          renderAlertLinks([
            { label: "Stripe payment", url: stripePaymentUrl },
          ]),
        ].join(""),
        `paid-booking-manual-recovery-${paymentIntentId}`
      );
    } else {
      console.warn(
        `[finalizeReservation] Guesty creation failed for ${paymentIntentId}; handed to recover-checkouts. ` +
          `No alert yet — recover-checkouts raises one if it is still stuck after 15 minutes.`
      );
    }
    throw new ReservationPendingRecoveryError(
      message,
      guestyError instanceof Error ? guestyError.message : String(guestyError)
    );
  }

  const reservationId = String(
    reservation._id || reservation.id || reservation.reservationId || ""
  );
  if (!reservationId) {
    throw new Error("Reservation created without an ID");
  }
  const confirmationCode =
    reservation.confirmationCode || reservation.confirmation_code;

  if (paymentIntent.customer) {
    const customerId =
      typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : paymentIntent.customer.id;
    stripe.customers
      .update(customerId, {
        email: guest.email || undefined,
        name: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
        phone: toE164US(guest.phone) || undefined,
        metadata: {
          confirmationCode: String(confirmationCode || ""),
          guestyReservationId: reservationId,
          checkIn: tracking.checkIn || "",
          checkOut: tracking.checkOut || "",
        },
      })
      .catch((err) =>
        console.warn(
          "[Stripe] Failed to update customer:",
          err instanceof Error ? err.message : err
        )
      );
  }

  // AWAITED on purpose. This write is what makes the PI stop looking like an
  // orphan charge to findSucceededPaymentIntentForStay() in
  // /api/payment-intent — that guard skips any PI carrying a confirmationCode.
  // Fire-and-forget here risks the lambda freezing before the request lands
  // (the same failure mode that dropped server-side GA4 purchases), leaving a
  // confirmed booking whose PI reads as orphaned forever. The consequence is
  // fail-safe but wrong: after this stay is later cancelled and the dates free
  // up, the stale orphan would wrongly block a legitimate re-booking. Still
  // non-fatal on error — the reservation already exists either way.
  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        confirmationCode: String(confirmationCode || ""),
        guestyReservationId: reservationId,
      },
    });
  } catch (err) {
    console.warn(
      "[Stripe] Failed to update PI metadata:",
      err instanceof Error ? err.message : err
    );
  }

  // `pet-fee` can never be a chargeable upsell. 2026-10-17: the website
  // charges nothing for pets; guests pay any fee through the guest portal.
  const upsells = (Array.isArray(input.upsells) ? input.upsells : []).filter(
    (id) => id !== "pet-fee"
  );
  // Deliberately NOT derived from input.pets or from PI metadata. An in-flight
  // checkout created before this change can still carry a pet count, and
  // honouring it would put a Pet Fee on a Guesty invoice for money Stripe
  // never collected.
  const petCount = 0;
  if (typeof input.pets === "number" && input.pets > 0) {
    console.warn(
      `[checkout-finalizer] ignoring pets=${input.pets} on PI ${paymentIntentId} — ` +
        `no pet fee is charged or invoiced; pets are handled in the guest portal.`
    );
  }
  const hasExtras = upsells.length > 0;
  let upsellStatus: { charged?: number; errors?: string[] } | undefined;
  let appliedUpsells = upsells;
  const appliedPets = 0;
  if (hasExtras) {
    const baseAmountCents = Number.parseInt(
      paymentIntent.metadata.baseAmountCents || "0",
      10
    );
    const requestedExtrasAmountCents = getRequestedExtrasAmountCents(upsells);
    const expectedChargedAmountCents =
      baseAmountCents > 0 ? baseAmountCents + requestedExtrasAmountCents : null;

    if (
      !expectedChargedAmountCents ||
      paymentIntent.amount !== expectedChargedAmountCents
    ) {
      const expectedAmountText = expectedChargedAmountCents
        ? `$${(expectedChargedAmountCents / 100).toFixed(2)}`
        : "unknown";
      const mismatchMessage = `Skipping extras because Stripe charged $${(paymentIntent.amount / 100).toFixed(2)} but the requested booking total was ${expectedAmountText}.`;
      upsellStatus = { charged: 0, errors: [mismatchMessage] };
      appliedUpsells = [];
      // appliedPets is already 0 and immutable — pets are never charged.

      await sendAlert(
        "UNPAID EXTRAS BLOCKED FROM GUESTY",
        [
          "<p>A booking reached reservation finalization with extras selected, but Stripe did not actually charge for them. Guesty extras were skipped to avoid creating an unpaid balance.</p>",
          renderAlertDetails([
            ["PaymentIntent", paymentIntentId],
            ["Guesty reservation", reservationId],
            ["Quote ID", quoteContext.quoteId],
            ["Guest email", guest.email],
            ["Listing", tracking.listingTitle],
            ["Charged amount", `$${(paymentIntent.amount / 100).toFixed(2)}`],
            ["Expected charged amount", expectedAmountText],
            ["Requested upsells", upsells.join(", ") || "(none)"],
            ["Requested pets", String(petCount)],
          ]),
          renderAlertLinks([
            {
              label: "Stripe payment",
              url: buildStripeDashboardPaymentUrl(paymentIntentId),
            },
          ]),
        ].join(""),
        `unpaid-extras-blocked-${paymentIntentId}`
      );
    } else {
      await new Promise((r) => setTimeout(r, 2000));
      const errors: string[] = [];
      let charged = 0;

      if (upsells.length > 0) {
        const selectedItems = getSelectedUpsells(upsells);
        for (const item of selectedItems) {
          try {
            await addInvoiceItem(reservationId, {
              title: item.title,
              amount: item.amount,
              normalType: item.normalType,
              secondIdentifier: item.secondIdentifier,
              accountFeeId: item.accountFeeId,
            });
            charged++;
          } catch (err) {
            errors.push(
              `Failed to add invoice item "${item.title}": ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }

      // 🐾 The Pet Fee AFE block that stood here was removed 2026-10-17.
      // Nothing in this finalizer may add a pet charge to a Guesty invoice.
      // Guests disclose pets and pay any fee through the guest portal.

      upsellStatus = {
        charged,
        errors: errors.length > 0 ? errors : undefined,
      };
    }
  }

  const chargedAmount = paymentIntent.amount / 100;

  let userId: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    userId = authUser?.id || null;
  } catch {
    // not logged in
  }

  const checkIn = String(
    reservation.checkInDateLocalized ||
      reservation.checkInDate ||
      tracking.checkIn ||
      ""
  );
  const checkOut = String(
    reservation.checkOutDateLocalized ||
      reservation.checkOutDate ||
      tracking.checkOut ||
      ""
  );
  const nowEpoch = Date.now();
  let reservationStoredLocally = false;
  const schemaHasPaymentColumns = await paymentTargetColumnsExist(pool);
  const chargedAmountCents = dollarsToCents(chargedAmount);

  try {
    if (schemaHasPaymentColumns) {
      await pool.query(
        `INSERT INTO reservations (
           guesty_id, confirmation_code, listing_id, guest_id, status, source,
           check_in, check_out, guests_count, guest, money, last_synced_at,
           stripe_payment_intent_id, user_id, payment_recorded_at,
           listing_title, listing_photo,
           payment_target_cents, payment_recorded_cents, payment_target_cents_set_at
         )
         VALUES ($1, $2, $3, $4, $5, 'BE-API', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 0, $18)
         ON CONFLICT (guesty_id) DO UPDATE SET
           status = EXCLUDED.status,
           confirmation_code = EXCLUDED.confirmation_code,
           guest = EXCLUDED.guest,
           money = COALESCE(reservations.money, EXCLUDED.money),
           stripe_payment_intent_id = COALESCE(reservations.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
           user_id = COALESCE(reservations.user_id, EXCLUDED.user_id),
           payment_recorded_at = COALESCE(reservations.payment_recorded_at, EXCLUDED.payment_recorded_at),
           listing_title = COALESCE(reservations.listing_title, EXCLUDED.listing_title),
           listing_photo = COALESCE(reservations.listing_photo, EXCLUDED.listing_photo),
           payment_target_cents = COALESCE(reservations.payment_target_cents, EXCLUDED.payment_target_cents),
           payment_target_cents_set_at = COALESCE(reservations.payment_target_cents_set_at, EXCLUDED.payment_target_cents_set_at),
           last_synced_at = $11`,
        [
          reservationId,
          confirmationCode || null,
          tracking.listingId || (reservation.listingId as string) || null,
          ((reservation.guestId || reservation.bookerId) as string) || null,
          (reservation.status as string) || "confirmed",
          checkIn || null,
          checkOut || null,
          tracking.guests || null,
          JSON.stringify({
            email: guest.email || null,
            firstName: guest.firstName || null,
            lastName: guest.lastName || null,
            fullName:
              [guest.firstName, guest.lastName].filter(Boolean).join(" ") ||
              null,
            phone: guest.phone || null,
          }),
          JSON.stringify({ total_paid: chargedAmount, currency: "USD" }),
          nowEpoch,
          paymentIntentId,
          userId,
          null,
          tracking.listingTitle || null,
          tracking.picture || null,
          chargedAmountCents,
          nowEpoch,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO reservations (guesty_id, confirmation_code, listing_id, guest_id, status, source, check_in, check_out, guests_count, guest, money, last_synced_at, stripe_payment_intent_id, user_id, payment_recorded_at, listing_title, listing_photo)
         VALUES ($1, $2, $3, $4, $5, 'BE-API', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (guesty_id) DO UPDATE SET
           status = EXCLUDED.status,
           confirmation_code = EXCLUDED.confirmation_code,
           guest = EXCLUDED.guest,
           money = COALESCE(reservations.money, EXCLUDED.money),
           stripe_payment_intent_id = COALESCE(reservations.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
           user_id = COALESCE(reservations.user_id, EXCLUDED.user_id),
           payment_recorded_at = COALESCE(reservations.payment_recorded_at, EXCLUDED.payment_recorded_at),
           listing_title = COALESCE(reservations.listing_title, EXCLUDED.listing_title),
           listing_photo = COALESCE(reservations.listing_photo, EXCLUDED.listing_photo),
           last_synced_at = $11`,
        [
          reservationId,
          confirmationCode || null,
          tracking.listingId || (reservation.listingId as string) || null,
          ((reservation.guestId || reservation.bookerId) as string) || null,
          (reservation.status as string) || "confirmed",
          checkIn || null,
          checkOut || null,
          tracking.guests || null,
          JSON.stringify({
            email: guest.email || null,
            firstName: guest.firstName || null,
            lastName: guest.lastName || null,
            fullName:
              [guest.firstName, guest.lastName].filter(Boolean).join(" ") ||
              null,
            phone: guest.phone || null,
          }),
          JSON.stringify({ total_paid: chargedAmount, currency: "USD" }),
          nowEpoch,
          paymentIntentId,
          userId,
          null,
          tracking.listingTitle || null,
          tracking.picture || null,
        ]
      );
    }
    reservationStoredLocally = true;
  } catch (dbErr) {
    const stripePaymentUrl = buildStripeDashboardPaymentUrl(paymentIntentId);
    await sendAlert(
      "Reservation DB Write Failed",
      [
        "<p>The Guesty reservation was created, but the local reservations table write failed. The guest may not see this booking in their account.</p>",
        renderAlertDetails([
          ["Guesty reservation", reservationId],
          ["Confirmation code", confirmationCode || ""],
          ["PaymentIntent", paymentIntentId],
          ["Guest email", guest.email],
          [
            "Guest name",
            [guest.firstName, guest.lastName].filter(Boolean).join(" "),
          ],
          ["Listing", tracking.listingTitle],
          ["Check-in", checkIn],
          ["Check-out", checkOut],
          ["Charged amount", `$${chargedAmount.toFixed(2)}`],
          ["DB error", dbErr instanceof Error ? dbErr.message : String(dbErr)],
        ]),
        renderAlertLinks([{ label: "Stripe payment", url: stripePaymentUrl }]),
      ].join(""),
      `db-write-fail-${reservationId}`
    );
    console.error("[Portal] Failed to write reservation locally:", dbErr);
  }

  try {
    const result = await recordPaymentWithIndexingRetry(
      reservationId,
      chargedAmount,
      paymentIntentId
    );

    if (result.outcome === "full" && reservationStoredLocally) {
      // Legacy path only — the new protocol stamps payment_recorded_at
      // atomically inside the reserve UPDATE when the running total hits
      // target. This COALESCE is a defensive no-op when the new path ran.
      await pool.query(
        `UPDATE reservations
         SET payment_recorded_at = COALESCE(payment_recorded_at, $1)
         WHERE guesty_id = $2`,
        [Date.now(), reservationId]
      );
    } else if (result.outcome === "short") {
      // Partial record. Guesty took what it could; the cron will top up as
      // the item lands. Alert once per reservation (24h dedup via sendAlert).
      const stripeUrl = buildStripeDashboardPaymentUrl(paymentIntentId);
      const recorded = result.recordedCents / 100;
      const shortfall = result.shortfallCents / 100;
      await sendAlert(
        `Guesty ledger short — partial payment recorded ($${recorded.toFixed(2)} of $${chargedAmount.toFixed(2)}, $${shortfall.toFixed(2)} pending)`,
        [
          "<p>Guesty rejected the full Stripe-captured amount because its outstanding balance was lower (likely an invoice item that hasn't landed yet).</p>",
          "<p>We recorded what Guesty will accept now. The record-payments cron will top up the remaining amount once Guesty's balance rises, never exceeding what Stripe captured.</p>",
          renderAlertDetails([
            ["Reservation", reservationId],
            ["PaymentIntent", paymentIntentId],
            ["Stripe captured", `$${chargedAmount.toFixed(2)}`],
            ["Recorded now", `$${recorded.toFixed(2)}`],
            ["Pending top-up", `$${shortfall.toFixed(2)}`],
          ]),
          renderAlertLinks([{ label: "Stripe payment", url: stripeUrl }]),
        ].join(""),
        `amount-short-${reservationId}`
      );
    }
  } catch (err) {
    // All retries exhausted. The record-payments cron remains as a
    // defense-in-depth fallback for prod (rare case where Guesty was
    // genuinely down longer than our retry budget).
    console.warn(
      "[Reservation] recordPayment failed after all retries, falling back to cron:",
      err instanceof Error ? err.message : err
    );
  }

  let attribution: Record<string, string> | undefined;
  if (input.cookies?.attribution) {
    try {
      attribution = JSON.parse(input.cookies.attribution);
    } catch {
      // ignore
    }
  }

  let firstTouch: Record<string, string> | undefined;
  if (input.cookies?.firstTouch) {
    try {
      firstTouch = JSON.parse(input.cookies.firstTouch);
    } catch {
      // ignore
    }
  }

  // Cross-device fallback: look up first-touch from DB if cookie is missing
  if (!firstTouch && guest.email) {
    const dbFirstTouch = await lookupFirstTouchAttribution(guest.email).catch(
      () => null
    );
    if (dbFirstTouch) {
      firstTouch = dbFirstTouch as Record<string, string>;
    }
  }

  // Persist attribution at checkout too (covers users who never filled a form)
  if (guest.email && (attribution || firstTouch)) {
    persistVisitorAttribution(guest.email, {
      attribution: attribution ? JSON.stringify(attribution) : undefined,
      firstTouch: firstTouch ? JSON.stringify(firstTouch) : undefined,
    }).catch(() => {});
  }

  const gaClientId =
    input.cookies?.ga?.split(".").slice(-2).join(".") || undefined;
  const gaSessionId = parseGA4SessionId(input.cookies?.gaSession);
  const consent = getEffectiveServerConsent({
    consentCookieValue: input.cookies?.consent,
    legacyOptOutValue: input.cookies?.legacyCcpaOptOut,
    fallback: tracking.consent,
  });

  // Extract billing address from Stripe — used for both Meta CAPI server-side
  // matching AND returned to the browser so trackBookingCompleted can attach
  // postal_code + country to gtag user_data (Google EC requires the full
  // {firstName, lastName, postalCode, country} tuple before name is sent).
  const billingAddress =
    typeof paymentIntent.payment_method === "object"
      ? paymentIntent.payment_method?.billing_details?.address
      : undefined;

  if (tracking && !isLikelyTestBooking(guest.email, tracking.checkIn)) {
    // MUST await — without it, the Stripe webhook returns 200 and Vercel
    // freezes the lambda before the GA4 / Meta CAPI / Google Ads fetches
    // land. That silently drops every BE-API purchase from GA4 (see
    // missing GY-zBMnaYA8 / GY-dmwm6uVF on 2026-05-23). The cart path
    // already awaits in checkout-coordinator.ts. Webhook latency cost is
    // ~100-300ms for the parallel uploads, acceptable for Stripe.
    await trackBookingServerSide(
      {
        reservationId,
        confirmationCode: confirmationCode ? String(confirmationCode) : null,
        listingId: tracking.listingId,
        listingTitle: tracking.listingTitle,
        listingNickname: tracking.listingNickname,
        checkIn: tracking.checkIn,
        checkOut: tracking.checkOut,
        guests: tracking.guests,
        total: chargedAmount,
        eventId: tracking.eventId || `purchase_${reservationId}`,
        guest: {
          email: guest.email,
          phone: guest.phone,
          firstName: guest.firstName,
          lastName: guest.lastName,
          city: billingAddress?.city || undefined,
          state: billingAddress?.state || undefined,
          zip: billingAddress?.postal_code || undefined,
          country: billingAddress?.country || undefined,
        },
        attribution,
        gaClientId,
        context: {
          clientIp: input.requestContext?.clientIp,
          clientUserAgent: input.requestContext?.clientUserAgent,
          fbp: input.cookies?.fbp,
          fbc: input.cookies?.fbc,
          gaSessionId,
        },
      },
      { consent: consent || undefined }
    ).catch((err) => console.error("[Server Tracking] Error:", err));
  } else if (tracking) {
    console.log(
      `[Server Tracking] Skipped test booking: ${guest.email}, check-in: ${tracking.checkIn}`
    );
  }

  await markPendingCheckoutCompleted(paymentIntentId, reservationId).catch(
    () => {}
  );

  // Send booking confirmation email to owner — skip for test bookings
  if (isLikelyTestBooking(guest.email, tracking.checkIn)) {
    console.log(`[BookingConfirmation] Skipped test booking: ${guest.email}`);
  } else {
    await sendBookingConfirmation({
      reservationId,
      confirmationCode: confirmationCode ? String(confirmationCode) : undefined,
      guestName: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
      guestEmail: guest.email,
      guestPhone: guest.phone || undefined,
      listingId: tracking.listingId || "",
      listingTitle: tracking.listingTitle || "",
      checkIn: tracking.checkIn || "",
      checkOut: tracking.checkOut || "",
      guests: tracking.guests || 0,
      chargedAmount,
      upsells: appliedUpsells,
      pets: appliedPets,
      stripePaymentIntentId: paymentIntentId,
      attribution: attribution || null,
      firstTouchAttribution: firstTouch || null,
    }).catch((err) => console.error("[BookingConfirmation] Error:", err));

    // Prompt guests without an account to create one (non-blocking).
    // The check for existing accounts happens inside sendAccountCreationEmail.
    sendAccountCreationEmail({
      guestEmail: guest.email,
      guestName: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
      listingTitle: tracking.listingTitle || "",
      listingPhoto: tracking.picture || null,
      checkIn: tracking.checkIn || "",
      checkOut: tracking.checkOut || "",
      confirmationCode: confirmationCode ? String(confirmationCode) : null,
    }).catch((err) => console.error("[AccountCreationEmail] Error:", err));
  }

  return {
    reservationId,
    confirmationCode: confirmationCode ? String(confirmationCode) : undefined,
    status: String(reservation.status || "confirmed"),
    guestId: (reservation.guestId || reservation.bookerId) as
      | string
      | undefined,
    eventId: tracking.eventId || `purchase_${reservationId}`,
    chargedAmount,
    upsellStatus,
    appliedUpsells,
    appliedPets,
    tracking,
    billingPostalCode: billingAddress?.postal_code || undefined,
    billingCountry: billingAddress?.country || undefined,
  };
}
