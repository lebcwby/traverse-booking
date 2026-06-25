import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { buildStripeIdempotencyKey, getStripeServer } from "@/lib/stripe";
import { sendAlert } from "@/lib/alerts";
import { getQuote, getListingDetail } from "@/lib/guesty-beapi";
import { getUpsellTotal, resolvePetFeePerPet } from "@/lib/upsells";
import {
  findBlockingPendingCheckout,
  findLatestReusablePendingCheckout,
  getPendingCheckout,
  upsertPendingCheckout,
  type TrackingContext,
} from "@/lib/pending-checkouts";
import { getListingWithBeapiFallback } from "@/lib/listing-utils";
import {
  normalizeGuestEmail,
  normalizeGuestPhone,
} from "@/lib/booking-identity";
import {
  createPendingCheckoutLookupToken,
  verifyPendingCheckoutLookupToken,
} from "@/lib/pending-checkout-token";

const GA_SESSION_COOKIE = "_ga_PPWFFFPC42";

// Snapshot the cookies + request context that Meta CAPI / Google Ads server
// uploads need (fbp, fbc, attribution, IP, UA, etc.) into the pending_checkouts
// row. Stripe webhooks fire server-to-server with no user cookies, so without
// this snapshot they'd send Purchase events with empty user context.
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

function buildPaymentIntentMetadata(args: {
  quoteId: string;
  guestEmail?: string;
  guestPhone?: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  baseAmountCents: number;
  upsellIds: string[];
  pets: number;
  petFeeAmountCents: number;
  petFeePerPet: number;
}) {
  const metadata: Record<string, string> = {
    quoteId: args.quoteId,
    listingId: args.listingId,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    baseAmountCents: String(args.baseAmountCents),
    upsellIds: args.upsellIds.join(","),
    pets: String(args.pets),
    petFeeAmountCents: String(args.petFeeAmountCents),
    // Per-listing per-pet rate from Guesty BEAPI (or default fallback).
    // checkout-finalizer reads this so the Guesty invoice item created
    // post-payment matches the amount Stripe charged.
    petFeePerPet: String(args.petFeePerPet),
  };

  if (args.guestEmail) {
    metadata.guestEmail = args.guestEmail;
  }
  if (args.guestPhone) {
    metadata.guestPhone = args.guestPhone;
  }

  return metadata;
}

function getPaymentIntentCustomerId(paymentIntent: {
  customer?: string | { id?: string | null } | null;
}) {
  if (typeof paymentIntent.customer === "string") {
    return paymentIntent.customer;
  }
  return paymentIntent.customer?.id || null;
}

function getMetadataUpsellIds(rawUpsellIds?: string) {
  return (rawUpsellIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function resolveStripeCustomerId(args: {
  existingCustomerId?: string | null;
  guestEmail?: string;
  guestPhone?: string;
  quoteId: string;
}) {
  if (args.existingCustomerId) {
    return args.existingCustomerId;
  }

  const guestEmail = normalizeGuestEmail(args.guestEmail);
  if (!guestEmail) {
    return null;
  }

  const guestPhone = normalizeGuestPhone(args.guestPhone);
  const stripe = getStripeServer();
  const existing = await stripe.customers.list({
    email: guestEmail,
    limit: 1,
  });
  if (existing.data[0]?.id) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: guestEmail,
    ...(guestPhone ? { phone: guestPhone } : {}),
    metadata: { quoteId: args.quoteId, source: "book-traverse" },
  });
  return customer.id;
}

function normalizePetsValue(pets: unknown) {
  return typeof pets === "number" && pets > 0 ? pets : 0;
}

function isValidCheckoutToken(paymentIntentId: string, token: unknown) {
  return (
    typeof token === "string" &&
    verifyPendingCheckoutLookupToken(token, paymentIntentId)
  );
}

function getNextAmountCents(args: {
  baseAmountCents: number;
  upsellIds: string[];
  pets: number;
  petFeePerPet: number;
}) {
  const upsellAmount = getUpsellTotal(
    args.upsellIds.filter((id) => id !== "pet-fee")
  );
  const petFeeAmount = args.pets > 0 ? args.pets * args.petFeePerPet : 0;
  return {
    amountCents:
      args.baseAmountCents + Math.round((upsellAmount + petFeeAmount) * 100),
    chargeableUpsellIds: args.upsellIds.filter((id) => id !== "pet-fee"),
    petFeeAmountCents: Math.round(petFeeAmount * 100),
  };
}

