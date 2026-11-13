import { NextResponse } from "next/server";
import {
  finalizeReservation,
  ReservationPendingRecoveryError,
} from "@/lib/checkout-finalizer";
import {
  listRecoverablePendingCheckouts,
  markPendingCheckoutError,
} from "@/lib/pending-checkouts";
import { getStripeServer } from "@/lib/stripe";
import {
  chargeBillingName,
  splitWalletName,
} from "@/lib/express-billing";
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
        latest_charge?: unknown;
      } | null = null;
      try {
        // latest_charge is expanded for its billing_details — see the name
        // backfill below. One expand costs nothing extra; a second retrieve
        // per stuck row would.
        paymentIntent = await stripe.paymentIntents.retrieve(
          row.paymentIntentId,
          { expand: ["latest_charge"] }
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

        // ...and to the charge's billing details for a missing NAME.
        //
        // Guesty rejects a reservation whose guest.firstName or lastName is
        // empty, so a row missing them can never finalise: the cron retries
        // every 10 minutes forever, minting a fresh Guesty quote each time
        // and failing identically. pi_3UZX3uFlSHWQrCQq1wzui10S did that for
        // 46 hours with $477.44 taken and the guest holding nothing.
        //
        // The payment-intent route only ever stamps guestEmail and guestPhone
        // into metadata — it is never sent a name — so the charge is the only
        // place a name can come from on this path.
        //
        // This does not help if Stripe has no name either; the alert below
        // still fires and it still needs doing by hand. It turns the cases
        // where Stripe DOES hold the name from a manual job into a no-op.
        if (!guest.firstName?.trim() || !guest.lastName?.trim()) {
          const billingName = chargeBillingName(paymentIntent.latest_charge);
          if (billingName) {
            const parsed = splitWalletName(billingName);
            if (parsed.firstName && parsed.lastName) {
              guest.firstName = parsed.firstName;
              guest.lastName = parsed.lastName;
              console.log(
                "[Cron] recover-checkouts backfilled guest name from Stripe",
                { paymentIntentId: row.paymentIntentId }
              );
            }
          }
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
        // Preserve the underlying Guesty cause. Writing only error.message
        // here is what erased the diagnostic on every stuck checkout.
        const detail =
          error instanceof ReservationPendingRecoveryError && error.detail
            ? ` Guesty error: ${error.detail}`
            : "";
        const message =
          (error instanceof Error ? error.message : "Unknown recovery error") +
          detail;
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
                  row.status === "paid_pending_reservation"
                    ? "Money is captured and the guest has no booking. Recovery retries every 10 minutes with no age limit. If this alert repeats, create the reservation in Guesty by hand, verify the Stripe payment was recorded against it, then set reservation_id on the pending_checkouts row — stamping the row is what stops both the retries and this alert."
                    : "Recovery retries every 10 minutes until the row is 2 days old. Nothing was captured, so no guest action is outstanding.",
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
