import { NextRequest, NextResponse } from "next/server";
import { getListingPaymentProvider } from "@/lib/guesty-beapi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getListingPaymentProvider(id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch payment provider",
      },
      { status: 500 }
    );
  }
}
