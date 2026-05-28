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
import {
  searchListings as beapiSearchListings,
  createQuote,
} from "@/lib/guesty-beapi";
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
  limit: number,
  petsAllowed: boolean
): string {
  // Include pets in the key so a pet-friendly search doesn't get served the
  // unfiltered cached result (or vice-versa). Two parallel cache entries:
  // one with the petsAllowed filter, one without.
  const petsSegment = petsAllowed ? ":pets" : "";
  return `plan:beapi:${range.checkIn}:${range.checkOut}:${guests}:${limit}${petsSegment}`;
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
  petsAllowed: boolean,
  limit = 20
): Promise<string[]> {
  const cacheKey = beapiCacheKey(range, guests, limit, petsAllowed);
  const cached = await readBeapiCache(cacheKey);
  if (cached) return cached;

  try {
    const raw = (await beapiSearchListings({
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      minOccupancy: guests,
      petsAllowed: petsAllowed || undefined,
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

// Column list mirrors `Listing` interface — skips heavy JSONB extras
// (`raw`, `wheelhouse_data`, financials, owners, integrations,
// cleaning_status, custom_fields) that this route never reads. See
// LISTING_FIELDS comment in src/lib/supabase.ts for the full rationale
// (Codex #10, 2026-05-27). Kept local to this file so the columns the
// sidebar actually renders are visible right next to the query.
const PLAN_SIDEBAR_LISTING_FIELDS =
  "id,guesty_id,nickname,title,property_type,room_type," +
  "bedrooms,bathrooms,beds,accommodates,area_square_feet," +
  "address,prices,active,is_listed,beapi_enabled," +
  "picture,pictures,picture_count,amenities,tags," +
  "default_check_in_time,default_check_out_time,timezone," +
  "review_count,computed_review_avg,computed_review_count," +
  "occupancy_stats,city,state,guesty_updated_at,listing_category,review_summary";

async function hydrateListings(guestyIds: string[]): Promise<Listing[]> {
  if (guestyIds.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("listings")
    .select(PLAN_SIDEBAR_LISTING_FIELDS)
    .in("guesty_id", guestyIds)
    .eq("active", true)
    .eq("is_listed", true);
  if (error) {
    console.warn(
      `[/api/plan/listings] listings hydrate failed: ${error.message}`
    );
    return [];
  }
  // Cast via unknown — Supabase-js's PostgREST type inference can't narrow
  // an explicit column list back to Listing; same pattern as in
  // src/lib/supabase.ts.
  const listings = (data ?? []) as unknown as Listing[];
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
  // When the itinerary's party includes pets, restrict BEAPI to pet-friendly
  // listings. Mirrors the agent's search_listings tool fix on 2026-05-25;
  // without this the sidebar can still surface non-pet stays after the
  // agent correctly recommended a pet-trip itinerary.
  const petsAllowed = (itinerary.party.pets ?? 0) > 0;
  const alternates = itinerary.alternateDateRanges ?? [];
  const ranges: DateRange[] = [
    { checkIn: itinerary.dates.checkIn, checkOut: itinerary.dates.checkOut },
    ...alternates,
  ];

  let availabilityByRange = await Promise.all(
    ranges.map(async (range) => ({
      range,
      ids: await fetchAvailableIds(range, guests, petsAllowed, 20),
    }))
  );

  let shifted = false;
  let shiftedRange: DateRange | null = null;
  if (alternates.length === 0 && availabilityByRange[0]!.ids.length === 0) {
    const next: DateRange = {
      checkIn: addDaysISO(itinerary.dates.checkIn, 3),
      checkOut: addDaysISO(itinerary.dates.checkOut, 3),
    };
    const ids = await fetchAvailableIds(next, guests, petsAllowed, 20);
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

  // Build a candidate pool — pass 1 grabs one distinct listing per range,
  // pass 2 fills to 8. We over-fetch beyond the 5 we'll show because the
  // quote-validation step below will drop any that BEAPI's search marked
  // available but its quote endpoint rejects (rate-plan / allotment edge
  // cases that have leaked through to the sidebar in the past).
  const candidates: PublicListing[] = [];
  const usedIds = new Set<string>();

  for (const { range, ranked } of rangeRanked) {
    if (candidates.length >= 8) break;
    const next = ranked.find((l) => !usedIds.has(l.guesty_id));
    if (next) {
      candidates.push(toPublicListing(next, range.checkIn, range.checkOut));
      usedIds.add(next.guesty_id);
    }
  }
  if (candidates.length < 8) {
    for (const { range, ranked } of rangeRanked) {
      if (candidates.length >= 8) break;
      for (const listing of ranked) {
        if (candidates.length >= 8) break;
        if (!usedIds.has(listing.guesty_id)) {
          candidates.push(
            toPublicListing(listing, range.checkIn, range.checkOut)
          );
          usedIds.add(listing.guesty_id);
        }
      }
    }
  }

  // Defensive bookability check — parallel quote each candidate against the
  // exact (listingId, dates, guests) tuple we'd surface in the URL. Drop any
  // that BEAPI rejects so the user never clicks through to an "Unable to get
  // pricing" property page. Uses guests=1 minimum since BEAPI sometimes
  // requires guestsCount >= 1 even for studio rentals.
  const bookable = await Promise.all(
    candidates.map(async (c) => {
      try {
        await createQuote({
          listingId: c.guesty_id ?? String(c.id ?? ""),
          checkIn: c.checkIn,
          checkOut: c.checkOut,
          guestsCount: Math.max(1, guests),
        });
        return c;
      } catch {
        return null;
      }
    })
  );
  const picks = bookable.filter((c): c is PublicListing => c !== null).slice(0, 5);

  return NextResponse.json({
    listings: picks,
    reason: shifted ? "date-shifted" : "agent-confirmed",
    shiftedRange,
  });
}
