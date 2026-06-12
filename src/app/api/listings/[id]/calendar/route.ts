import { NextRequest, NextResponse } from "next/server";
import { getListingCalendar } from "@/lib/guesty-beapi";
import { enforceRateLimit } from "@/lib/plan/route-guards";

// getListingCalendar → BEAPI, which transitively needs Node's crypto.
export const runtime = "nodejs";

// Availability barely moves minute-to-minute, and the live quote at checkout
// is always re-fetched, so edge-cache staleness on this preview endpoint is
// safe (a guest can't actually book a stale-available date — checkout
// re-validates live). This shields Guesty: repeat hits for the same
// listing+range (a scraper's bread and butter, or just many users on a
// popular unit) are served from Vercel's CDN and never reach the BEAPI.
//
// Bumped 300→900s on 2026-06-12 after a second residential-proxy scraper wave:
// a longer fresh window shrinks the cache-miss fan-out that can still reach
// Guesty under a heavy crawl. stale-while-revalidate serves instantly while
// refreshing in the background, so freshness stays reasonable.
const CALENDAR_CACHE_HEADER =
  "public, s-maxage=900, stale-while-revalidate=1800";

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
