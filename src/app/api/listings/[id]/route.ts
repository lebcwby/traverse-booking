/**
 * GET /api/listings/{id} — raw BEAPI listing detail.
 *
 * ⚠️ This endpoint is public and every call used to reach Guesty. Combined
 * with /properties/[id], `getListingDetail` accounted for 97% of terminal
 * BEAPI 429s measured on 2026-10-17 — the failure mode that empties
 * /properties for real guests.
 *
 * Two guards added 2026-10-19:
 *
 *  1. A shape check on the id. Anything that cannot be a Guesty id is
 *     rejected here rather than spending a Guesty call to be told 403 —
 *     the same reasoning as the known-listing gate on /api/quotes, where
 *     delisted ids were raising ops alerts nobody could act on.
 *
 *  2. A shared CDN cache. Listing detail is durable (photos, description,
 *     amenities, house rules); it does not carry live price or availability,
 *     so repeated requests for the same listing should not each cost a
 *     Guesty call.
 */
import { NextRequest, NextResponse } from "next/server";
import { getListingDetail } from "@/lib/guesty-beapi";

/** Guesty ids are 24 lowercase hex characters. */
const GUESTY_ID = /^[a-f0-9]{24}$/;

/** Matches the /properties/[id] page: durable data, hour-long shared cache. */
const CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!GUESTY_ID.test(id)) {
    return NextResponse.json(
      { error: "Listing id must be a 24-character hexadecimal Guesty id." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const data = await getListingDetail(id);
    return NextResponse.json(data, {
      headers: { "cache-control": CACHE_CONTROL },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch listing",
      },
      // Never cache a failure: a transient Guesty 429 pinned at the CDN for an
      // hour would look like a dead listing to every visitor behind it.
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
