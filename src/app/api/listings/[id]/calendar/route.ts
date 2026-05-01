import { NextRequest, NextResponse } from "next/server";
import { getListingCalendar } from "@/lib/guesty-beapi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query parameters are required" },
      { status: 400 }
    );
  }

  try {
    const data = await getListingCalendar(id, from, to);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch calendar",
      },
      { status: 500 }
    );
  }
}
