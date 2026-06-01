import { NextRequest, NextResponse } from "next/server";
import { createQuote } from "@/lib/guesty-beapi";
import { classifyBeapiError } from "@/lib/beapi-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, checkIn, checkOut, guestsCount, coupons, pointofsale } =
      body;

    if (!listingId || !checkIn || !checkOut || !guestsCount) {
      return NextResponse.json(
        {
          error: "listingId, checkIn, checkOut, and guestsCount are required",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    const data = await createQuote({
      listingId,
      checkIn,
      checkOut,
      guestsCount,
      coupons,
      // Note: BEAPI's `pointofsale` only accepts the values [google, findrentals]
      // for specific Guesty integrations — it is NOT for tagging direct-booking
      // channels. Channel commissions for the Website manual channel are
      // configured in Guesty itself and applied per the BEAPI account's default
      // channel mapping. Forwarding only when an integration explicitly sets it.
      pointofsale,
    });

    return NextResponse.json(data);
  } catch (error) {
    // Keep the raw BEAPI error in server logs (and Sentry, if wired). The
    // client only ever sees the classified, sanitized response — no raw
    // internal field names or Guesty-internal codes leak.
    console.error("[Quotes] Error:", error);

    const classified = classifyBeapiError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.status }
    );
  }
}
