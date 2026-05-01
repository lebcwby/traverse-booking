import { NextResponse } from "next/server";
import { finalizeReservation } from "@/lib/checkout-finalizer";
import {
  listRecoverablePendingCheckouts,
  markPendingCheckoutError,
} from "@/lib/pending-checkouts";
import { getStripeServer } from "@/lib/stripe";
import {
  buildStripeDashboardPaymentUrl,
  formatDurationMs,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const ALERT_AFTER_MS = 15 * 60 * 1000;

export async function GET() {
  try {
    const stripe = getStripeServer();
    const pending = await listRecoverablePendingCheckouts(20);
    let recovered = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of pending) {
      let paymentIntent: {
        status?: string;
        amount?: number;
        metadata?: Record<string, string>;
      } | null = null;
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(
          row.paymentIntentId
        );
        if (paymentIntent.status !== "succeeded") {
          skipped++;
          continue;
        }

        // Fall back to Stripe PI metadata for missing guest email
        const guest = { ...row.guest };
        if (!guest.email && paymentIntent.metadata?.guestEmail) {
          guest.email = paymentIntent.metadata.guestEmail;
        }

        await finalizeReservation({
          paymentIntentId: row.paymentIntentId,
          quoteId: row.quoteId,
          guest,
          tracking: row.tracking,
          upsells: row.upsells,
          pets: row.pets,
          // Replay tracking context captured at payment-intent time so Meta
          // CAPI / Google Ads server uploads keep fbp/fbc/gclid/IP/UA on
          // recovery-finalized bookings (cron has no user cookies of its own).
          cookies: row.trackingContext?.cookies,
          requestContext: row.trackingContext?.requestContext,
        });
        recovered++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown recovery error";
        errors.push(`${row.paymentIntentId}: ${message}`);
        console.error("[Recover Checkouts] Failed recovery attempt", {
          paymentIntentId: row.paymentIntentId,
          quoteId: row.quoteId,
          status: row.status,
          guestEmail: row.guest.email,
          listingId: row.tracking.listingId,
          listingTitle: row.tracking.listingTitle,
          checkIn: row.tracking.checkIn,
          checkOut: row.tracking.checkOut,
          error: message,
        });
        await markPendingCheckoutError(
          row.paymentIntentId,
          message,
          row.status === "paid_pending_reservation"
            ? "paid_pending_reservation"
            : "pending"
        ).catch(() => {});

        const pendingAgeMs = Date.now() - new Date(row.createdAt).getTime();
        const shouldAlert =
          paymentIntent?.status === "succeeded" &&
          pendingAgeMs >= ALERT_AFTER_MS;

        if (shouldAlert) {
          const stripePaymentUrl = buildStripeDashboardPaymentUrl(
            row.paymentIntentId
          );
          const chargedAmount = Number(paymentIntent?.amount || 0) / 100;
          await sendAlert(
            "Checkout Recovery Still Failing",
            [
              "<p>A succeeded Stripe payment is still stuck in checkout recovery.</p>",
              renderAlertDetails([
                ["PaymentIntent", row.paymentIntentId],
                ["Quote ID", row.quoteId],
                ["Pending status", row.status],
                ["Guest email", row.guest.email],
                [
                  "Guest name",
                  [row.guest.firstName, row.guest.lastName]
                    .filter(Boolean)
                    .join(" "),
                ],
                ["Listing", row.tracking.listingTitle],
                ["Check-in", row.tracking.checkIn],
                ["Check-out", row.tracking.checkOut],
                ["Guests", row.tracking.guests],
                ["Charged amount", `$${chargedAmount.toFixed(2)}`],
                ["Pending age", formatDurationMs(pendingAgeMs)],
                ["Last error", message],
                ["Previous error", row.lastError || ""],
                [
                  "Next action",
                  "Recovery cron will keep retrying. If this alert repeats, create the reservation manually and verify Stripe was recorded in Guesty.",
                ],
              ]),
              renderAlertLinks([
                { label: "Stripe payment", url: stripePaymentUrl },
              ]),
            ].join(""),
            `checkout-recovery-fail-${row.paymentIntentId}`
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: pending.length,
      recovered,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[Recover Checkouts] Error:", error);
    return NextResponse.json(
      { error: "Failed to recover pending checkouts" },
      { status: 500 }
    );
  }
}
