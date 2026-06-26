import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendAlert } from "@/lib/alerts";
import {
  finalizeReservation,
  ReservationPendingRecoveryError,
} from "@/lib/checkout-finalizer";
import {
  getPendingCheckout,
  markPendingCheckoutError,
} from "@/lib/pending-checkouts";
import { subscribeToKlaviyoList } from "@/lib/server-tracking";
import { getStripeServer } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Allow up to 60s so finalizeReservation can retry recordPayment through the
// Guesty indexing race (~3-9s) instead of deferring to the cron.
export const maxDuration = 60;

function getPaymentErrorMessage(paymentIntent: Stripe.PaymentIntent) {
  return (
    paymentIntent.last_payment_error?.message ||
    paymentIntent.last_payment_error?.code ||
    `Payment intent ${paymentIntent.status}`
  );
}

/**
 * Real-time double-charge guard. When a PaymentIntent succeeds, check whether
 * the SAME Stripe customer already has another SUCCEEDED PaymentIntent for the
 * SAME stay (listing + check-in + check-out). Two succeeded PIs for one stay
 * means the guest was charged twice — e.g. attempt #1 charged but failed to
 * finalize, the guest retried with a fresh quote, and attempt #2 charged again
 * (this is exactly what happened to GY-CvXxRDxw on 2026-05-31).
 *
 * Why this is needed: reservation-level dedup (stay_key / payment_intent_id)
 * prevents a duplicate RESERVATION, but NOT a duplicate CHARGE — each checkout
 * attempt mints a new quote → new PaymentIntent → new chargeable idempotency
 * key. Nothing else watches the charge layer. Best-effort + read-only: it never
 * blocks or alters the booking, only emails an ops alert so the extra charge
 * can be refunded.
 */
