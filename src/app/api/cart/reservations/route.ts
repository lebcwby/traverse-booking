// Multi-listing cart reservation endpoint. Hands off to the coordinator
// state machine after Stripe confirms the combined PI. Mirrors the
// single-flow /api/reservations contract:
//  - 200 with `{status: 'success'|'partial'|'refunded', ...}` on a clean
//    terminal outcome (success and partial both count as "the user got
//    something", so still 200 — the response shape tells them which).
//  - 202 with `{status: 'refund_failed', ...}` when Stripe's refund call
//    itself errored (reconcile cron will retry; treat as a soft pending).
//  - 500 on coordinator throws (e.g., Stripe PI not succeeded) — these are
//    typically client-side bugs (the form let through an unconfirmed PI).
//
// No request body needed beyond `paymentIntentId` — the coordinator pulls
// guest + lines + tracking context from the durable pending_cart_checkouts
// row that /api/cart/payment-intent created.

import { NextRequest, NextResponse } from "next/server";
import { finalizeCartCheckout } from "@/lib/cart/checkout-coordinator";
import { subscribeToKlaviyoList } from "@/lib/server-tracking";
import { getPendingCartCheckoutByPaymentIntent } from "@/lib/cart/pending-cart-checkouts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId } = body as { paymentIntentId?: string };

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }

    const result = await finalizeCartCheckout(paymentIntentId);

    // Klaviyo opt-in subscribe — fire-and-forget, mirrors single flow.
    if (
      result.status === "success" ||
      result.status === "partial" ||
      result.status === "refunded"
    ) {
      const record =
        await getPendingCartCheckoutByPaymentIntent(paymentIntentId);
      if (record?.marketingOptIn && record.guest.email) {
        subscribeToKlaviyoList({
          email: record.guest.email,
          phone: record.guest.phone || undefined,
          firstName: record.guest.firstName || undefined,
          lastName: record.guest.lastName || undefined,
        }).catch((err) =>
          console.error("[Klaviyo] Cart subscribe error:", err)
        );
      }
    }

    if (result.status === "refund_failed") {
      // 202 — partial state, ops alerted, reconcile cron retries.
      return NextResponse.json(result, { status: 202 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[CartReservations] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize cart checkout",
      },
      { status: 500 }
    );
  }
}
