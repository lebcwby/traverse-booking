import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/guesty-beapi";
import { buildNormalizedQuoteResponse } from "@/lib/quote-response";
import { getListing } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const q = await getQuote(quoteId);
    const listing = await getListing(q.unitTypeId).catch(() => null);
    return NextResponse.json(buildNormalizedQuoteResponse(q, listing));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch quote",
      },
      { status: 500 }
    );
  }
}
