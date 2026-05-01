import { NextRequest, NextResponse } from "next/server";
import { getPayoutSchedule } from "@/lib/guesty-beapi";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const listingId = searchParams.get("listingId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const total = searchParams.get("total");

  if (!listingId || !checkIn || !checkOut || !total) {
    return NextResponse.json(
      { error: "listingId, checkIn, checkOut, and total are required" },
      { status: 400 }
    );
  }

  try {
    const data = await getPayoutSchedule({
      listingId,
      checkIn,
      checkOut,
      total: Number(total),
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch payout schedule",
      },
      { status: 500 }
    );
  }
}
