import { getStripeServer } from "@/lib/stripe";
import {
  recordPayment,
  addInvoiceItem,
  isAlreadySettledPaymentError,
} from "@/lib/guesty-openapi";
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
import { getListing } from "@/lib/supabase";
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
  constructor(message: string) {
    super(message);
    this.name = "ReservationPendingRecoveryError";
  }
}

// Guesty needs ~3-9s to index a freshly created reservation before it accepts
// payment recording. Retry the recordPayment call with progressive backoff so
// the webhook records the payment in-line instead of leaving it to a cron.
// Total budget ≈ 15s (1+2+3+4+5), well inside the 60s webhook maxDuration and
// Stripe's 30s webhook delivery window.
const PAYMENT_RECORD_BACKOFFS_MS = [1000, 2000, 3000, 4000, 5000];

export async function recordPaymentWithIndexingRetry(
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
        return;
      }
      lastError = err;
      const delay = PAYMENT_RECORD_BACKOFFS_MS[attempt];
      if (delay === undefined) break;
      console.warn(
        `[Reservation] recordPayment attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err
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

function getRequestedExtrasAmountCents(upsells: string[], petCount: number) {
  const upsellAmount = getUpsellTotal(upsells.filter((id) => id !== "pet-fee"));
  const petFeeAmount = petCount > 0 ? petCount * 99 : 0;
  return Math.round((upsellAmount + petFeeAmount) * 100);
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
  const listing = await getListing(listingId).catch(() => null);
  const money = rp.ratePlan.money || {};

  return {
    quote,
    quoteId: (quote._id as string) || quoteId,
    ratePlanId: rp.ratePlan._id as string,
    trackingDefaults: {
      listingId,
      listingTitle: listing?.nickname || listing?.title || "",
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
            phone: guest.phone || "",
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
    await markPendingCheckoutError(
      paymentIntentId,
      `${message} Guesty error: ${guestyError instanceof Error ? guestyError.message : "Unknown"}`,
      "paid_pending_reservation"
    ).catch(() => {});
    await sendAlert(
      "PAID BOOKING NEEDS MANUAL RECOVERY",
      [
        "<p>A Stripe payment succeeded, but Guesty reservation creation still failed after the in-request retries.</p>",
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
            "Recovery cron will keep retrying. Do not ask the guest to repay.",
          ],
        ]),
        renderAlertLinks([{ label: "Stripe payment", url: stripePaymentUrl }]),
      ].join(""),
      `paid-booking-manual-recovery-${paymentIntentId}`
    );
    throw new ReservationPendingRecoveryError(message);
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
        phone: guest.phone || undefined,
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

  stripe.paymentIntents
    .update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        confirmationCode: String(confirmationCode || ""),
        guestyReservationId: reservationId,
      },
    })
    .catch((err) =>
      console.warn(
        "[Stripe] Failed to update PI metadata:",
        err instanceof Error ? err.message : err
      )
    );

  const upsells = Array.isArray(input.upsells) ? input.upsells : [];
  const petCount =
    typeof input.pets === "number" && input.pets > 0 ? input.pets : 0;
  const hasExtras = upsells.length > 0 || petCount > 0;
  let upsellStatus: { charged?: number; errors?: string[] } | undefined;
  let appliedUpsells = upsells;
  let appliedPets = petCount;
  if (hasExtras) {
    const baseAmountCents = Number.parseInt(
      paymentIntent.metadata.baseAmountCents || "0",
      10
    );
    const requestedExtrasAmountCents = getRequestedExtrasAmountCents(
      upsells,
      petCount
    );
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
      appliedPets = 0;

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
        const selectedItems = getSelectedUpsells(upsells).filter(
          (u) => u.id !== "pet-fee"
        );
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

      if (petCount > 0) {
        const petFeeAmount = petCount * 99;
        const petTitle =
          petCount > 1 ? `Pet Fee (${petCount} pets)` : "Pet Fee";
        try {
          await addInvoiceItem(reservationId, {
            title: petTitle,
            amount: petFeeAmount,
            normalType: "AFE",
            secondIdentifier: "PET",
            accountFeeId: "67fc4907f2cc23000e67992c",
          });
          charged++;
        } catch (err) {
          errors.push(
            `Failed to add pet fee: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

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

  try {
    await pool.query(
      `INSERT INTO reservations (guesty_id, confirmation_code, listing_id, guest_id, status, source, check_in, check_out, guests_count, guest, money, last_synced_at, stripe_payment_intent_id, user_id, payment_recorded_at)
       VALUES ($1, $2, $3, $4, $5, 'BE-API', $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (guesty_id) DO UPDATE SET
         status = EXCLUDED.status,
         confirmation_code = EXCLUDED.confirmation_code,
         guest = EXCLUDED.guest,
         money = COALESCE(reservations.money, EXCLUDED.money),
         stripe_payment_intent_id = COALESCE(reservations.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
         user_id = COALESCE(reservations.user_id, EXCLUDED.user_id),
         payment_recorded_at = COALESCE(reservations.payment_recorded_at, EXCLUDED.payment_recorded_at),
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
            [guest.firstName, guest.lastName].filter(Boolean).join(" ") || null,
          phone: guest.phone || null,
        }),
        JSON.stringify({ total_paid: chargedAmount, currency: "USD" }),
        nowEpoch,
        paymentIntentId,
        userId,
        null,
      ]
    );
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
    await recordPaymentWithIndexingRetry(
      reservationId,
      chargedAmount,
      paymentIntentId
    );

    if (reservationStoredLocally) {
      await pool.query(
        `UPDATE reservations
         SET payment_recorded_at = COALESCE(payment_recorded_at, $1)
         WHERE guesty_id = $2`,
        [Date.now(), reservationId]
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
    trackBookingServerSide(
      {
        reservationId,
        listingId: tracking.listingId,
        listingTitle: tracking.listingTitle,
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
