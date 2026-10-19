/**
 * GET /agent/v1/listings/{id} — one listing's durable facts.
 *
 * No availability and no price: those are date-dependent and belong on the
 * search and availability endpoints. This is the stable description an agent
 * needs to tell a guest what the place is.
 */
import {
  getPublicListing,
  MAX_AVAILABILITY_DAYS,
  PET_POLICY,
} from "@/lib/agent-api";
import { AGENT_CACHE_LONG, agentError, agentJson } from "@/lib/agent-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guesty ids are 24 lowercase hex characters — same gate the edge validator uses. */
const GUESTY_ID = /^[a-f0-9]{24}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Shape-check before touching the database: an id that cannot exist should
  // not cost a query, and this is a public endpoint.
  if (!GUESTY_ID.test(id)) {
    return agentError(
      "INVALID_PARAMETER",
      "Listing id must be a 24-character hexadecimal Guesty id.",
      400
    );
  }

  try {
    const listing = await getPublicListing(id);
    if (!listing) {
      return agentError(
        "NOT_FOUND",
        "No active listing with that id. It may have been removed from the portfolio.",
        404
      );
    }
    return agentJson(
      {
        listing,
        petPolicy: PET_POLICY,
        availability: {
          endpoint: `/agent/v1/listings/${id}/availability`,
          note: `Requires from and to, at most ${MAX_AVAILABILITY_DAYS} days apart.`,
        },
      },
      AGENT_CACHE_LONG
    );
  } catch (err) {
    console.error("[agent/v1/listings/:id] lookup failed:", err);
    return agentError(
      "INTERNAL",
      "Listing lookup is temporarily unavailable. Please retry shortly.",
      503
    );
  }
}