/**
 * Pulls the listing's per-pet fee from Guesty BEAPI so checkout amounts
 * match each listing's configured `prices.petFee`. Falls back to the
 * account-fee default when Guesty hasn't set one (or returns zero).
 */
async function resolvePetFeePerPetForListing(
  listingId: string | undefined | null
): Promise<number> {
  if (!listingId) return resolvePetFeePerPet(null);
  try {
    const detail = (await getListingDetail(listingId)) as {
      prices?: { petFee?: number | null } | null;
    };
    return resolvePetFeePerPet(detail?.prices?.petFee ?? null);
  } catch {
    return resolvePetFeePerPet(null);
  }
}

/**
 * Stripe-source-of-truth double-charge guard. Returns an existing SUCCEEDED,
 * un-refunded PaymentIntent for the same stay (listing + check-in + check-out),
 * or null. Used to block handing the client a fresh chargeable PI when the stay
 * is already paid — the gap that double-charged GY-CvXxRDxw (2026-05-31): the
 * pending_checkouts-based guard missed an orphan charge (charge succeeded but
 * finalize failed, so no/erased pending row), and the retry minted a new
 * quote → new PI → second charge. Stripe Search is eventually consistent
 * (~seconds–1min); the retry that hurt us was minutes later, well past indexing.
 */
