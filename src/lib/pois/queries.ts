// src/lib/pois/queries.ts
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  type Poi,
  type PoiCategory,
  type PoiPartyType,
  type PoiRow,
  type PoiTag,
  type PoiTimeSlot,
  rowToPoi,
} from "./types";

export interface SearchPoisOptions {
  neighborhoods?: string[];
  category?: PoiCategory;
  tags?: PoiTag[];
  timeSlot?: PoiTimeSlot;
  partyType?: PoiPartyType;
  // Free-text match against name + description (case-insensitive). Useful for
  // cuisine-style filters ("italian", "thai") that aren't in the controlled
  // tag vocab.
  query?: string;
  // When true, also return places outside Portland-proper that are popular
  // day trips (Hood River, Astoria, Mt. Hood, wine country, the coast).
  // Default false — generic "Portland" queries shouldn't surface them.
  includeDayTrips?: boolean;
  limit: number;
}

// Neighborhoods stored in sp_pois that are NOT Portland-proper. Excluded by
// default from search_pois; opt back in via `includeDayTrips: true` when the
// user explicitly asks about day trips, wine country, the coast, or the gorge.
const DAY_TRIP_NEIGHBORHOODS = [
  "hood_river",
  "columbia_gorge",
  "astoria",
  "cannon_beach",
  "tillamook",
  "mt_hood",
  "dundee",
  "seaside",
  "mcminnville",
  "carlton",
  "turner",
] as const;

function sanitizePostgrestPattern(input: string): string {
  // PostgREST `or` filter is comma-separated; commas/parens in user text would
  // break the syntax. Strip them and any % wildcards out — we only need a
  // fuzzy substring match.
  return input.replace(/[,()%*]/g, " ").trim();
}

/**
 * Search active POIs with filters. All filters are AND-ed.
 * `tags` uses Postgres array overlap (any matching tag passes).
 */
export async function searchPois(opts: SearchPoisOptions): Promise<Poi[]> {
  let query = getSupabaseAdmin()
    .from("sp_pois")
    .select("*")
    .eq("status", "active");

  if (opts.neighborhoods && opts.neighborhoods.length > 0) {
    query = query.in("neighborhood", opts.neighborhoods);
  }
  if (opts.category) {
    query = query.eq("category", opts.category);
  }
  if (opts.tags && opts.tags.length > 0) {
    query = query.overlaps("tags", opts.tags);
  }
  if (opts.timeSlot) {
    query = query.overlaps("time_slots", [opts.timeSlot]);
  }
  if (opts.partyType) {
    query = query.overlaps("party_types", [opts.partyType]);
  }
  if (opts.query) {
    const needle = sanitizePostgrestPattern(opts.query);
    if (needle.length > 0) {
      const pattern = `*${needle}*`;
      query = query.or(`name.ilike.${pattern},description.ilike.${pattern}`);
    }
  }
  // Exclude day-trip neighborhoods unless the caller explicitly opted in OR
  // explicitly asked for one of them via the `neighborhoods` filter (in which
  // case the user clearly wants that geography and excluding it would cancel
  // their own request).
  if (
    !opts.includeDayTrips &&
    !(opts.neighborhoods ?? []).some((n) =>
      (DAY_TRIP_NEIGHBORHOODS as readonly string[]).includes(n)
    )
  ) {
    query = query.not(
      "neighborhood",
      "in",
      `(${DAY_TRIP_NEIGHBORHOODS.join(",")})`
    );
  }

  const { data, error } = await query.limit(opts.limit).order("name");

  if (error) {
    throw new Error(`searchPois failed: ${error.message}`);
  }

  return ((data ?? []) as PoiRow[]).map(rowToPoi);
}

/**
 * Look up POIs by ID. Used by the post-generate validation step.
 * Returns rows in arbitrary order — caller is responsible for re-ordering.
 */
export async function getPoisByIds(ids: string[]): Promise<Poi[]> {
  if (ids.length === 0) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("sp_pois")
    .select("*")
    .in("id", ids);

  if (error) {
    throw new Error(`getPoisByIds failed: ${error.message}`);
  }

  return ((data ?? []) as PoiRow[]).map(rowToPoi);
}
