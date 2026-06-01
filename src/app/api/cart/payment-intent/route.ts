// Multi-listing cart Stripe PaymentIntent endpoint. Mirrors the single-flow
// /api/payment-intent route but:
//  - Accepts an array of cart lines (max 5) and creates ONE PI for the
//    combined hostPayout total.
//  - Server re-fetches every quote in parallel for authoritative pricing.
//  - Writes a `pending_cart_checkouts` row with per-line snapshots so the
//    coordinator can walk each reservation forward independently.
//  - Idempotency keyed on sorted quote IDs + guest email so a 3DS retry
//    doesn't spawn a second PI for the same cart.

import { NextRequest, NextResponse } from "next/server";
import { buildStripeIdempotencyKey, getStripeServer } from "@/lib/stripe";
import { getQuote } from "@/lib/guesty-beapi";
import { getListing } from "@/lib/supabase";
import {
  upsertPendingCartCheckout,
  type CartLine,
} from "@/lib/cart/pending-cart-checkouts";
import {
  normalizeGuestEmail,
  normalizeGuestPhone,
} from "@/lib/booking-identity";
import type { TrackingContext } from "@/lib/pending-checkouts";

const GA_SESSION_COOKIE = "_ga_PPWFFFPC42";

/** Hard cap from Phase 2 plan: sequential reservations risk the 60s
 * Vercel function limit beyond this. UI also enforces this. */
const MAX_CART_LINES = 5;

interface CartLineInput {
  lineId: string;
  quoteId: string;
  /** Cart item snapshot — informational; server re-fetches the quote for
   * authoritative pricing. */
  pets?: number;
}

interface CartPaymentIntentRequest {
  lines: CartLineInput[];
  guest?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

function extractTrackingContext(request: NextRequest): TrackingContext {
  return {
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
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: CartPaymentIntentRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) {
      return NextResponse.json(
        { error: "lines is required and must contain at least one cart item" },
        { status: 400 }
      );
    }
    if (lines.length > MAX_CART_LINES) {
      return NextResponse.json(
        {
          error: `Cart is limited to ${MAX_CART_LINES} stays. Please remove items and try again.`,
        },
        { status: 400 }
      );
    }
    for (const line of lines) {
      if (!line.lineId || !line.quoteId) {
        return NextResponse.json(
          { error: "Each line must include lineId and quoteId" },
          { status: 400 }
        );
      }
    }

    // 1. Re-fetch every quote in parallel for authoritative pricing.
    //    Per-line errors short-circuit the whole PI creation — we never
    //    charge a partial cart.
    const quoteResults = await Promise.all(
      lines.map(async (line) => {
        try {
          const quote = await getQuote(line.quoteId);
          return { line, quote, error: null as string | null };
        } catch (e) {
          return {
            line,
            quote: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );

    const lineErrors = quoteResults
      .map((r, i) =>
        r.error
          ? { lineId: r.line.lineId, index: i, error: r.error }
          : null
      )
      .filter(Boolean);
    if (lineErrors.length > 0) {
      return NextResponse.json(
        {
          error: "One or more cart lines could not be quoted",
          lineErrors,
        },
        { status: 400 }
      );
    }

    // 2. Build CartLine snapshots + sum the total.
    const cartLines: CartLine[] = [];
    let totalAmount = 0;
    for (const { line, quote } of quoteResults) {
      const ratePlan = quote?.rates?.ratePlans?.[0]?.ratePlan;
      const hostPayout = ratePlan?.money?.hostPayout;
      if (typeof hostPayout !== "number" || hostPayout <= 0) {
        return NextResponse.json(
          {
            error: `Could not determine payment amount for line ${line.lineId}`,
          },
          { status: 400 }
        );
      }
      const listingId = quote?.unitTypeId as string;
      const listing = listingId
        ? await getListing(listingId).catch(() => null)
        : null;

      cartLines.push({
        lineId: line.lineId,
        quoteId: (quote?._id as string) || line.quoteId,
        ratePlanId: (ratePlan?._id as string) || null,
        listingId,
        listingTitle:
          listing?.title || listing?.nickname || "Colorado rental",
        listingPicture:
          listing?.picture || listing?.pictures?.[0] || null,
        listingCity: listing?.address?.city || null,
        checkIn: (quote?.checkInDateLocalized as string) || "",
        checkOut: (quote?.checkOutDateLocalized as string) || "",
        guests: Number(quote?.guestsCount || 0),
        pets:
          typeof line.pets === "number" && line.pets > 0 ? line.pets : 0,
        hostPayout,
        status: "pending",
        reservationId: null,
        errorMessage: null,
        refundAmount: null,
      });
      totalAmount += hostPayout;
    }

    const totalAmountCents = Math.round(totalAmount * 100);
    const stripe = getStripeServer();

    // 3. Idempotency key from sorted quote IDs (stable across retries).
    const sortedQuoteIds = cartLines.map((l) => l.quoteId).sort();
    const guestEmail = normalizeGuestEmail(body.guest?.email);
    const guestPhone = normalizeGuestPhone(body.guest?.phone);
    const idempotencyKey = buildStripeIdempotencyKey("cart-pi", {
      quoteIds: sortedQuoteIds,
      email: guestEmail || "",
    });

    // 4. Resolve / create Stripe customer if guest email provided.
    let stripeCustomerId: string | null = null;
    if (guestEmail) {
      const existing = await stripe.customers.list({
        email: guestEmail,
        limit: 1,
      });
      if (existing.data[0]?.id) {
        stripeCustomerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: guestEmail,
          ...(guestPhone ? { phone: guestPhone } : {}),
          metadata: { source: "traverse-cart" },
        });
        stripeCustomerId = customer.id;
      }
    }

    // 5. Create the combined PI.
    const metadata: Record<string, string> = {
      cartCheckout: "true",
      lineCount: String(cartLines.length),
      lineQuoteIds: sortedQuoteIds.join(","),
      lineListingIds: cartLines.map((l) => l.listingId).sort().join(","),
      totalAmountCents: String(totalAmountCents),
    };
    if (guestEmail) metadata.guestEmail = guestEmail;
    if (guestPhone) metadata.guestPhone = guestPhone;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountCents,
        currency: "usd",
        ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
        ...(guestEmail ? { receipt_email: guestEmail } : {}),
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      { idempotencyKey }
    );

    // 6. Persist the cart row. Returns the cart_id (uuid) which the client
    //    uses for the /cart/confirmation/[cartId] redirect.
    const { cartId } = await upsertPendingCartCheckout({
      paymentIntentId: paymentIntent.id,
      guest: {
        firstName: body.guest?.firstName || "",
        lastName: body.guest?.lastName || "",
        email: guestEmail || "",
        phone: guestPhone || "",
      },
      lines: cartLines,
      totalPaid: totalAmount,
      trackingContext: extractTrackingContext(request),
      stripeCustomerId,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      cartId,
      stripeCustomerId,
      totalAmount,
      lines: cartLines.map((l) => ({
        lineId: l.lineId,
        listingId: l.listingId,
        listingTitle: l.listingTitle,
        hostPayout: l.hostPayout,
      })),
    });
  } catch (error) {
    console.error(
      "[CartPaymentIntent] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create cart payment intent",
      },
      { status: 500 }
    );
  }
}