async function findSucceededPaymentIntentForStay(
  stripe: ReturnType<typeof getStripeServer>,
  stay: { listingId: string; checkIn: string; checkOut: string }
): Promise<Stripe.PaymentIntent | null> {
  const { listingId, checkIn, checkOut } = stay;
  if (!listingId || !checkIn || !checkOut) return null;
  // Stay fields are listing ids / formatted dates — no single quotes — so they
  // embed safely in the Search query string.
  const query =
    `status:'succeeded'` +
    ` AND metadata['listingId']:'${listingId}'` +
    ` AND metadata['checkIn']:'${checkIn}'` +
    ` AND metadata['checkOut']:'${checkOut}'`;
  const result = await stripe.paymentIntents.search({
    query,
    limit: 10,
    expand: ["data.latest_charge"],
  });
  for (const pi of result.data) {
    // Only block on an ORPHAN charge — succeeded but with NO confirmation code,
    // i.e. no reservation exists yet (charge orphaned, or mid-finalize). A PI
    // that already has a confirmationCode is either (a) an active booking — in
    // which case the dates are unavailable and the guest can't even quote them
    // here — or (b) a CANCELLED booking, where the dates are freed and a new
    // guest must be allowed to re-book (esp. non-refundable last-minute cancels,
    // whose charge is succeeded + un-refunded). Skipping coded PIs avoids
    // false-blocking those legitimate re-bookings.
    if (pi.metadata?.confirmationCode) continue;
    const charge = pi.latest_charge;
    // A fully-refunded orphan frees the stay to be re-booked — skip it.
    if (charge && typeof charge !== "string") {
      const fullyRefunded =
        charge.refunded ||
        (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
      if (fullyRefunded) continue;
    }
    return pi;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let body: { quoteId?: string; upsellIds?: string[]; pets?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { quoteId, upsellIds, pets } = body;
    const trackingContext = extractTrackingContext(request);

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    // Fetch quote server-side to get the authoritative total — never trust client amount
    const quote = await getQuote(quoteId);
    const ratePlan = quote?.rates?.ratePlans?.[0]?.ratePlan;
    const hostPayout = ratePlan?.money?.hostPayout;
    const listingId = quote?.unitTypeId as string;
    const checkIn = quote.checkInDateLocalized || "";
    const checkOut = quote.checkOutDateLocalized || "";
    const listing = listingId
      ? await getListingWithBeapiFallback(listingId)
      : null;
    const blockingPending = await findBlockingPendingCheckout({
      quoteId,
      listingId,
      checkIn,
      checkOut,
    }).catch(() => null);
    const existingPending = await findLatestReusablePendingCheckout({
      quoteId,
      listingId,
      checkIn,
      checkOut,
    }).catch(() => null);

    if (typeof hostPayout !== "number" || hostPayout <= 0) {
      console.error(
        "[PaymentIntent] Invalid hostPayout from quote:",
        JSON.stringify(quote?.rates?.ratePlans?.[0]?.ratePlan?.money).slice(
          0,
          300
        )
      );
      return NextResponse.json(
        { error: "Could not determine payment amount from quote" },
        { status: 400 }
      );
    }

    if (blockingPending) {
      return NextResponse.json(
        {
          error:
            "A payment for this booking was already received and your reservation is still being finalized. Please do not retry. Our team has been notified.",
          pendingRecovery: true,
          pendingPaymentIntentId: blockingPending.paymentIntentId,
        },
        { status: 409 }
      );
    }

    const petFeePerPet = await resolvePetFeePerPetForListing(listingId);
    const upsellAmount = Array.isArray(upsellIds)
      ? getUpsellTotal(upsellIds.filter((id: string) => id !== "pet-fee"))
      : 0;
    const petFeeAmount =
      typeof pets === "number" && pets > 0 ? pets * petFeePerPet : 0;
    const totalAmount = hostPayout + upsellAmount + petFeeAmount;
    const totalAmountCents = Math.round(totalAmount * 100);

    const stripe = getStripeServer();

    // ─── Double-charge prevention (Stripe source of truth) ──────────
    // findBlockingPendingCheckout (above) catches the already-paid case via our
    // pending_checkouts table — but that table can be missing/cleaned for an
    // orphan charge (charge succeeded, finalize failed). Ask Stripe directly: if
    // this stay already has a succeeded, un-refunded PaymentIntent, do NOT hand
    // the client a fresh chargeable PI. Reuses the existing `pendingRecovery`
    // 409 shape, which the checkout UI already renders (no clientSecret → the
    // guest can't confirm a second charge). Guard failures never block a booking.
    try {
      const alreadyPaid = await findSucceededPaymentIntentForStay(stripe, {
        listingId,
        checkIn,
        checkOut,
      });
      if (alreadyPaid) {
        await sendAlert(
          "BLOCKED DOUBLE-CHARGE ATTEMPT",
          `A new payment was requested for a stay that already has a paid, un-refunded charge — the second charge was blocked before creation.<br><br>Listing <code>${listingId}</code>, ${checkIn} → ${checkOut}.<br>Existing PaymentIntent: <code>${alreadyPaid.id}</code> ($${(
            (alreadyPaid.amount ?? 0) / 100
          ).toFixed(2)}, confirmation ${
            alreadyPaid.metadata?.confirmationCode ||
            "(none — orphan charge; may need recovery or refund)"
          }).`,
          `blocked-double-charge-${listingId}-${checkIn}-${checkOut}`
        ).catch(() => {});
        return NextResponse.json(
          {
            error:
              "A payment for this stay has already been received. Please don't pay again — call us at (970) 759-2013 and our team will confirm your reservation.",
            pendingRecovery: true,
            pendingPaymentIntentId: alreadyPaid.id,
          },
          { status: 409 }
        );
      }
    } catch (err) {
      // The guard must never block a legitimate booking on its own failure.
      console.error("[PaymentIntent] double-charge guard error:", err);
    }

    const metadata = buildPaymentIntentMetadata({
      quoteId,
      listingId,
      checkIn,
      checkOut,
      baseAmountCents: Math.round(hostPayout * 100),
      upsellIds: Array.isArray(upsellIds) ? upsellIds : [],
      pets: normalizePetsValue(pets),
      petFeeAmountCents: Math.round(petFeeAmount * 100),
      petFeePerPet,
    });

    if (existingPending?.paymentIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(
          existingPending.paymentIntentId
        );
        if (
          existingIntent.status === "requires_payment_method" ||
          existingIntent.status === "requires_confirmation"
        ) {
          const existingCustomerId =
            getPaymentIntentCustomerId(existingIntent) ||
            existingPending.stripeCustomerId ||
            null;
          const updatedIntent = await stripe.paymentIntents.update(
            existingPending.paymentIntentId,
            {
              amount: totalAmountCents,
              ...(existingCustomerId ? { customer: existingCustomerId } : {}),
              metadata: {
                ...existingIntent.metadata,
                ...metadata,
              },
            }
          );

          await upsertPendingCheckout({
            paymentIntentId: updatedIntent.id,
            quoteId,
            ratePlanId: ratePlan?._id || null,
            stripeCustomerId: existingCustomerId,
            guest: {
              firstName: existingPending.guest.firstName || "",
              lastName: existingPending.guest.lastName || "",
              email: existingPending.guest.email || "",
              phone: existingPending.guest.phone || "",
            },
            tracking: {
              listingId,
              listingTitle:
                listing?.title ||
                listing?.nickname ||
                existingPending.tracking.listingTitle ||
                "",
              listingNickname:
                listing?.nickname ||
                existingPending.tracking.listingNickname ||
                null,
              picture:
                listing?.picture ||
                listing?.pictures?.[0] ||
                existingPending.tracking.picture ||
                null,
              propertyType:
                listing?.property_type ||
                existingPending.tracking.propertyType ||
                null,
              city:
                listing?.address?.city || existingPending.tracking.city || null,
              checkIn,
              checkOut,
              guests: Number(
                quote.guestsCount || existingPending.tracking.guests || 0
              ),
              stayTotal: hostPayout,
              totalPaid: totalAmount,
            },
            upsells: Array.isArray(upsellIds)
              ? upsellIds.filter((id: string) => id !== "pet-fee")
              : [],
            pets: typeof pets === "number" ? pets : 0,
            quoteSnapshot: {
              quoteId,
              ratePlanId: ratePlan?._id || null,
              listingId,
              checkIn,
              checkOut,
              guests: quote.guestsCount,
              stayTotal: hostPayout,
              totalPaid: totalAmount,
            },
            trackingContext,
          }).catch((err) =>
            console.warn(
              "[PaymentIntent] Failed to refresh pending checkout:",
              err instanceof Error ? err.message : err
            )
          );

          return NextResponse.json({
            clientSecret: updatedIntent.client_secret,
            paymentIntentId: updatedIntent.id,
            checkoutToken: createPendingCheckoutLookupToken(updatedIntent.id),
            stripeCustomerId: existingCustomerId,
          });
        }
      } catch (error) {
        console.warn(
          "[PaymentIntent] Failed to reuse existing PI:",
          error instanceof Error ? error.message : error
        );
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmountCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata,
      },
      {
        idempotencyKey: buildStripeIdempotencyKey("payment_intent_create", {
          quoteId,
          listingId,
          checkIn,
          checkOut,
          totalAmountCents,
          upsellIds: Array.isArray(upsellIds)
            ? upsellIds.filter((id: string) => id !== "pet-fee")
            : [],
          pets: normalizePetsValue(pets),
        }),
      }
    );

    await upsertPendingCheckout({
      paymentIntentId: paymentIntent.id,
      quoteId,
      ratePlanId: ratePlan?._id || null,
      stripeCustomerId: null,
      guest: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
      tracking: {
        listingId,
        listingTitle: listing?.title || listing?.nickname || "",
        listingNickname: listing?.nickname || null,
        picture: listing?.picture || listing?.pictures?.[0] || null,
        propertyType: listing?.property_type || null,
        city: listing?.address?.city || null,
        checkIn,
        checkOut,
        guests: Number(quote.guestsCount || 0),
        stayTotal: hostPayout,
        totalPaid: totalAmount,
      },
      upsells: Array.isArray(upsellIds)
        ? upsellIds.filter((id: string) => id !== "pet-fee")
        : [],
      pets: typeof pets === "number" ? pets : 0,
      quoteSnapshot: {
        quoteId,
        ratePlanId: ratePlan?._id || null,
        listingId,
        checkIn,
        checkOut,
        guests: quote.guestsCount,
        stayTotal: hostPayout,
        totalPaid: totalAmount,
      },
      trackingContext,
    }).catch((err) =>
      console.warn(
        "[PaymentIntent] Failed to save pending checkout:",
        err instanceof Error ? err.message : err
      )
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      checkoutToken: createPendingCheckoutLookupToken(paymentIntent.id),
      stripeCustomerId: null,
    });
  } catch (error) {
    console.error("[PaymentIntent] Error:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const trackingContext = extractTrackingContext(request);
    const {
      paymentIntentId,
      checkoutToken,
      upsellIds,
      pets,
      guestEmail,
      guestPhone,
    } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }
    if (!isValidCheckoutToken(paymentIntentId, checkoutToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const existingPending = await getPendingCheckout(paymentIntentId).catch(
      () => null
    );

    if (
      paymentIntent.status !== "requires_payment_method" &&
      paymentIntent.status !== "requires_confirmation"
    ) {
      return NextResponse.json(
        { error: "Payment intent cannot be updated in its current state" },
        { status: 400 }
      );
    }

    const normalizedGuestEmail = normalizeGuestEmail(guestEmail);
    const normalizedGuestPhone = normalizeGuestPhone(guestPhone);
    const shouldUpdateAmount =
      Object.prototype.hasOwnProperty.call(body, "upsellIds") ||
      Object.prototype.hasOwnProperty.call(body, "pets");
    const baseAmountCents = Number.parseInt(
      paymentIntent.metadata.baseAmountCents || "0",
      10
    );
    if (shouldUpdateAmount && !baseAmountCents) {
      return NextResponse.json(
        { error: "Payment intent missing base amount" },
        { status: 400 }
      );
    }

    const nextUpsellIds = Array.isArray(upsellIds)
      ? upsellIds
      : getMetadataUpsellIds(paymentIntent.metadata.upsellIds);
    const nextPets = Object.prototype.hasOwnProperty.call(body, "pets")
      ? normalizePetsValue(pets)
      : normalizePetsValue(
          Number.parseInt(paymentIntent.metadata.pets || "0", 10)
        );
    const nextPetFeePerPet = await resolvePetFeePerPetForListing(
      paymentIntent.metadata.listingId
    );
    const nextAmount = getNextAmountCents({
      baseAmountCents,
      upsellIds: nextUpsellIds,
      pets: nextPets,
      petFeePerPet: nextPetFeePerPet,
    });
    const stripeCustomerId = await resolveStripeCustomerId({
      existingCustomerId:
        getPaymentIntentCustomerId(paymentIntent) ||
        existingPending?.stripeCustomerId ||
        null,
      guestEmail: normalizedGuestEmail,
      guestPhone: normalizedGuestPhone,
      quoteId: paymentIntent.metadata.quoteId || existingPending?.quoteId || "",
    });

    const paymentIntentUpdates: Parameters<
      typeof stripe.paymentIntents.update
    >[1] = {};
    const metadataUpdates: Record<string, string> = {};

    if (shouldUpdateAmount) {
      paymentIntentUpdates.amount = nextAmount.amountCents;
      metadataUpdates.upsellIds = nextUpsellIds.join(",");
      metadataUpdates.pets = String(nextPets);
      metadataUpdates.petFeeAmountCents = String(nextAmount.petFeeAmountCents);
      metadataUpdates.petFeePerPet = String(nextPetFeePerPet);
    }

    if (normalizedGuestEmail) {
      paymentIntentUpdates.receipt_email = normalizedGuestEmail;
      metadataUpdates.guestEmail = normalizedGuestEmail;
    }
    if (normalizedGuestPhone) {
      metadataUpdates.guestPhone = normalizedGuestPhone;
    }
    if (
      stripeCustomerId &&
      stripeCustomerId !== getPaymentIntentCustomerId(paymentIntent)
    ) {
      paymentIntentUpdates.customer = stripeCustomerId;
    }
    if (Object.keys(metadataUpdates).length > 0) {
      paymentIntentUpdates.metadata = metadataUpdates;
    }

    if (Object.keys(paymentIntentUpdates).length > 0) {
      await stripe.paymentIntents.update(paymentIntentId, paymentIntentUpdates);
    }

    await upsertPendingCheckout({
      paymentIntentId,
      quoteId: paymentIntent.metadata.quoteId,
      ratePlanId: existingPending?.ratePlanId || null,
      stripeCustomerId,
      guest: {
        firstName: existingPending?.guest.firstName || "",
        lastName: existingPending?.guest.lastName || "",
        email:
          normalizedGuestEmail ||
          existingPending?.guest.email ||
          paymentIntent.metadata.guestEmail ||
          "",
        phone:
          normalizedGuestPhone ||
          existingPending?.guest.phone ||
          paymentIntent.metadata.guestPhone ||
          "",
      },
      tracking: {
        ...(existingPending?.tracking || {}),
        listingId:
          existingPending?.tracking?.listingId ||
          paymentIntent.metadata.listingId ||
          "",
        listingTitle: existingPending?.tracking?.listingTitle || "",
        checkIn:
          existingPending?.tracking?.checkIn ||
          paymentIntent.metadata.checkIn ||
          "",
        checkOut:
          existingPending?.tracking?.checkOut ||
          paymentIntent.metadata.checkOut ||
          "",
        guests: existingPending?.tracking?.guests || 0,
        stayTotal:
          baseAmountCents > 0
            ? baseAmountCents / 100
            : existingPending?.tracking?.stayTotal,
        totalPaid: shouldUpdateAmount
          ? nextAmount.amountCents / 100
          : existingPending?.tracking?.totalPaid || paymentIntent.amount / 100,
      },
      upsells: nextAmount.chargeableUpsellIds,
      pets: nextPets,
      trackingContext,
    }).catch((err) =>
      console.warn(
        "[PaymentIntent] Failed to update pending checkout:",
        err instanceof Error ? err.message : err
      )
    );

    return NextResponse.json({
      amount: shouldUpdateAmount
        ? nextAmount.amountCents / 100
        : existingPending?.tracking?.totalPaid || paymentIntent.amount / 100,
      stripeCustomerId,
    });
  } catch (error) {
    console.error("[PaymentIntent] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update payment intent" },
      { status: 500 }
    );
  }
}
