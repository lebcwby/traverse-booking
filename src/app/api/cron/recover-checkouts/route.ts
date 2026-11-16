import { NextResponse } from "next/server";
import {
  finalizeReservation,
  ReservationPendingRecoveryError,
} from "@/lib/checkout-finalizer";
import {
  listRecoverablePendingCheckouts,
  markPendingCheckoutError,
  type PendingCheckoutRecord,
} from "@/lib/pending-checkouts";
import { getStripeServer } from "@/lib/stripe";
import { chargeBillingName, splitWalletName } from "@/lib/express-billing";
import {
  buildStripeDashboardPaymentUrl,
  formatDurationMs,
  PER_ENTITY_CADENCE_HOURS,
  renderAlertDetails,
  renderAlertLinks,
  sendAlert,
} from "@/lib/alerts";
import { classifyBeapiError } from "@/lib/beapi-error";
import { getOpenAPIReservationsPage } from "@/lib/guesty-openapi";
import {
  buildReconcilePlan,
  describeReconcileFailure,
  type GuestyReservationLike,
} from "@/lib/pending-checkout-reconcile";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const ALERT_AFTER_MS = 15 * 60 * 1000;

/**
 * Fields the auto-link search pulls from Guesty's OpenAPI. Kept narrow:
 * the match validator reads listingId/dates/guest/money.hostPayout, nothing
 * else. Pulling more would bloat the response for no gain.
 */
const AUTO_LINK_FIELDS =
  "_id confirmationCode status listingId checkIn checkOut guestsCount guest money.hostPayout money.totalPaid money.fareAccommodation";

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

        // Auto-link path — if Guesty says the dates are no longer available
        // on a paid_pending_reservation row, the single remaining possibility
        // (short of the guest colliding with themselves) is that ops has
        // created the reservation by hand. Check Guesty for an exact match
        // and stamp the row so the retry loop stops. Any ambiguity → no
        // write, falls through to the normal fail-alert below.
        const classified = classifyBeapiError(error);
        if (
          classified.code === "DATES_UNAVAILABLE" &&
          row.status === "paid_pending_reservation" &&
          paymentIntent?.status === "succeeded"
        ) {
          const linked = await tryAutoLinkStuckCheckout(
            row,
            { id: row.paymentIntentId, amount: paymentIntent.amount ?? 0 },
            message
          );
          if (linked) {
            recovered++;
            continue;
          }
        }

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
            `checkout-recovery-fail-${row.paymentIntentId}`,
            // Per-PI cadence: first → +24h → +48h, then the daily
            // incident-digest cron picks it up. Previous per-hour cadence
            // meant 20 stuck PIs could produce ~480 emails/day.
            { cadenceHours: PER_ENTITY_CADENCE_HOURS }
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

/**
 * Try to detect a Guesty reservation that ops created by hand and link it
 * to a stuck pending_checkouts row. Returns true iff the link happened;
 * false (silently) on every ambiguous or mismatching case so the caller
 * continues to the normal fail-alert path.
 *
 * Strict by construction: exactly one Guesty match on listing + stay, and
 * every field downstream (email, amount) verified by buildReconcilePlan
 * before any write. A wrong link would mark the stuck guest as booked
 * while their money sits against a different reservation; the only
 * acceptable failure mode here is "didn't link and a human handles it".
 */
async function tryAutoLinkStuckCheckout(
  row: PendingCheckoutRecord,
  stripePaymentIntent: { id: string; amount: number },
  lastError: string
): Promise<boolean> {
  try {
    const { results } = await getOpenAPIReservationsPage({
      fields: AUTO_LINK_FIELDS,
      limit: 5,
      sort: "-createdAt",
      filters: [
        { field: "listingId", operator: "$eq", value: row.tracking.listingId },
        { field: "checkIn", operator: "$eq", value: row.tracking.checkIn },
        { field: "checkOut", operator: "$eq", value: row.tracking.checkOut },
      ],
    });

    // Ambiguity is a non-link, not an error. The retry loop will stop
    // naturally once a human stamps the row; the alert tells them to.
    const candidates = results.filter(
      (r) =>
        !["cancelled", "declined", "inquiry"].includes(
          String((r as { status?: string }).status || "").toLowerCase()
        )
    );
    if (candidates.length !== 1) {
      console.log("[recover-checkouts auto-link] inconclusive candidate set", {
        paymentIntentId: row.paymentIntentId,
        listingId: row.tracking.listingId,
        found: candidates.length,
      });
      return false;
    }

    const candidate = candidates[0] as GuestyReservationLike;
    const decision = buildReconcilePlan({
      pending: {
        paymentIntentId: row.paymentIntentId,
        reservationId: row.reservationId,
        tracking: {
          listingId: row.tracking.listingId,
          listingTitle: row.tracking.listingTitle,
          checkIn: row.tracking.checkIn,
          checkOut: row.tracking.checkOut,
          guests: row.tracking.guests,
        },
        guest: {
          email: row.guest.email,
          firstName: row.guest.firstName,
          lastName: row.guest.lastName,
          phone: row.guest.phone,
        },
      },
      stripePaymentIntent,
      guestyReservation: candidate,
    });

    if (!decision.ok) {
      console.log("[recover-checkouts auto-link] match verification failed", {
        paymentIntentId: row.paymentIntentId,
        candidate: candidate._id,
        reason: describeReconcileFailure(decision.reason),
      });
      return false;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateRes = await client.query(
        decision.updates.pendingCheckoutUpdate.sql,
        decision.updates.pendingCheckoutUpdate.params
      );
      // Row disappeared (concurrent stamp) → roll back and let the caller
      // go through the normal path. 0 rows updated is NOT an error.
      if (updateRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        decision.updates.reservationsUpsert.sql,
        decision.updates.reservationsUpsert.params
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(
        "[recover-checkouts auto-link] transaction failed, rolled back",
        { paymentIntentId: row.paymentIntentId, err }
      );
      return false;
    } finally {
      client.release();
    }

    // One-time per-PI alert with the stricter cadence — this is a
    // resolved incident, not an ongoing one, so no reminders.
    const stripeUrl = buildStripeDashboardPaymentUrl(row.paymentIntentId);
    await sendAlert(
      "CHECKOUT AUTO-LINKED to existing Guesty reservation",
      [
        "<p>A stuck pending_checkouts row was linked to a Guesty reservation that ops created by hand. The retry loop and the orphan sweep will both stop firing for this PI.</p>",
        renderAlertDetails([
          ["PaymentIntent", row.paymentIntentId],
          ["Guesty reservation", decision.reservationId],
          ["Confirmation code", decision.confirmationCode ?? "(none)"],
          ["Listing", row.tracking.listingTitle || decision.listingId],
          ["Stay", `${decision.checkIn} → ${decision.checkOut}`],
          ["Guest email", decision.guestEmail],
          [
            "Amount",
            `Stripe $${decision.chargedAmount.toFixed(2)} = Guesty $${decision.guestyMoneyMatched.toFixed(2)} (within 1¢)`,
          ],
          ["Previous error", lastError],
        ]),
        renderAlertLinks([{ label: "Stripe payment", url: stripeUrl }]),
      ].join(""),
      `checkout-auto-linked-${row.paymentIntentId}`,
      { cadenceHours: [] } // one email, then silent
    );

    console.log("[recover-checkouts auto-link] linked", {
      paymentIntentId: row.paymentIntentId,
      reservationId: decision.reservationId,
    });
    return true;
  } catch (err) {
    console.warn(
      "[recover-checkouts auto-link] threw — falling through to normal fail path",
      { paymentIntentId: row.paymentIntentId, err }
    );
    return false;
  }
}
