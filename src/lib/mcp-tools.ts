/**
 * MCP tool definitions and dispatch. Phase 8 of
 * docs/phase2-ai-agent-booking.md.
 *
 * A thin adapter over the same functions /agent/v1 uses — searching, listing
 * detail and availability all come from Postgres (the `listings` mirror and
 * the `calendar_days` cache), so an assistant calling these costs Guesty
 * nothing. That was the whole point of doing phase 6 first: transport is the
 * cheap part, the cached service layer is the work.
 *
 * ⚠️ There is deliberately NO quote or booking tool. Quoting is phase 7 and
 * is not built; an assistant must send the guest to the listing URL to book.
 * Nothing here writes, takes payment, or reads anything guest-specific.
 *
 * Kept separate from the HTTP route so the tool contract can be tested
 * without a transport, and so a future stdio or SSE server could reuse it.
 */
import {
  getAvailability,
  getPublicListing,
  isValidDate,
  MAX_AVAILABILITY_DAYS,
  MAX_SEARCH_RESULTS,
  MAX_STAY_NIGHTS,
  nightsBetween,
  searchAvailableListings,
} from "./agent-api";
import { AGENT_DISCLOSURE } from "./agent-response";

export const MCP_SERVER_INFO = {
  name: "traverse-hospitality",
  title: "Traverse Hospitality — Colorado vacation rentals",
  version: "1.0.0",
} as const;

/**
 * Protocol versions this server can speak. The three methods it implements
 * (initialize, tools/list, tools/call) are stable across these, so the
 * handshake echoes the client's version when we recognise it rather than
 * forcing a downgrade.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const PREFERRED_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PREFERRED_PROTOCOL_VERSION;
}

const GUESTY_ID = /^[a-f0-9]{24}$/;

/** Prose an assistant reads before deciding whether to quote a number. */
const PRICE_WARNING =
  "Prices are INDICATIVE and accommodation-only: they exclude cleaning, taxes and fees, and come from a cache refreshed roughly every 5 hours. The all-in total is calculated live at checkout, which is authoritative. Present these as a starting estimate and link the traveller to the listing url to book.";

export const MCP_TOOLS = [
  {
    name: "search_listings",
    title: "Search available stays",
    description:
      "Find Traverse Hospitality vacation rentals available for a specific stay across six Colorado mountain markets (Crested Butte, Mount Crested Butte, Leadville, Vail, Avon, Granby, Twin Lakes). Returns only listings where every night is available and the stay meets the property's minimum. Dates are required. " +
      PRICE_WARNING,
    inputSchema: {
      type: "object",
      properties: {
        checkIn: { type: "string", description: "Arrival date, YYYY-MM-DD." },
        checkOut: {
          type: "string",
          description: `Departure date, YYYY-MM-DD. At most ${MAX_STAY_NIGHTS} nights after checkIn.`,
        },
        guests: {
          type: "integer",
          minimum: 1,
          description: "Only return listings sleeping at least this many.",
        },
        bedrooms: { type: "integer", minimum: 1 },
        city: {
          type: "string",
          description:
            "Town name, e.g. 'Mount Crested Butte', 'Leadville', 'Vail'.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_SEARCH_RESULTS,
          default: 10,
        },
      },
      required: ["checkIn", "checkOut"],
    },
  },
  {
    name: "get_listing",
    title: "Get listing details",
    description:
      "Durable facts about one listing: size, location, amenities, building and check-in times. Contains no availability or pricing — those depend on dates, so use search_listings or check_availability for those.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: {
          type: "string",
          description: "24-character hexadecimal Guesty listing id.",
        },
      },
      required: ["listingId"],
    },
  },
  {
    name: "check_availability",
    title: "Check a listing's calendar",
    description:
      `Day-by-day availability, nightly rate and minimum stay for one listing, over at most ${MAX_AVAILABILITY_DAYS} days. Useful for answering "when is this place free" or "what does it cost in March". ` +
      PRICE_WARNING,
    inputSchema: {
      type: "object",
      properties: {
        listingId: { type: "string" },
        from: { type: "string", description: "Start date, YYYY-MM-DD." },
        to: { type: "string", description: "End date, YYYY-MM-DD." },
      },
      required: ["listingId", "from", "to"],
    },
  },
] as const;

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function ok(payload: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

/**
 * A tool-level failure, which is NOT a protocol error: the call succeeded, the
 * tool is reporting a problem the model should read and act on. Returning it
 * as `isError` content lets the assistant correct itself (fix a date, pick a
 * different listing) instead of treating the server as broken.
 */
function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function asInt(v: unknown): number | undefined | null {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (name === "search_listings") {
    const checkIn = String(args.checkIn ?? "");
    const checkOut = String(args.checkOut ?? "");
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return fail(
        "checkIn and checkOut must be real calendar dates in YYYY-MM-DD format. This tool cannot return availability or pricing without dates."
      );
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1)
      return fail("checkOut must be at least one night after checkIn.");
    if (nights > MAX_STAY_NIGHTS) {
      return fail(
        `Stays longer than ${MAX_STAY_NIGHTS} nights are not priced here. Point the traveller at the contact page for extended stays.`
      );
    }
    const guests = asInt(args.guests);
    const bedrooms = asInt(args.bedrooms);
    const limit = asInt(args.limit);
    if (guests === null || bedrooms === null || limit === null) {
      return fail("guests, bedrooms and limit must be positive whole numbers.");
    }

    const results = await searchAvailableListings({
      checkIn,
      checkOut,
      guests,
      bedrooms,
      city: typeof args.city === "string" && args.city ? args.city : undefined,
      limit: limit ?? 10,
    });
    return ok({
      query: {
        checkIn,
        checkOut,
        nights,
        guests: guests ?? null,
        bedrooms: bedrooms ?? null,
        city: args.city ?? null,
      },
      resultCount: results.length,
      pricing: AGENT_DISCLOSURE,
      results,
    });
  }

  if (name === "get_listing") {
    const listingId = String(args.listingId ?? "");
    if (!GUESTY_ID.test(listingId)) {
      return fail("listingId must be a 24-character hexadecimal Guesty id.");
    }
    const listing = await getPublicListing(listingId);
    if (!listing) {
      return fail(
        "No active listing with that id. It may have been removed from the portfolio."
      );
    }
    return ok({ listing });
  }

  if (name === "check_availability") {
    const listingId = String(args.listingId ?? "");
    const from = String(args.from ?? "");
    const to = String(args.to ?? "");
    if (!GUESTY_ID.test(listingId)) {
      return fail("listingId must be a 24-character hexadecimal Guesty id.");
    }
    if (!isValidDate(from) || !isValidDate(to)) {
      return fail(
        "from and to must be real calendar dates in YYYY-MM-DD format."
      );
    }
    const span = nightsBetween(from, to);
    if (span < 0) return fail("to must not precede from.");
    if (span > MAX_AVAILABILITY_DAYS) {
      return fail(`Request at most ${MAX_AVAILABILITY_DAYS} days at a time.`);
    }
    const listing = await getPublicListing(listingId);
    if (!listing) return fail("No active listing with that id.");
    const days = await getAvailability(listingId, from, to);
    return ok({
      listingId,
      listingUrl: listing.url,
      from,
      to,
      dayCount: days.length,
      pricing: AGENT_DISCLOSURE,
      days,
    });
  }

  return fail(`Unknown tool: ${name}`);
}
