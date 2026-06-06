// src/app/api/plan/listings/route.ts
// Rental matching for /plan, called client-side by PropertySidebar after the
// itinerary renders.
//
// Listing data comes straight from BEAPI search results (the `listings`
// Supabase table is empty by design — the site fetches from BEAPI on the fly),
// and we HARD-FILTER to the trip's market (derived from the itinerary's POI
// neighborhoods) so a Crested Butte trip never surfaces a Leadville rental.
//
// Pipeline:
//   1. Derive the trip's market from the POI mix.
//   2. BEAPI availability for primary + alternate ranges (+3-day shift if the
//      exact dates are empty), mapped to Listing objects.
//   3. Filter to the market, rank, take distinct picks per range.
//   4. Bookability quote each pick; drop any BEAPI rejects.

import { NextResponse } from "next/server";
import {
  searchListings as beapiSearchListings,
  createQuote,
  type SearchListingsParams,
} from "@/lib/guesty-beapi";
import {
  mapBeapiToListing,
  type BeapiListingResult,
} from "@/lib/listing-utils";
import { getPoisByIds } from "@/lib/pois/queries";
import { rankListings } from "@/lib/ranking";
import type { Listing } from "@/lib/supabase";
import type { Poi } from "@/lib/pois/types";
import { ItinerarySchema, type Itinerary } from "@/lib/plan/schema";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

// guesty-beapi transitively imports Node's crypto module — edge can't host it.
export const runtime = "nodejs";
export const maxDuration = 60;

