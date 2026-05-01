// src/app/api/plan/listings/route.ts
// Rental matching for /plan, extracted from the generate_itinerary tool
// handler. Called client-side by PropertySidebar after the itinerary
// renders, so the agent turn can finish as soon as the itinerary JSON is
// complete — BEAPI / Supabase / ranking no longer block the stream.
//
// Pipeline (mirrors the old server path in tools/generate-itinerary.ts):
//   1. BEAPI availability for primary + up to 4 alternateDateRanges.
//   2. +3 day shift fallback if specific dates return empty.
//   3. Hydrate Listing rows for the union of ids.
//   4. rankListings("dated_guests") on each range.
//   5. Neighborhood-aware boost from the itinerary's POI mix.
//   6. Pass 1: one distinct listing per range. Pass 2: fill to 5.

import { NextResponse } from "next/server";
import { searchListings as beapiSearchListings } from "@/lib/guesty-beapi";
import { getPoisByIds } from "@/lib/pois/queries";
import { rankListings } from "@/lib/ranking";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Listing } from "@/lib/supabase";
import type { Poi } from "@/lib/pois/types";
import {
  boostListingsByNeighborhood,
  matchItineraryNeighborhood,
  type NeighborhoodMatch,
} from "@/lib/plan/neighborhood-match";
import { ItinerarySchema, type Itinerary } from "@/lib/plan/schema";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

// guesty-beapi transitively imports Node's crypto module — edge runtime
// can't host it. The chat route hit the same wall (see route.ts line 1).
export const runtime = "nodejs";
export const maxDuration = 60;

interface BeapiListingResult {
  id?: string;
  _id?: string;
}
interface BeapiSearchResponse {
  results?: BeapiListingResult[];
  listings?: BeapiListingResult[];
}

