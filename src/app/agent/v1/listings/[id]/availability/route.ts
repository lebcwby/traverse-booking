/**
 * GET /agent/v1/listings/{id}/availability?from=&to=
 *
 * Day-level availability, nightly rate and minimum stay for one listing.
 *
 * ⚠️ The window is capped at MAX_AVAILABILITY_DAYS and `from`/`to` are
 * required. Day-level availability polled over time reconstructs our occupancy
 * curve, and with prices attached an estimate of revenue per unit — more
 * commercially sensitive than either field alone. A cap does not defeat a
 * determined scraper; it does mean the easy path serves a guest's actual
 * question and nothing beyond it.
 */
import type { NextRequest } from "next/server";
import {
  getAvailability,
  getPublicListing,
  isValidDate,
  MAX_AVAILABILITY_DAYS,
  nightsBetween,
} from "@/lib/agent-api";
import { AGENT_DISCLOSURE, agentError, agentJson } from "@/lib/agent-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUESTY_ID = /^[a-f0-9]{24}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!GUESTY_ID.test(id)) {
    return agentError(
      "INVALID_PARAMETER",
      "Listing id must be a 24-character hexadecimal Guesty id.",
      400
    );
  }

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");

  if (!from || !to) {
    return agentError(
      "MISSING_PARAMETER",
      "from and to are required, in YYYY-MM-DD format.",
      400
    );
  }
  if (!isValidDate(from) || !isValidDate(to)) {
    return agentError(
      "INVALID_PARAMETER",
      "from and to must be real calendar dates in YYYY-MM-DD format.",
      400
    );
  }

  const span = nightsBetween(from, to);
  if (span < 0) {
    return agentError("INVALID_PARAMETER", "to must not precede from.", 400);
  }
  if (span > MAX_AVAILABILITY_DAYS) {
    return agentError(
      "RANGE_TOO_LARGE",
      `Request at most ${MAX_AVAILABILITY_DAYS} days at a time.`,
      400,
      { maxDays: MAX_AVAILABILITY_DAYS }
    );
  }

  try {
    // Confirm the listing is real and active before returning a calendar for
    // it — otherwise an unknown id yields an empty array that reads like
    // "fully booked" rather than "no such listing".
    const listing = await getPublicListing(id);
    if (!listing) {
      return agentError("NOT_FOUND", "No active listing with that id.", 404);
    }

    const days = await getAvailability(id, from, to);
    return agentJson({
      listingId: id,
      listingUrl: listing.url,
      from,
      to,
      dayCount: days.length,
      pricing: AGENT_DISCLOSURE,
      days,
    });
  } catch (err) {
    console.error("[agent/v1/availability] lookup failed:", err);
    return agentError(
      "INTERNAL",
      "Availability is temporarily unavailable. Please retry shortly.",
      503
    );
  }
}
