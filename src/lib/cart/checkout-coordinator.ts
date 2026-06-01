// Multi-listing cart checkout coordinator. Walks each cart line through
// reservation creation sequentially with clean rollback boundaries: on
// any per-line failure, the coordinator stops processing remaining lines
// and refunds the proportional unfulfilled amount via Stripe. Already-
// reserved lines stay confirmed (better UX than refunding the whole cart;
// guests usually want to keep what worked).
//
// Why not parallel? Two reasons:
//  1. Sequential = clean rollback. If line 3 fails, we know lines 1+2
//     succeeded and how much remains unbilled.
//  2. Cart cap is 5 listings; sequential budget ≈ 5×3s reservation +
//     5×8s payment-record retries ≈ 55s, just under Vercel's 60s limit.
//     Parallel would race against Guesty BEAPI rate limits.
//
// The single-listing finalizer (src/lib/checkout-finalizer.ts) is intentionally
// untouched — its dedup-against-reservations-table, upsell handling, and
// account-creation flow are quote-coupled and not worth refactoring under
// pressure. Cart MVP intentionally does not support upsells / pet fees /
// account creation; those can be added as Phase 2.1.

import { getStripeServer } from "@/lib/stripe";
import {
  createReservationInstant,
  getQuote,
  createQuote,
} from "@/lib/guesty-beapi";
import {
  recordPaymentWithIndexingRetry,
} from "@/lib/checkout-finalizer";
import {
  buildStripeDashboardPaymentUrl,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";
import { getPool, withAdvisoryLock } from "@/lib/db";
import {
  getPendingCartCheckoutByPaymentIntent,
  setCartStatus,
  updateCartLine,
  type CartLine,
  type PendingCartCheckoutRecord,
} from "@/lib/cart/pending-cart-checkouts";
import {
  sendCartConfirmationEmail,
  type CartConfirmationLine,
} from "@/lib/emails/cart-confirmation-email";
import {
  trackBookingServerSide,
  parseGA4SessionId,
} from "@/lib/server-tracking";

export interface CartReservationLineResult {
  lineId: string;
  listingId: string;
  status: "reserved" | "failed" | "refunded";
  reservationId?: string;
  confirmationCode?: string;
  hostPayout: number;
  refundAmount?: number;
  error?: string;
}

export type CartCheckoutResult =
  | {
      status: "success";
      cartId: string;
      reservations: CartReservationLineResult[];
      totalCharged: number;
    }
  | {
      status: "partial";
      cartId: string;
      reservations: CartReservationLineResult[];
      totalCharged: number;
      totalRefunded: number;
    }
  | {
      status: "refunded";
      cartId: string;
      reservations: CartReservationLineResult[];
      totalRefunded: number;
    }
  | {
      status: "refund_failed";
      cartId: string;
      reservations: CartReservationLineResult[];
      message: string;
    };

/** Top-level entrypoint for /api/cart/reservations. Holds an advisory lock
 * on the PaymentIntent so a frontend retry + a Stripe webhook racing in
 * parallel can't double-process. */
export async function finalizeCartCheckout(
  paymentIntentId: string
): Promise<CartCheckoutResult> {
  return withAdvisoryLock(`cart:${paymentIntentId}`, () =>
    finalizeCartCheckoutLocked(paymentIntentId)
  );
}

async function finalizeCartCheckoutLocked(
  paymentIntentId: string
): Promise<CartCheckoutResult> {
  const stripe = getStripeServer();

  // 1. Verify Stripe PI succeeded. We don't trust the client to tell us this.
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    throw new Error(
      `Cart payment not completed. Status: ${paymentIntent.status}`
    );
  }

  // 2. Load the persisted cart row. If it's already terminal, return cached result.
  const record = await getPendingCartCheckoutByPaymentIntent(paymentIntentId);
  if (!record) {
    throw new Error(
      `No pending cart checkout found for payment_intent ${paymentIntentId}`
    );
  }
  if (
    record.status === "completed" ||
    record.status === "partial" ||
    record.status === "refunded" ||
    record.status === "refund_failed"
  ) {
    return buildResultFromRecord(record);
  }

  // 3. Mark mid-flight so concurrent /api/cart/reservations calls bail.
  await setCartStatus(paymentIntentId, "reserving");

  const totalCharged = paymentIntent.amount / 100;
  const lineResults: CartReservationLineResult[] = [];
  let firstFailure: { line: CartLine; error: string } | null = null;

  // 4. Process each line sequentially. On first failure, stop and refund.
  for (const line of record.lines) {
    if (firstFailure) {
      // Already failed earlier — mark this line as failed-without-attempt
      // (will be refunded with the others below).
      lineResults.push({
        lineId: line.lineId,
        listingId: line.listingId,
        status: "failed",
        hostPayout: line.hostPayout,
        error: "Cart rolled back due to earlier line failure",
      });
      await updateCartLine(paymentIntentId, line.lineId, {
        status: "failed",
        errorMessage: "Cart rolled back due to earlier line failure",
      });
      continue;
    }

    try {
      const lineResult = await reserveCartLine({
        line,
        paymentIntent,
        guest: record.guest,
      });
      lineResults.push(lineResult);
      await updateCartLine(paymentIntentId, line.lineId, {
        status: "reserved",
        reservationId: lineResult.reservationId ?? null,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[cart] Reservation failed for line ${line.lineId} (${line.listingTitle}):`,
        message
      );
      lineResults.push({
        lineId: line.lineId,
        listingId: line.listingId,
        status: "failed",
        hostPayout: line.hostPayout,
        error: message,
      });
      await updateCartLine(paymentIntentId, line.lineId, {
        status: "failed",
        errorMessage: message,
      });
      firstFailure = { line, error: message };
    }
  }

  const reservedCount = lineResults.filter((r) => r.status === "reserved")
    .length;
  const failedCount = lineResults.filter((r) => r.status === "failed").length;

  // 5. All lines succeeded.
  if (failedCount === 0) {
    await setCartStatus(paymentIntentId, "completed", { markCompleted: true });
    const successResult: CartCheckoutResult = {
      status: "success",
      cartId: record.cartId,
      reservations: lineResults,
      totalCharged,
    };
    sendCartConfirmation(record, successResult).catch((err) =>
      console.error("[cart] Confirmation email failed:", err)
    );
    fireCartConversionAnalytics(record, lineResults).catch((err) =>
      console.error("[cart] Server-side analytics failed:", err)
    );
    return successResult;
  }

  // 6. At least one line failed — refund the unfulfilled portion.
  const refundResult = await refundFailedLines({
    record,
    paymentIntent,
    lineResults,
    totalCharged,
    reservedCount,
  });
  if (
    refundResult.status === "partial" ||
    refundResult.status === "refunded"
  ) {
    sendCartConfirmation(record, refundResult).catch((err) =>
      console.error("[cart] Confirmation email failed:", err)
    );
    // Partial-success: fire analytics for the lines that DID succeed. We
    // don't fire for refunded lines — they aren't conversions, they got
    // their money back.
    if (refundResult.status === "partial") {
      fireCartConversionAnalytics(record, lineResults).catch((err) =>
        console.error("[cart] Server-side analytics failed:", err)
      );
    }
  }
  return refundResult;
}

/** Fire per-line server-side conversion events (Meta CAPI Purchase, Klaviyo
 * Booked Reservation, Google Ads enhanced conversion, GA4 MP purchase) for
 * each successfully-reserved cart line. Single-flow finalizer fires the
 * same event per booking; cart fires N events per checkout, one per line.
 *
 * Only reserved lines are tracked. The cart-confirmation page renders
 * client-side gtag `purchase` separately (different transaction_id space)
 * — this is the server-side mirror that survives ad blockers + IPP. */
async function fireCartConversionAnalytics(
  record: PendingCartCheckoutRecord,
  lineResults: CartReservationLineResult[]
): Promise<void> {
  if (!record.guest.email) return;
  const cookies = record.trackingContext?.cookies;
  const requestContext = record.trackingContext?.requestContext;
  let attribution: Record<string, string> | undefined;
  if (cookies?.attribution) {
    try {
      attribution = JSON.parse(cookies.attribution);
    } catch {
      // ignore
    }
  }
  const gaSessionId = parseGA4SessionId(cookies?.gaSession);
  const gaClientId =
    cookies?.ga?.split(".").slice(-2).join(".") || undefined;

  const reserved = lineResults.filter((r) => r.status === "reserved");
  for (const lineResult of reserved) {
    const cartLine = record.lines.find((l) => l.lineId === lineResult.lineId);
    if (!cartLine || !lineResult.reservationId) continue;
    try {
      await trackBookingServerSide({
        reservationId: lineResult.reservationId,
        listingId: cartLine.listingId,
        listingTitle: cartLine.listingTitle,
        checkIn: cartLine.checkIn,
        checkOut: cartLine.checkOut,
        guests: cartLine.guests,
        total: cartLine.hostPayout,
        currency: "USD",
        // Per-line eventId — keeps Meta dedup keyed to the unique reservation
        // (not the cart) so each line counts as one Purchase, matching the
        // GA4/Meta canonical "one purchase = one transaction_id" model.
        eventId: `purchase_cart_${lineResult.reservationId}`,
        guest: {
          email: record.guest.email,
          phone: record.guest.phone || undefined,
          firstName: record.guest.firstName || undefined,
          lastName: record.guest.lastName || undefined,
        },
        attribution,
        gaClientId,
        context: {
          fbp: cookies?.fbp,
          fbc: cookies?.fbc,
          gaSessionId,
          clientIp: requestContext?.clientIp,
          clientUserAgent: requestContext?.clientUserAgent,
        },
      });
    } catch (err) {
      console.error(
        `[cart] trackBookingServerSide failed for ${lineResult.reservationId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

async function sendCartConfirmation(
  record: PendingCartCheckoutRecord,
  result: CartCheckoutResult
) {
  if (
    result.status !== "success" &&
    result.status !== "partial" &&
    result.status !== "refunded"
  ) {
    return;
  }
  if (!record.guest.email) return;

  const lines: CartConfirmationLine[] = record.lines.map((cartLine) => {
    const lineResult = result.reservations.find(
      (r) => r.lineId === cartLine.lineId
    );
    return {
      listingTitle: cartLine.listingTitle,
      listingPicture: cartLine.listingPicture,
      city: cartLine.listingCity,
      checkIn: cartLine.checkIn,
      checkOut: cartLine.checkOut,
      guests: cartLine.guests,
      status:
        lineResult?.status === "reserved"
          ? "reserved"
          : lineResult?.status === "refunded"
            ? "refunded"
            : "failed",
      reservationId: lineResult?.reservationId,
      confirmationCode: lineResult?.confirmationCode,
      hostPayout: cartLine.hostPayout,
      refundAmount: lineResult?.refundAmount,
    };
  });

  await sendCartConfirmationEmail({
    guestEmail: record.guest.email,
    guestName: [record.guest.firstName, record.guest.lastName]
      .filter(Boolean)
      .join(" "),
    cartId: record.cartId,
    outcome: result.status,
    lines,
    totalCharged:
      result.status === "success"
        ? result.totalCharged
        : result.status === "partial"
          ? result.totalCharged
          : 0,
    totalRefunded:
      result.status === "partial"
        ? result.totalRefunded
        : result.status === "refunded"
          ? result.totalRefunded
          : undefined,
  });
}

/** Reserve one line: re-fetch fresh quote (handles expiry), call Guesty
 * BEAPI /instant with retries, record payment for the line's portion of
 * the combined PI. Throws on any unrecoverable error. */
async function reserveCartLine(args: {
  line: CartLine;
  paymentIntent: { id: string; payment_method: string | { id?: string } | null };
  guest: PendingCartCheckoutRecord["guest"];
}): Promise<CartReservationLineResult> {
  const { line, paymentIntent, guest } = args;

  // Pre-flight dedup: if this line was already created on a previous retry,
  // short-circuit. We key on (paymentIntentId + listingId + checkIn).
  const pool = getPool();
  const existing = await pool.query(
    `SELECT guesty_id, confirmation_code FROM reservations
       WHERE stripe_payment_intent_id = $1
         AND listing_id = $2
         AND check_in = $3
       LIMIT 1`,
    [paymentIntent.id, line.listingId, line.checkIn]
  );
  if (existing.rows.length > 0) {
    return {
      lineId: line.lineId,
      listingId: line.listingId,
      status: "reserved",
      reservationId: String(existing.rows[0].guesty_id),
      confirmationCode: existing.rows[0].confirmation_code
        ? String(existing.rows[0].confirmation_code)
        : undefined,
      hostPayout: line.hostPayout,
    };
  }

  // Fresh quote re-fetch — the cart could have sat for hours between
  // payment-intent creation and reservation finalize.
  let activeQuoteId = line.quoteId;
  let activeRatePlanId = line.ratePlanId;
  const freshQuote = await getQuote(line.quoteId);
  const expiresAt = freshQuote?.expiresAt
    ? new Date(freshQuote.expiresAt as string).getTime()
    : 0;
  if (expiresAt > 0 && expiresAt < Date.now()) {
    const recreated = await createQuote({
      listingId: line.listingId,
      checkIn: line.checkIn,
      checkOut: line.checkOut,
      guestsCount: line.guests,
    });
    activeQuoteId = recreated._id as string;
    const rp = recreated?.rates?.ratePlans?.[0]?.ratePlan;
    activeRatePlanId = (rp?._id as string) || activeRatePlanId;
  } else if (!activeRatePlanId) {
    const rp = freshQuote?.rates?.ratePlans?.[0]?.ratePlan;
    activeRatePlanId = (rp?._id as string) || null;
  }
  if (!activeRatePlanId) {
    throw new Error("No valid rate plan for cart line");
  }

  const ccToken =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id || "";

  // 3-attempt retry mirrors single-flow finalizer.
  let reservation: Record<string, unknown> | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      reservation = await createReservationInstant({
        quoteId: activeQuoteId,
        ratePlanId: activeRatePlanId,
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
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  if (!reservation) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Guesty reservation creation failed after retries");
  }

  const reservationId = String(
    reservation._id || reservation.id || reservation.reservationId || ""
  );
  if (!reservationId) {
    throw new Error("Reservation created without an ID");
  }
  const confirmationCode = String(
    reservation.confirmationCode || reservation.confirmation_code || ""
  );

  // Persist the reservation locally BEFORE attempting payment record. This
  // mirrors the single-flow ordering — a Guesty reservation that exists but
  // has no local row is invisible to the recover-checkouts / record-payments
  // crons. Best-effort insert; DB failures are logged but don't fail the line.
  let payeeRecordedAt: number | null = null;
  try {
    await pool.query(
      `INSERT INTO reservations (
         guesty_id, confirmation_code, listing_id, guest_id, status, source,
         check_in, check_out, guests_count, guest, money, last_synced_at,
         stripe_payment_intent_id, user_id, payment_recorded_at
       ) VALUES ($1, $2, $3, $4, $5, 'BE-API', $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (guesty_id) DO UPDATE SET
         status = EXCLUDED.status,
         confirmation_code = EXCLUDED.confirmation_code,
         guest = EXCLUDED.guest,
         money = COALESCE(reservations.money, EXCLUDED.money),
         stripe_payment_intent_id = COALESCE(reservations.stripe_payment_intent_id, EXCLUDED.stripe_payment_intent_id),
         payment_recorded_at = COALESCE(reservations.payment_recorded_at, EXCLUDED.payment_recorded_at),
         last_synced_at = $11`,
      [
        reservationId,
        confirmationCode || null,
        line.listingId,
        ((reservation.guestId || reservation.bookerId) as string) || null,
        (reservation.status as string) || "confirmed",
        line.checkIn,
        line.checkOut,
        line.guests,
        JSON.stringify({
          email: guest.email || null,
          firstName: guest.firstName || null,
          lastName: guest.lastName || null,
          fullName:
            [guest.firstName, guest.lastName].filter(Boolean).join(" ") || null,
          phone: guest.phone || null,
        }),
        JSON.stringify({ total_paid: line.hostPayout, currency: "USD" }),
        Date.now(),
        paymentIntent.id,
        null,
        null,
      ]
    );
  } catch (dbErr) {
    console.error(
      `[cart] Reservations table write failed for ${reservationId}:`,
      dbErr instanceof Error ? dbErr.message : dbErr
    );
  }

  // Record the line's portion of the combined PI to Guesty's OpenAPI.
  // Mirrors single-flow tolerance: if the call exhausts its in-request retry
  // budget, we DO NOT fail the line — the reservation in Guesty is real.
  // The /api/cron/record-payments job picks up reservations with
  // payment_recorded_at IS NULL and retries indefinitely. This was the bug
  // that caused the first cart test to refund two real reservations.
  try {
    await recordPaymentWithIndexingRetry(
      reservationId,
      line.hostPayout,
      paymentIntent.id
    );
    payeeRecordedAt = Date.now();
    await pool.query(
      `UPDATE reservations
          SET payment_recorded_at = COALESCE(payment_recorded_at, $1)
        WHERE guesty_id = $2`,
      [payeeRecordedAt, reservationId]
    );
  } catch (paymentErr) {
    console.warn(
      `[cart] recordPayment failed for ${reservationId} (will retry via cron):`,
      paymentErr instanceof Error ? paymentErr.message : paymentErr
    );
  }

  return {
    lineId: line.lineId,
    listingId: line.listingId,
    status: "reserved",
    reservationId,
    confirmationCode: confirmationCode || undefined,
    hostPayout: line.hostPayout,
  };
}

/** Refund the unfulfilled portion of the combined PI. If Stripe's refund
 * call itself fails, mark the cart `refund_failed` and let the reconcile
 * cron retry — never lose track of a partial-success cart. */
async function refundFailedLines(args: {
  record: PendingCartCheckoutRecord;
  paymentIntent: { id: string; amount: number };
  lineResults: CartReservationLineResult[];
  totalCharged: number;
  reservedCount: number;
}): Promise<CartCheckoutResult> {
  const { record, paymentIntent, lineResults, totalCharged, reservedCount } =
    args;

  const failedLines = lineResults.filter((r) => r.status === "failed");
  const refundAmount = failedLines.reduce((sum, r) => sum + r.hostPayout, 0);
  const refundAmountCents = Math.round(refundAmount * 100);

  const stripe = getStripeServer();
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: refundAmountCents,
      reason: "requested_by_customer",
      metadata: {
        cartId: record.cartId,
        partialFailure: "true",
        failedLineIds: failedLines.map((r) => r.lineId).join(","),
      },
    });

    // Mark each failed line as refunded with its prorated share. We refund
    // one Stripe refund covering all failed lines, but we annotate per-line
    // for accounting clarity.
    for (const r of failedLines) {
      r.status = "refunded";
      r.refundAmount = r.hostPayout;
      await updateCartLine(record.paymentIntentId, r.lineId, {
        status: "refunded",
        refundAmount: r.hostPayout,
      });
    }

    const terminalStatus = reservedCount === 0 ? "refunded" : "partial";
    await setCartStatus(record.paymentIntentId, terminalStatus, {
      markCompleted: true,
      lastError: `${failedLines.length} line(s) failed; refund=${refund.id}`,
    });

    if (reservedCount === 0) {
      return {
        status: "refunded",
        cartId: record.cartId,
        reservations: lineResults,
        totalRefunded: refundAmount,
      };
    }
    return {
      status: "partial",
      cartId: record.cartId,
      reservations: lineResults,
      totalCharged,
      totalRefunded: refundAmount,
    };
  } catch (refundError) {
    const message =
      refundError instanceof Error ? refundError.message : String(refundError);
    console.error(
      `[cart] CRITICAL: Stripe refund failed for cart ${record.cartId}:`,
      message
    );
    await setCartStatus(record.paymentIntentId, "refund_failed", {
      lastError: `Refund failed: ${message}. Reconcile cron will retry.`,
    });

    await sendAlert(
      "CART REFUND FAILED — MANUAL RECOVERY",
      [
        "<p>A multi-listing cart had partial-failure reservation creation, but the Stripe refund call for the unfulfilled portion failed. The reconcile-cart-refunds cron will retry every 10 min, but ops should also confirm.</p>",
        renderAlertDetails([
          ["Cart ID", record.cartId],
          ["PaymentIntent", paymentIntent.id],
          ["Guest email", record.guest.email],
          ["Total charged", `$${totalCharged.toFixed(2)}`],
          ["Refund amount needed", `$${refundAmount.toFixed(2)}`],
          [
            "Reserved lines",
            String(lineResults.filter((r) => r.status === "reserved").length),
          ],
          ["Failed lines", String(failedLines.length)],
          ["Refund error", message],
        ]),
        renderAlertLinks([
          {
            label: "Stripe payment",
            url: buildStripeDashboardPaymentUrl(paymentIntent.id),
          },
        ]),
      ].join(""),
      `cart-refund-failed-${record.cartId}`
    );

    return {
      status: "refund_failed",
      cartId: record.cartId,
      reservations: lineResults,
      message:
        "Your reservations were partially confirmed but our refund processor is delayed. Our team has been notified and will resolve manually.",
    };
  }
}

function buildResultFromRecord(
  record: PendingCartCheckoutRecord
): CartCheckoutResult {
  const reservations: CartReservationLineResult[] = record.lines.map((l) => ({
    lineId: l.lineId,
    listingId: l.listingId,
    status:
      l.status === "reserved"
        ? "reserved"
        : l.status === "refunded"
          ? "refunded"
          : "failed",
    reservationId: l.reservationId ?? undefined,
    hostPayout: l.hostPayout,
    refundAmount: l.refundAmount ?? undefined,
    error: l.errorMessage ?? undefined,
  }));
  const totalCharged = reservations
    .filter((r) => r.status === "reserved")
    .reduce((s, r) => s + r.hostPayout, 0);
  const totalRefunded = reservations
    .filter((r) => r.status === "refunded")
    .reduce((s, r) => s + (r.refundAmount ?? 0), 0);

  if (record.status === "completed") {
    return {
      status: "success",
      cartId: record.cartId,
      reservations,
      totalCharged,
    };
  }
  if (record.status === "partial") {
    return {
      status: "partial",
      cartId: record.cartId,
      reservations,
      totalCharged,
      totalRefunded,
    };
  }
  if (record.status === "refunded") {
    return {
      status: "refunded",
      cartId: record.cartId,
      reservations,
      totalRefunded,
    };
  }
  return {
    status: "refund_failed",
    cartId: record.cartId,
    reservations,
    message:
      record.lastError ??
      "Cart processing encountered an error; ops has been notified.",
  };
}