interface DateRange {
  checkIn: string;
  checkOut: string;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Market scoping ──────────────────────────────────────────────────────────
// POI neighborhood slug → market key. Keeps the sidebar's rentals in the same
// town/valley the itinerary is about.
const NEIGHBORHOOD_MARKET: Record<string, "crested_butte" | "leadville"> = {
  crested_butte: "crested_butte",
  mt_crested_butte: "crested_butte",
  gothic: "crested_butte",
  washington_gulch: "crested_butte",
  kebler_pass: "crested_butte",
  elk_range: "crested_butte",
  almont: "crested_butte",
  ohio_city: "crested_butte",
  leadville: "leadville",
  lake_county: "leadville",
  tennessee_pass: "leadville",
  twin_lakes: "leadville",
  san_isabel_nf: "leadville",
  buena_vista: "leadville",
};

// Market → acceptable listing cities (lowercased; tolerant of Guesty's
// "Crested Butte" vs "Mt. Crested Butte" labelling).
const MARKET_CITIES: Record<string, string[]> = {
  crested_butte: [
    "crested butte",
    "mt. crested butte",
    "mt crested butte",
    "mount crested butte",
  ],
  leadville: ["leadville", "twin lakes"],
};

function dominantMarket(pois: Poi[]): string | null {
  const counts: Record<string, number> = {};
  for (const p of pois) {
    const m = NEIGHBORHOOD_MARKET[p.neighborhood];
    if (m) counts[m] = (counts[m] ?? 0) + 1;
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [m, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = m;
      bestN = n;
    }
  }
  return best;
}

function filterByMarket(listings: Listing[], market: string | null): Listing[] {
  if (!market) return listings;
  const cities = MARKET_CITIES[market];
  if (!cities) return listings;
  return listings.filter((l) => {
    const c = (l.address?.city || "").trim().toLowerCase();
    if (!c) return false;
    return cities.some((m) => c === m || c.includes(m) || m.includes(c));
  });
}

// ── BEAPI search → mapped, bookable listings ────────────────────────────────
async function fetchListings(
  range: DateRange | null,
  guests: number,
  petsAllowed: boolean,
  limit = 100
): Promise<Listing[]> {
  const params: SearchListingsParams = {
    minOccupancy: guests || undefined,
    petsAllowed: petsAllowed || undefined,
    limit,
  };
  if (range) {
    params.checkIn = range.checkIn;
    params.checkOut = range.checkOut;
  }
  try {
    const raw = (await beapiSearchListings(params)) as {
      results?: BeapiListingResult[];
      listings?: BeapiListingResult[];
    };
    const items = raw.results ?? raw.listings ?? [];
    return items
      .map(mapBeapiToListing)
      .filter((l) =>
        // dated → must have a real total (had a valid rate); undated → base price
        range
          ? (l.totalPrice ?? 0) > 0
          : (l.prices?.basePrice ?? 0) > 0
      );
  } catch (e) {
    console.warn(
      `[/api/plan/listings] BEAPI lookup failed: ${(e as Error).message}`
    );
    return [];
  }
}

interface PublicListing {
  id: string | number | undefined;
  guesty_id: string | undefined;
  title: string | null;
  nickname: string | null;
  bedrooms: number | null;
  accommodates: number | null;
  property_type: string | null;
  picture: string | null;
  amenities: string[] | null;
  tags: string[] | null;
  reviewAvg: number | null;
  reviewTotal: number | null;
  checkIn?: string;
  checkOut?: string;
}

function toPublicListing(
  l: Listing,
  checkIn?: string,
  checkOut?: string
): PublicListing {
  return {
    id: l.id,
    guesty_id: l.guesty_id,
    title: l.title,
    nickname: l.nickname,
    bedrooms: l.bedrooms,
    accommodates: l.accommodates,
    property_type: l.property_type,
    picture: l.picture,
    amenities: l.amenities,
    tags: l.tags,
    // mapBeapiToListing already exposes reviewAvg on the 0–10 scale the
    // sidebar expects (it divides by 2 for display).
    reviewAvg: l.reviewAvg ?? null,
    reviewTotal: l.reviewTotal ?? null,
    checkIn,
    checkOut,
  };
}

interface RequestBody {
  itinerary?: unknown;
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 64_000);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "plan:listings", {
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = ItinerarySchema.safeParse(body.itinerary);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid itinerary", issues: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }
  const itinerary: Itinerary = parsed.data;

  const guests = itinerary.party.adults + (itinerary.party.kids ?? 0);
  const petsAllowed = (itinerary.party.pets ?? 0) > 0;

  // Market signal from the POI mix — the hard filter that keeps a CB trip's
  // rentals in CB.
  const poiIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const item of day.items) poiIds.add(item.poiId);
  }
  const pois: Poi[] = await getPoisByIds([...poiIds]);
  const market = dominantMarket(pois);

  // Tentative dates → market-scoped, undated picks (no bookability check).
  if (itinerary.dates.isTentative) {
    const listings = filterByMarket(
      await fetchListings(null, guests, petsAllowed, 100),
      market
    );
    const ranked = rankListings(listings, "browse").slice(0, 5);
    return NextResponse.json({
      listings: ranked.map((l) => toPublicListing(l)),
      reason: "tentative-dates",
    });
  }

  const alternates = itinerary.alternateDateRanges ?? [];
  const ranges: DateRange[] = [
    { checkIn: itinerary.dates.checkIn, checkOut: itinerary.dates.checkOut },
    ...alternates,
  ];

  let byRange = await Promise.all(
    ranges.map(async (range) => ({
      range,
      listings: filterByMarket(
        await fetchListings(range, guests, petsAllowed, 100),
        market
      ),
    }))
  );

  // +3-day shift if the exact primary dates have nothing in-market.
  let shifted = false;
  let shiftedRange: DateRange | null = null;
  if (alternates.length === 0 && byRange[0]!.listings.length === 0) {
    const next: DateRange = {
      checkIn: addDaysISO(itinerary.dates.checkIn, 3),
      checkOut: addDaysISO(itinerary.dates.checkOut, 3),
    };
    const listings = filterByMarket(
      await fetchListings(next, guests, petsAllowed, 100),
      market
    );
    byRange = [{ range: next, listings }];
    shifted = listings.length > 0;
    shiftedRange = shifted ? next : null;
  }

  if (byRange.every((r) => r.listings.length === 0)) {
    return NextResponse.json({ listings: [], reason: "no-availability" });
  }

  const rangeRanked = byRange.map(({ range, listings }) => ({
    range,
    ranked: rankListings(listings, "dated_guests", { searchedGuests: guests }),
  }));

  // Pass 1: one distinct listing per range; pass 2: fill to 8 candidates.
  const candidates: PublicListing[] = [];
  const usedIds = new Set<string>();
  const pushCandidate = (l: Listing, range: DateRange) => {
    if (usedIds.has(l.guesty_id)) return;
    candidates.push(toPublicListing(l, range.checkIn, range.checkOut));
    usedIds.add(l.guesty_id);
  };
  for (const { range, ranked } of rangeRanked) {
    if (candidates.length >= 8) break;
    const next = ranked.find((l) => !usedIds.has(l.guesty_id));
    if (next) pushCandidate(next, range);
  }
  for (const { range, ranked } of rangeRanked) {
    if (candidates.length >= 8) break;
    for (const l of ranked) {
      if (candidates.length >= 8) break;
      pushCandidate(l, range);
    }
  }

  // Bookability check — quote each candidate; drop any BEAPI rejects so the
  // user never clicks through to an "Unable to get pricing" page.
  const bookable = await Promise.all(
    candidates.map(async (c) => {
      try {
        await createQuote({
          listingId: c.guesty_id ?? String(c.id ?? ""),
          checkIn: c.checkIn!,
          checkOut: c.checkOut!,
          guestsCount: Math.max(1, guests),
        });
        return c;
      } catch {
        return null;
      }
    })
  );
  const picks = bookable
    .filter((c): c is PublicListing => c !== null)
    .slice(0, 5);

  return NextResponse.json({
    listings: picks,
    reason: shifted ? "date-shifted" : "agent-confirmed",
    shiftedRange,
  });
}
