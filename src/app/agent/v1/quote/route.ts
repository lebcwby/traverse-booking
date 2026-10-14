/**
 * POST /agent/v1/quote — a live, all-in price plus a checkout link.
 *
 * ⚠️ The ONLY /agent/v1 endpoint that calls Guesty. Everything else reads the
 * Postgres cache. See the header of src/lib/agent-quote.ts for why that makes
 * this endpoint different, and src/proxy.ts for its tighter rate limit.
 *
 * It takes no payment and writes nothing. It returns a `checkoutUrl`; the
 * guest opens it and the existing Stripe checkout runs unchanged.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createQuote } from "@/lib/guesty-beapi";
import { classifyBeapiError } from "@/lib/beapi-error";
import { getPublicListing, isValidDate, nightsBetween } from "@/lib/agent-api";
import { agentError, agentJson } from "@/lib/agent-response";
import {
  isValidAgentSlug,
  MAX_QUOTE_GUESTS,
  MAX_QUOTE_NIGHTS,
  toAgentQuote,
} from "@/lib/agent-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUESTY_ID = /^[a-f0-9]{24}$/;

/** Public API callable from a browser context, so answer the preflight. */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return agentError("INVALID_PARAMETER", "Request body must be JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return agentError(
      "INVALID_PARAMETER",
      "Request body must be a JSON object.",
      400
    );
  }

  const { listingId, checkIn, checkOut, guests, agent } = body as Record<
    string,
    unknown
  >;

  if (!listingId || !checkIn || !checkOut || guests === undefined) {
    return agentError(
      "MISSING_PARAMETER",
      "listingId, checkIn, checkOut and guests are all required.",
      400
    );
  }
  if (typeof listingId !== "string" || !GUESTY_ID.test(listingId)) {
    return agentError(
      "INVALID_PARAMETER",
      "listingId must be a 24-character hexadecimal Guesty id, as returned by /agent/v1/listings.",
      400
    );
  }
  if (
    typeof checkIn !== "string" ||
    typeof checkOut !== "string" ||
    !isValidDate(checkIn) ||
    !isValidDate(checkOut)
  ) {
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
  if (nights > MAX_QUOTE_NIGHTS) {
    return agentError(
      "RANGE_TOO_LARGE",
      `Stays longer than ${MAX_QUOTE_NIGHTS} nights are not priced here. Contact us directly for extended stays.`,
      400,
      { maxNights: MAX_QUOTE_NIGHTS }
    );
  }

  const guestCount =
    typeof guests === "number" ? guests : Number.parseInt(String(guests), 10);
  if (
    !Number.isFinite(guestCount) ||
    guestCount < 1 ||
    guestCount > MAX_QUOTE_GUESTS ||
    !Number.isInteger(guestCount)
  ) {
    return agentError(
      "INVALID_PARAMETER",
      `guests must be a whole number between 1 and ${MAX_QUOTE_GUESTS}.`,
      400
    );
  }

  // Optional, and only used to tag attribution. Reject a malformed one rather
  // than silently writing junk into GA4's utm_source dimension — this is a
  // field an integrator sets once in code, so a clear 400 is the kind message.
  let agentSlug: string | undefined;
  if (agent !== undefined && agent !== null && agent !== "") {
    if (typeof agent !== "string" || !isValidAgentSlug(agent)) {
      return agentError(
        "INVALID_PARAMETER",
        "agent must be a short lowercase identifier (letters, digits, dot, underscore or hyphen), e.g. 'chatgpt'.",
        400
      );
    }
    agentSlug = agent;
  }

  // Resolve the listing from the mirror BEFORE spending a Guesty call. This
  // also supplies the name and url for the response, so it is not an extra
  // read. A delisted id would otherwise come back 403 from Guesty and raise an
  // ops alert nobody can act on.
  let listing;
  try {
    listing = await getPublicListing(listingId);
  } catch (err) {
    console.error("[agent/v1/quote] listing lookup failed:", err);
    return agentError(
      "INTERNAL",
      "Quoting is temporarily unavailable. Please retry shortly.",
      503
    );
  }
  if (!listing) {
    return agentError(
      "NOT_FOUND",
      "No active listing with that id. It may have been removed from the portfolio.",
      404
    );
  }

  if (listing.maxGuests != null && guestCount > listing.maxGuests) {
    return agentError(
      "INVALID_PARAMETER",
      `This property sleeps ${listing.maxGuests}. Quote for ${listing.maxGuests} guests or fewer, or search again with the larger party size.`,
      400,
      { maxGuests: listing.maxGuests }
    );
  }

  try {
    const raw = await createQuote({
      listingId,
      checkIn,
      checkOut,
      guestsCount: guestCount,
      // No `coupons` and no `pointofsale`. Coupons are a guest-facing promo
      // mechanism, not something an agent should be able to probe for, and
      // BEAPI's pointofsale only accepts values for specific Guesty
      // integrations — it is NOT a channel tag. See /api/quotes.
    });

    const quote = toAgentQuote(raw, listing, agentSlug);
    if (!quote.quoteId) {
      // Without an id there is no checkout URL to hand the guest, so this is
      // a failure however well-formed the price looks.
      console.error("[agent/v1/quote] quote had no id:", { listingId });
      return agentError(
        "INTERNAL",
        "Quoting is temporarily unavailable. Please retry shortly.",
        503
      );
    }

    // Never cached: a quote is per-request, priced live, and expires.
    return agentJson(quote, "no-store");
  } catch (err) {
    // Keep the raw BEAPI error server-side; the agent sees the classified
    // message so no Guesty-internal codes or field names leak.
    console.error("[agent/v1/quote] createQuote failed:", err);
    const classified = classifyBeapiError(err);
    // A 4xx from Guesty here means the stay is not bookable (unavailable,
    // under the minimum stay, bad occupancy) — which is an answer, not an
    // outage. Hand it back as a refusal the model can act on.
    return agentError(
      classified.status >= 500 ? "INTERNAL" : "NOT_AVAILABLE",
      classified.message,
      classified.status
    );
  }
}
