import { NextRequest, NextResponse } from "next/server";
import { createQuote } from "@/lib/guesty-beapi";
import { classifyBeapiError } from "@/lib/beapi-error";
import { getListings } from "@/lib/supabase";

/**
 * Known-listing gate.
 *
 * This route is public and unauthenticated (the edge proxy caps it at 15/min
 * per IP) and it forwarded ANY listingId straight to Guesty. A delisted id —
 * from a stale link, an old bookmark or a crawler — came back 403, which
 * raised an ops email nobody could act on. The edge validator added in Phase 1
 * only guards /properties/<slug> page requests; the quote API had no such
 * check.
 *
 * Catching it here means a dead listing gets an honest 404 instead of
 * spending a Guesty call and an alert.
 *
 * FAILS OPEN. If the id set can't be loaded we let the request through to
 * Guesty exactly as before — refusing a real booking because a lookup blipped
 * would be far worse than the alert this prevents. Same rule as
 * listing-url-validator.ts.
 */
const ID_CACHE_TTL_MS = 10 * 60 * 1000;
let idCache: { ids: Set<string>; fetchedAt: number } | null = null;
let inFlight: Promise<Set<string> | null> | null = null;

async function loadIds(): Promise<Set<string> | null> {
  try {
    const listings = await getListings({ limit: 1000 });
    const ids = new Set(
      listings.map((l) => l.guesty_id).filter((id): id is string => !!id)
    );
    // An empty set means the mirror is unreadable, not that we have no
    // listings. Treat it as "unknown" so we fail open instead of 404ing
    // the whole catalogue.
    return ids.size > 0 ? ids : null;
  } catch {
    return null;
  }
}

async function isKnownListing(listingId: string): Promise<boolean> {
  if (idCache && Date.now() - idCache.fetchedAt < ID_CACHE_TTL_MS) {
    return idCache.ids.has(listingId);
  }
  if (!inFlight) {
    inFlight = loadIds().finally(() => {
      inFlight = null;
    });
  }
  const ids = await inFlight;
  if (ids) {
    idCache = { ids, fetchedAt: Date.now() };
    return ids.has(listingId);
  }
  // Refresh failed — prefer a stale set over blocking, and fail open if we
  // have never had one.
  return idCache ? idCache.ids.has(listingId) : true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { listingId, checkIn, checkOut, guestsCount, coupons, pointofsale } =
      body;

    if (!listingId || !checkIn || !checkOut || !guestsCount) {
      return NextResponse.json(
        {
          error: "listingId, checkIn, checkOut, and guestsCount are required",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }

    if (!(await isKnownListing(listingId))) {
      return NextResponse.json(
        {
          error:
            "This property is no longer available. Browse our current Colorado rentals instead.",
          code: "LISTING_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const data = await createQuote({
      listingId,
      checkIn,
      checkOut,
      guestsCount,
      coupons,
      // Note: BEAPI's `pointofsale` only accepts the values [google, findrentals]
      // for specific Guesty integrations — it is NOT for tagging direct-booking
      // channels. Channel commissions for the Website manual channel are
      // configured in Guesty itself and applied per the BEAPI account's default
      // channel mapping. Forwarding only when an integration explicitly sets it.
      pointofsale,
    });

    return NextResponse.json(data);
  } catch (error) {
    // Keep the raw BEAPI error in server logs (and Sentry, if wired). The
    // client only ever sees the classified, sanitized response — no raw
    // internal field names or Guesty-internal codes leak.
    console.error("[Quotes] Error:", error);

    const classified = classifyBeapiError(error);
    return NextResponse.json(
      { error: classified.message, code: classified.code },
      { status: classified.status }
    );
  }
}
