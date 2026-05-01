import { NextRequest, NextResponse } from "next/server";
import { createQuote } from "@/lib/guesty-beapi";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, checkIn, checkOut, guestsCount, coupons, pointofsale } =
      body;

    if (!listingId || !checkIn || !checkOut || !guestsCount) {
      return NextResponse.json(
        { error: "listingId, checkIn, checkOut, and guestsCount are required" },
        { status: 400 }
      );
    }

    const data = await createQuote({
      listingId,
      checkIn,
      checkOut,
      guestsCount,
      coupons,
      pointofsale,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "[Quotes] Error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
