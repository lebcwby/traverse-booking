import { NextRequest, NextResponse } from "next/server";
import { getListingCalendar } from "@/lib/guesty-beapi";
import { enforceRateLimit } from "@/lib/plan/route-guards";

// getListingCalendar → BEAPI, which transitively needs Node's crypto.
export const runtime = "nodejs";

// Availability barely moves minute-to-minute, and the live quote at checkout
// is always re-fetched, so a few minutes of edge-cache staleness on this
// preview endpoint is safe. This shields Guesty: repeat hits for the same
// listing+range (a scraper's bread and butter, or just many users on a
// popular unit) are served from Vercel's CDN and never reach the BEAPI.
const CALENDAR_CACHE_HEADER =
  "public, s-maxage=300, stale-while-revalidate=600";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Per-IP throttle. Normal browsing pulls a calendar or two per property
  // view; 60/min/IP is generous for humans but caps an automated fan-out.
  // (Edge caching above is the real volume shield; this stops a single IP
  // from hammering cache-miss ranges.)
  const limited = await enforceRateLimit(request, "listings:calendar", {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

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
    return NextResponse.json(data, {
      headers: { "Cache-Control": CALENDAR_CACHE_HEADER },
    });
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