interface DateRange {
  checkIn: string;
  checkOut: string;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const BEAPI_CACHE_TTL_MS = 30 * 60 * 1000;

function beapiCacheKey(
  range: DateRange,
  guests: number,
  limit: number
): string {
  return `plan:beapi:${range.checkIn}:${range.checkOut}:${guests}:${limit}`;
}

async function readBeapiCache(key: string): Promise<string[] | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("kv_store")
      .select("value, updated_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    if (Date.now() - updatedAt > BEAPI_CACHE_TTL_MS) return null;
    const value = data.value as { ids?: unknown } | null;
    const ids = value?.ids;
    if (!Array.isArray(ids)) return null;
    return ids.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

async function writeBeapiCache(key: string, ids: string[]): Promise<void> {
  try {
    await getSupabaseAdmin().from("kv_store").upsert(
      {
        key,
        value: { ids },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch {
    /* best-effort */
  }
}

async function fetchAvailableIds(
  range: DateRange,
  guests: number,
  limit = 20
): Promise<string[]> {
  const cacheKey = beapiCacheKey(range, guests, limit);
  const cached = await readBeapiCache(cacheKey);
  if (cached) return cached;

  try {
    const raw = (await beapiSearchListings({
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      minOccupancy: guests,
      limit,
    })) as BeapiSearchResponse;

    const items = raw.results ?? raw.listings ?? [];
    const ids = items
      .map((l) => l.id ?? l._id ?? "")
      .filter((id): id is string => id.length > 0);

    if (ids.length > 0) {
      void writeBeapiCache(cacheKey, ids);
    }
    return ids;
  } catch (e) {
    console.warn(
      `[/api/plan/listings] BEAPI lookup failed for ${range.checkIn}..${range.checkOut}: ${(e as Error).message}`
    );
    return [];
  }
}

async function hydrateListings(guestyIds: string[]): Promise<Listing[]> {
  if (guestyIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("listings")
    .select("*")
    .in("guesty_id", guestyIds)
    .eq("active", true)
    .eq("is_listed", true);
  if (error) {
    console.warn(
      `[/api/plan/listings] listings hydrate failed: ${error.message}`
    );
    return [];
  }
  const listings = (data ?? []) as Listing[];
  await enrichListingsWithReviewAverages(listings);
  return listings;
}

function rankForRange(
  availableIds: string[],
  byGuestyId: Map<string, Listing>,
  guests: number,
  match: NeighborhoodMatch
): Listing[] {
  const available: Listing[] = [];
  for (const id of availableIds) {
    const listing = byGuestyId.get(id);
    if (listing) available.push(listing);
  }
  if (available.length === 0) return [];
  const ranked = rankListings(available, "dated_guests", {
    searchedGuests: guests,
  });
  return boostListingsByNeighborhood(ranked, match);
}

// Projection the /plan sidebar actually renders. Keeps internal columns
// (wheelhouse snapshots, pricing cache, owner metadata) server-side.
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
  checkIn: string;
  checkOut: string;
}

function toPublicListing(
  l: Listing,
  checkIn: string,
  checkOut: string
): PublicListing {
  // Listing.id is typed as number. The public shape keeps it forgiving so
  // older callers that stored stringified ids don't break.
  const rawAvg = (l as unknown as { computed_review_avg?: number | null })
    .computed_review_avg;
  const rawTotal = (l as unknown as { computed_review_count?: number | null })
    .computed_review_count;
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
    reviewAvg: rawAvg != null ? rawAvg * 2 : null,
    reviewTotal: rawTotal ?? null,
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

  // Tentative dates → empty. The sidebar's client-side fallback handles
  // showing generic picks for that case.
  if (itinerary.dates.isTentative) {
    return NextResponse.json({
      listings: [],
      reason: "tentative-dates",
    });
  }

  const guests = itinerary.party.adults + (itinerary.party.kids ?? 0);
  const alternates = itinerary.alternateDateRanges ?? [];
  const ranges: DateRange[] = [
    { checkIn: itinerary.dates.checkIn, checkOut: itinerary.dates.checkOut },
    ...alternates,
  ];

  let availabilityByRange = await Promise.all(
    ranges.map(async (range) => ({
      range,
      ids: await fetchAvailableIds(range, guests, 20),
    }))
  );

  let shifted = false;
  let shiftedRange: DateRange | null = null;
  if (alternates.length === 0 && availabilityByRange[0]!.ids.length === 0) {
    const next: DateRange = {
      checkIn: addDaysISO(itinerary.dates.checkIn, 3),
      checkOut: addDaysISO(itinerary.dates.checkOut, 3),
    };
    const ids = await fetchAvailableIds(next, guests, 20);
    availabilityByRange = [{ range: next, ids }];
    shifted = ids.length > 0;
    shiftedRange = shifted ? next : null;
  }

  const allIds = new Set<string>();
  for (const { ids } of availabilityByRange) {
    for (const id of ids) allIds.add(id);
  }
  if (allIds.size === 0) {
    return NextResponse.json({ listings: [], reason: "no-availability" });
  }

  const hydrated = await hydrateListings([...allIds]);
  if (hydrated.length === 0) {
    return NextResponse.json({ listings: [], reason: "no-inventory" });
  }

  const byGuestyId = new Map<string, Listing>();
  for (const l of hydrated) byGuestyId.set(l.guesty_id, l);

  // Neighborhood signal from the POI mix. matchItineraryNeighborhood needs
  // hydrated POI rows to read the neighborhood strings — the old tool
  // handler cached these, we reload here (one query, ~200 POIs max).
  const poiIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const item of day.items) poiIds.add(item.poiId);
  }
  const pois: Poi[] = await getPoisByIds([...poiIds]);
  const poisById = new Map(pois.map((p) => [p.id, p]));
  const match = matchItineraryNeighborhood(itinerary, poisById);

  const rangeRanked = availabilityByRange.map(({ range, ids }) => ({
    range,
    ranked: rankForRange(ids, byGuestyId, guests, match),
  }));

  const picks: PublicListing[] = [];
  const usedIds = new Set<string>();

  for (const { range, ranked } of rangeRanked) {
    if (picks.length >= 5) break;
    const next = ranked.find((l) => !usedIds.has(l.guesty_id));
    if (next) {
      picks.push(toPublicListing(next, range.checkIn, range.checkOut));
      usedIds.add(next.guesty_id);
    }
  }

  if (picks.length < 5) {
    for (const { range, ranked } of rangeRanked) {
      if (picks.length >= 5) break;
      for (const listing of ranked) {
        if (picks.length >= 5) break;
        if (!usedIds.has(listing.guesty_id)) {
          picks.push(toPublicListing(listing, range.checkIn, range.checkOut));
          usedIds.add(listing.guesty_id);
        }
      }
    }
  }

  return NextResponse.json({
    listings: picks,
    reason: shifted ? "date-shifted" : "agent-confirmed",
    shiftedRange,
  });
}
