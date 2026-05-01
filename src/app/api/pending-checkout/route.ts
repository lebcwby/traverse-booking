import { NextRequest, NextResponse } from "next/server";
import {
  getPendingCheckout,
  upsertPendingCheckout,
} from "@/lib/pending-checkouts";
import {
  createPendingCheckoutLookupToken,
  verifyPendingCheckoutLookupToken,
} from "@/lib/pending-checkout-token";

export async function GET(request: NextRequest) {
  const paymentIntentId = request.nextUrl.searchParams.get("paymentIntentId");
  const token = request.nextUrl.searchParams.get("token");
  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "paymentIntentId is required" },
      { status: 400 }
    );
  }
  if (!token || !verifyPendingCheckoutLookupToken(token, paymentIntentId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await getPendingCheckout(paymentIntentId);
    if (!pending) {
      return NextResponse.json(
        { error: "Pending checkout not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      paymentIntentId: pending.paymentIntentId,
      quoteId: pending.quoteId,
      ratePlanId: pending.ratePlanId,
      guest: pending.guest,
      tracking: pending.tracking,
      upsells: pending.upsells,
      pets: pending.pets,
      status: pending.status,
      reservationId: pending.reservationId,
      lastError: pending.lastError,
      completedAt: pending.completedAt,
    });
  } catch (error) {
    console.error("[Pending Checkout] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load pending checkout" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, quoteId, guest, tracking } = body;
    if (!paymentIntentId || !quoteId || !guest || !tracking) {
      return NextResponse.json(
        { error: "paymentIntentId, quoteId, guest, and tracking are required" },
        { status: 400 }
      );
    }

    await upsertPendingCheckout({
      paymentIntentId,
      quoteId,
      ratePlanId: body.ratePlanId || null,
      stripeCustomerId: body.stripeCustomerId || null,
      guest,
      tracking,
      upsells: Array.isArray(body.upsells) ? body.upsells : [],
      pets: typeof body.pets === "number" ? body.pets : 0,
      quoteSnapshot: body.quoteSnapshot || null,
    }).catch((err) => {
      console.warn("[Pending Checkout] DB write failed (non-critical):", err.message);
    });

    return NextResponse.json({
      ok: true,
      lookupToken: createPendingCheckoutLookupToken(paymentIntentId),
    });
  } catch (error) {
    console.error("[Pending Checkout] POST error:", error);
    // Still return success — the booking can proceed without persistence
    return NextResponse.json({
      ok: true,
      lookupToken: "fallback",
    });
  }
}
