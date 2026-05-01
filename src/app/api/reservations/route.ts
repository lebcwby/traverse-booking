import { NextRequest, NextResponse } from "next/server";
import {
  finalizeReservation,
  ReservationPendingRecoveryError,
} from "@/lib/checkout-finalizer";
import { getPendingCheckout } from "@/lib/pending-checkouts";
import { subscribeToKlaviyoList } from "@/lib/server-tracking";

const GA_SESSION_COOKIE = "_ga_PPWFFFPC42";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentIntentId,
      quoteId,
      guest,
      tracking,
      upsells,
      pets,
      marketingOptIn,
    } = body;

    if (!paymentIntentId || !quoteId || !guest) {
      return NextResponse.json(
        { error: "paymentIntentId, quoteId, and guest are required" },
        { status: 400 }
      );
    }

    const pending = await getPendingCheckout(paymentIntentId);
    const resolvedGuest = guest || pending?.guest;
    const resolvedTracking = tracking || pending?.tracking;
    const resolvedUpsells = Array.isArray(upsells)
      ? upsells
      : pending?.upsells || [];
    const resolvedPets = typeof pets === "number" ? pets : pending?.pets || 0;

    if (!resolvedGuest) {
      return NextResponse.json(
        { error: "Guest details are required" },
        { status: 400 }
      );
    }

    const result = await finalizeReservation({
      paymentIntentId,
      quoteId,
      guest: resolvedGuest,
      tracking: resolvedTracking,
      upsells: resolvedUpsells,
      pets: resolvedPets,
      cookies: {
        attribution: request.cookies.get("_sp_attribution")?.value,
        firstTouch: request.cookies.get("_sp_first_touch")?.value,
        ga: request.cookies.get("_ga")?.value,
        gaSession: request.cookies.get(GA_SESSION_COOKIE)?.value,
        consent: request.cookies.get("_sp_consent")?.value,
        legacyCcpaOptOut: request.cookies.get("_sp_ccpa_optout")?.value,
        fbp: request.cookies.get("_fbp")?.value,
        fbc: request.cookies.get("_fbc")?.value,
      },
      requestContext: {
        clientIp:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          undefined,
        clientUserAgent: request.headers.get("user-agent") || undefined,
      },
    });

    // Subscribe to Klaviyo email list if guest opted in (fire-and-forget)
    if (marketingOptIn && resolvedGuest?.email) {
      subscribeToKlaviyoList({
        email: resolvedGuest.email,
        phone: resolvedGuest.phone || undefined,
        firstName: resolvedGuest.firstName || undefined,
        lastName: resolvedGuest.lastName || undefined,
      }).catch((err) => console.error("[Klaviyo] Subscribe error:", err));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[Reservation] Error:",
      error instanceof Error ? error.message : error
    );
    if (error instanceof ReservationPendingRecoveryError) {
      return NextResponse.json(
        {
          error: error.message,
          pendingRecovery: true,
        },
        { status: 202 }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create reservation",
      },
      { status: 500 }
    );
  }
}
