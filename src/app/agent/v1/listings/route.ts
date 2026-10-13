/**
 * GET /agent/v1/listings — search for a stay.
 *
 * Dates are REQUIRED. There is no catalogue dump here by design: see the
 * header of src/lib/agent-api.ts. An agent asking "where can 6 people stay in
 * Crested Butte on 12–15 February" gets exactly that; nothing offers a
 * competitor the whole portfolio's rates in one call.
 *
 * Lives under /agent/ rather than /api/ because robots.txt disallows /api/,
 * and a discoverable API must be crawlable.
 */
import type { NextRequest } from "next/server";
import {
  isValidDate,
  MAX_SEARCH_RESULTS,
  MAX_STAY_NIGHTS,
  nightsBetween,
  searchAvailableListings,
} from "@/lib/agent-api";
import { AGENT_DISCLOSURE, agentError, agentJson } from "@/lib/agent-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const checkIn = sp.get("checkIn");
  const checkOut = sp.get("checkOut");

  if (!checkIn || !checkOut) {
    return agentError(
      "MISSING_PARAMETER",
      "checkIn and checkOut are required, in YYYY-MM-DD format. This API does not return availability or pricing without dates.",
      400
    );
  }
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    return agentError(
      "INVALID_PARAMETER",
      "checkIn and checkOut must be real calendar dates in YYYY-MM-DD format.",
      400
    );
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    return agentError(
      "INVALID_PARAMETER",
      "checkOut must be at least one night after checkIn.",
      400
    );
  }
  if (nights > MAX_STAY_NIGHTS) {
    return agentError(
      "RANGE_TOO_LARGE",
      `Stays longer than ${MAX_STAY_NIGHTS} nights are not priced here. Contact us directly for extended stays.`,
      400,
      { maxNights: MAX_STAY_NIGHTS }
    );
  }

  const intParam = (name: string): number | undefined | null => {
    const raw = sp.get(name);
    if (raw === null) return undefined;
    const n = Number.parseInt(raw, 10);
    // null signals "present but unusable" so the caller can 400 rather than
    // silently ignoring a filter the agent believed it had applied.
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const guests = intParam("guests");
  const bedrooms = intParam("bedrooms");
  const limit = intParam("limit");
  if (guests === null || bedrooms === null || limit === null) {
    return agentError(
      "INVALID_PARAMETER",
      "guests, bedrooms and limit must be positive whole numbers when supplied.",
      400
    );
  }

  try {
    const results = await searchAvailableListings({
      checkIn,
      checkOut,
      guests,
      bedrooms,
      city: sp.get("city") || undefined,
      limit,
    });

    return agentJson({
      query: {
        checkIn,
        checkOut,
        nights,
        guests: guests ?? null,
        bedrooms: bedrooms ?? null,
        city: sp.get("city") || null,
      },
      resultCount: results.length,
      maxResults: Math.min(limit ?? 20, MAX_SEARCH_RESULTS),
      pricing: AGENT_DISCLOSURE,
      results,
    });
  } catch (err) {
    console.error("[agent/v1/listings] search failed:", err);
    return agentError(
      "INTERNAL",
      "Search is temporarily unavailable. Please retry shortly.",
      503
    );
  }
}