async function detectDoubleCharge(paymentIntent: Stripe.PaymentIntent) {
  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : (paymentIntent.customer?.id ?? null);
  const listingId = paymentIntent.metadata?.listingId;
  const checkIn = paymentIntent.metadata?.checkIn;
  const checkOut = paymentIntent.metadata?.checkOut;
  // Without a customer + stay we can't correlate a duplicate reliably; skip.
  if (!customerId || !listingId || !checkIn || !checkOut) return;

  const stripe = getStripeServer();
  const list = await stripe.paymentIntents.list({
    customer: customerId,
    limit: 50,
  });
  const sameStaySucceeded = list.data.filter(
    (pi) =>
      pi.status === "succeeded" &&
      pi.metadata?.listingId === listingId &&
      pi.metadata?.checkIn === checkIn &&
      pi.metadata?.checkOut === checkOut
  );
  if (sameStaySucceeded.length < 2) return;

  const rows = sameStaySucceeded
    .map(
      (pi) =>
        `<li><code>${pi.id}</code> — $${((pi.amount ?? 0) / 100).toFixed(
          2
        )} — ${new Date(pi.created * 1000).toLocaleString("en-US", {
          timeZone: "America/Denver",
        })} MT — confirmation: ${
          pi.metadata?.confirmationCode || "(none — likely the orphan charge)"
        }</li>`
    )
    .join("");
  const total =
    sameStaySucceeded.reduce((s, pi) => s + (pi.amount ?? 0), 0) / 100;

  await sendAlert(
    "POSSIBLE DOUBLE CHARGE",
    `Stripe customer <code>${customerId}</code> has <b>${sameStaySucceeded.length} succeeded payments</b> for the SAME stay (listing <code>${listingId}</code>, ${checkIn} → ${checkOut}), totaling <b>$${total.toFixed(
      2
    )}</b>.<br><br><ul>${rows}</ul>One charge per stay is expected. Review in Stripe and <b>refund the duplicate</b> — the charge with no confirmation code is usually the orphan to refund.`,
    // Cooldown per STAY (not per PI) so both PIs' webhooks don't double-send.
    `double-charge-${listingId}-${checkIn}-${checkOut}`,
    // Double-charge alerts go to the ops inbox (added to ALERT_TO_EMAIL).
    { to: "admin@traversehospitality.com" }
  ).catch(() => {});
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  // Double-charge guard runs first, independent of pending/finalize state, so
  // it fires even when the duplicate's pending row is missing. Never throws.
  await detectDoubleCharge(paymentIntent).catch(() => {});

  const pending = await getPendingCheckout(paymentIntent.id);
  if (!pending) {
    await sendAlert(
      "PAID BOOKING MISSING PENDING CHECKOUT",
      `Stripe webhook received <code>payment_intent.succeeded</code> for <code>${paymentIntent.id}</code>, but no pending checkout row was found.<br><br>Quote: ${paymentIntent.metadata.quoteId || "(missing)"}<br>Guest email: ${paymentIntent.metadata.guestEmail || "(missing)"}<br>Total charged: $${(paymentIntent.amount / 100).toFixed(2)}`,
      `missing-pending-checkout-${paymentIntent.id}`,
      // Orphan-charge alert → ops inbox (a paid booking with no reservation).
      { to: "admin@traversehospitality.com" }
    ).catch(() => {});
    return;
  }

  const guest = {
    firstName: pending.guest.firstName || "",
    lastName: pending.guest.lastName || "",
    email: pending.guest.email || paymentIntent.metadata.guestEmail || "",
    phone: pending.guest.phone || "",
  };

  if (!guest.email || !guest.firstName || !guest.lastName) {
    const message =
      "Payment received, but checkout details were incomplete before redirect. Manual follow-up may be required.";
    await markPendingCheckoutError(
      paymentIntent.id,
      message,
      "paid_pending_reservation"
    ).catch(() => {});
    await sendAlert(
      "PAID BOOKING MISSING GUEST DETAILS",
      `Stripe webhook received <code>payment_intent.succeeded</code> for <code>${paymentIntent.id}</code>, but the pending checkout record is missing full guest details.<br><br>Quote: ${pending.quoteId}<br>Guest email: ${guest.email || "(missing)"}<br>Total charged: $${(paymentIntent.amount / 100).toFixed(2)}<br><br>The booking was not auto-refunded. The recovery path remains active.`,
      `missing-pending-guest-${paymentIntent.id}`,
      // Orphan-charge alert → ops inbox (a paid booking with no reservation).
      { to: "admin@traversehospitality.com" }
    ).catch(() => {});
    return;
  }

  try {
    await finalizeReservation({
      paymentIntentId: paymentIntent.id,
      quoteId: pending.quoteId,
      guest,
      tracking: pending.tracking,
      upsells: pending.upsells,
      pets: pending.pets,
      // Replay the cookies + request context captured at payment-intent
      // creation. Stripe webhooks fire server-to-server with no user cookies,
      // so without this Meta CAPI / Google Ads server uploads would lose
      // fbp/fbc/gclid/IP/UA on every webhook-finalized booking (~half).
      cookies: pending.trackingContext?.cookies,
      requestContext: pending.trackingContext?.requestContext,
    });

    // Subscribe to Klaviyo if guest opted in during checkout
    if (pending.tracking?.marketingOptIn && guest.email) {
      subscribeToKlaviyoList({
        email: guest.email,
        phone: guest.phone || undefined,
        firstName: guest.firstName || undefined,
        lastName: guest.lastName || undefined,
      }).catch((err) =>
        console.error("[Klaviyo] Webhook subscribe error:", err)
      );
    }
  } catch (error) {
    if (error instanceof ReservationPendingRecoveryError) {
      return;
    }
    throw error;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await markPendingCheckoutError(
    paymentIntent.id,
    getPaymentErrorMessage(paymentIntent),
    "payment_failed"
  ).catch(() => {});
}

async function handlePaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent
) {
  const reason = paymentIntent.cancellation_reason || "unknown";
  await markPendingCheckoutError(
    paymentIntent.id,
    `Payment intent canceled (${reason})`,
    "canceled"
  ).catch(() => {});
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  // Trim defensively — Vercel env values for credentials have been observed
  // to retain trailing literal "\n" characters; HMAC signature verification
  // is byte-exact and would silently 400 every webhook if the secret had any
  // stray bytes.
  const webhookSecret =
    (process.env.STRIPE_WEBHOOK_SECRET || "").trim() || undefined;

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error(
      "[Stripe Webhook] Signature verification failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(
          event.data.object as Stripe.PaymentIntent
        );
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Handler error:", error);
    await sendAlert(
      "STRIPE WEBHOOK HANDLER FAILED",
      `Stripe webhook <code>${event.type}</code> failed for event <code>${event.id}</code>.<br><br>${error instanceof Error ? error.message : "Unknown error"}`,
      `stripe-webhook-failure-${event.id}`
    ).catch(() => {});
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
