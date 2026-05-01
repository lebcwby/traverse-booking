import { NextRequest, NextResponse } from "next/server";
import { getListingDetail } from "@/lib/guesty-beapi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getListingDetail(id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch listing",
      },
      { status: 500 }
    );
  }
}
