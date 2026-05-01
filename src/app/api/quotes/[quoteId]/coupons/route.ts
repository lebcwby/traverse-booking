import { NextRequest, NextResponse } from "next/server";
import { addCouponToQuote, getQuote } from "@/lib/guesty-beapi";
import { buildNormalizedQuoteResponse } from "@/lib/quote-response";
import { getListing } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const body = await request.json();
    const { coupon } = body;

    if (!coupon) {
      return NextResponse.json(
        { error: "coupon is required" },
        { status: 400 }
      );
    }

    await addCouponToQuote(quoteId, coupon);
    const quote = await getQuote(quoteId);
    const listing = await getListing(quote.unitTypeId).catch(() => null);
    return NextResponse.json(buildNormalizedQuoteResponse(quote, listing));
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    console.error("[Quote Coupon] Error:", raw || error);
    // Extract the Guesty error code if present
    const match = raw.match(/"code"\s*:\s*"([^"]+)"/);
    const code = match?.[1];

    let message = "Failed to apply coupon. Please try again.";
    let status = 500;

    if (code === "INVALID_COUPON" || raw.includes("400")) {
      message = "This coupon code is invalid or doesn't apply to this booking.";
      status = 400;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