/** PATCH for guest details / marketing-opt-in updates after the form is
 * filled in. Mirrors the single-flow PI PATCH pattern. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, guest, marketingOptIn } = body as {
      paymentIntentId?: string;
      guest?: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
      };
      marketingOptIn?: boolean;
    };
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }
    const stripe = getStripeServer();
    const guestEmail = normalizeGuestEmail(guest?.email);
    const guestPhone = normalizeGuestPhone(guest?.phone);

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const updatedMetadata: Record<string, string> = {
      ...intent.metadata,
    };
    if (guestEmail) updatedMetadata.guestEmail = guestEmail;
    if (guestPhone) updatedMetadata.guestPhone = guestPhone;
    if (typeof marketingOptIn === "boolean") {
      updatedMetadata.marketingOptIn = String(marketingOptIn);
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      ...(guestEmail ? { receipt_email: guestEmail } : {}),
      metadata: updatedMetadata,
    });

    // Mirror to the durable cart row so the coordinator picks up the latest
    // guest fields when finalizing.
    if (guest) {
      const { getPendingCartCheckoutByPaymentIntent, upsertPendingCartCheckout } =
        await import("@/lib/cart/pending-cart-checkouts");
      const existing =
        await getPendingCartCheckoutByPaymentIntent(paymentIntentId);
      if (existing) {
        await upsertPendingCartCheckout({
          paymentIntentId,
          guest: {
            firstName: guest.firstName || existing.guest.firstName || "",
            lastName: guest.lastName || existing.guest.lastName || "",
            email: guestEmail || existing.guest.email || "",
            phone: guestPhone || existing.guest.phone || "",
          },
          lines: existing.lines,
          totalPaid: existing.totalPaid,
          couponCode: existing.couponCode,
          trackingContext: existing.trackingContext,
          marketingOptIn:
            typeof marketingOptIn === "boolean"
              ? marketingOptIn
              : existing.marketingOptIn,
          stripeCustomerId: existing.stripeCustomerId,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "[CartPaymentIntent PATCH] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update cart payment intent",
      },
      { status: 500 }
    );
  }
}
