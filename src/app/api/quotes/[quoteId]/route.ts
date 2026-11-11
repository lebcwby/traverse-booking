import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/guesty-beapi";
import { buildNormalizedQuoteResponse } from "@/lib/quote-response";
import { getListingWithBeapiFallback } from "@/lib/listing-utils";
import { readCachedListingDetail } from "@/lib/listing-detail-cache";
import { classifyBeapiError } from "@/lib/beapi-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const q = await getQuote(quoteId);
    // Both reads are independent of each other; the cache read is Postgres-only
    // and never calls Guesty, so it adds no load to the rate limit.
    const [listing, detail] = await Promise.all([
      getListingWithBeapiFallback(q.unitTypeId),
      readCachedListingDetail(String(q.unitTypeId || "")),
    ]);
    return NextResponse.json(
      buildNormalizedQuoteResponse(q, listing, detail?.taxes)
    );
  } catch (error) {
    // Raw BEAPI error stays in server logs only — never returned to the
    // browser (would leak field names like `unitTypeId` and Mongo ids).
    console.error("[QuotesGet] Error:", error);

    const classified = classifyBeapiError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.status }
    );
  }
}
