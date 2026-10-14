/**
 * OpenAPI 3.1 description of the public agent API, at a well-known location
 * so an assistant can discover it without being told where to look.
 * Referenced from llms.txt.
 *
 * Kept hand-written rather than generated: it is the contract, and the prose
 * in the descriptions is load-bearing — an agent reads them to decide whether
 * our prices are safe to quote to a guest. See the pricing disclosure.
 */
import { NextResponse } from "next/server";
import {
  MAX_AVAILABILITY_DAYS,
  MAX_SEARCH_RESULTS,
  MAX_STAY_NIGHTS,
} from "@/lib/agent-api";
import { MAX_QUOTE_GUESTS, MAX_QUOTE_NIGHTS } from "@/lib/agent-quote";
import { SITE_ORIGIN } from "@/lib/listing-jsonld";

export const dynamic = "force-static";
export const revalidate = 86400;

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Traverse Hospitality — public booking data API",
    version: "1.0.0",
    summary:
      "Search and inspect Colorado vacation rentals managed by Traverse Hospitality.",
    description:
      "Access to Traverse Hospitality's portfolio of vacation rentals across six Colorado mountain markets.\n\n" +
      "**There are two kinds of price here, and conflating them will mislead a traveller.**\n\n" +
      "1. **Search and availability figures are indicative and accommodation-only.** They exclude cleaning fees, taxes, pet fees and optional extras, and come from a cache refreshed roughly every five hours. Present them as a starting estimate, never as the amount payable. Availability is cached on the same cycle, so a listing returned as available is very likely bookable but not guaranteed.\n\n" +
      "2. **`POST /agent/v1/quote` returns a live, all-in total** — accommodation, cleaning and taxes — computed on request for one listing and one set of dates. That figure is the amount payable, until its `expiresAt` (24 hours). Our checkout page re-fetches the quote and is the final authority if rates move in between.\n\n" +
      "Every response carries the applicable caveat inline: cached figures come with a `pricing` disclosure, live quotes with `terms`. Read whichever is present rather than assuming.\n\n" +
      "**No endpoint takes payment and nothing here creates a booking.** The quote endpoint returns a `checkoutUrl`; the guest opens it and pays there themselves.",
    contact: {
      name: "Traverse Hospitality",
      url: `${SITE_ORIGIN}/contact`,
      email: "bookings@traversehospitality.com",
    },
  },
  servers: [{ url: SITE_ORIGIN }],
  paths: {
    "/agent/v1/listings": {
      get: {
        operationId: "searchListings",
        summary: "Find listings available for a specific stay",
        description:
          "Returns listings where every night of the requested stay is available, the arrival date is not closed to arrival, and the stay satisfies the minimum-stay rule. Dates are required: this API does not return a catalogue dump or pricing without them.",
        parameters: [
          {
            name: "checkIn",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
            description: "Arrival date, YYYY-MM-DD.",
          },
          {
            name: "checkOut",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
            description: `Departure date, YYYY-MM-DD. At most ${MAX_STAY_NIGHTS} nights after checkIn.`,
          },
          {
            name: "guests",
            in: "query",
            schema: { type: "integer", minimum: 1 },
            description: "Only return listings sleeping at least this many.",
          },
          {
            name: "bedrooms",
            in: "query",
            schema: { type: "integer", minimum: 1 },
            description: "Minimum bedroom count.",
          },
          {
            name: "city",
            in: "query",
            schema: { type: "string" },
            description:
              "Town name, e.g. 'Crested Butte', 'Mount Crested Butte', 'Leadville', 'Vail', 'Avon', 'Granby', 'Twin Lakes'.",
          },
          {
            name: "limit",
            in: "query",
            schema: {
              type: "integer",
              minimum: 1,
              maximum: MAX_SEARCH_RESULTS,
              default: 20,
            },
          },
        ],
        responses: {
          "200": {
            description: "Matching listings, cheapest stay first.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/agent/v1/listings/{id}": {
      get: {
        operationId: "getListing",
        summary: "Durable facts about one listing",
        description:
          "Size, location, amenities, building and check-in times. Contains no availability or pricing — those depend on dates.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
          },
        ],
        responses: {
          "200": {
            description: "The listing.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    listing: { $ref: "#/components/schemas/Listing" },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/agent/v1/listings/{id}/availability": {
      get: {
        operationId: "getAvailability",
        summary: "Day-level availability and nightly rates",
        description: `Returns one entry per day. The window may span at most ${MAX_AVAILABILITY_DAYS} days.`,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
          },
          {
            name: "from",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            required: true,
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          "200": {
            description: "Calendar for the window.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AvailabilityResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/agent/v1/quote": {
      post: {
        operationId: "createQuote",
        summary: "Price a specific stay and get a checkout link",
        description:
          "Returns a **live, all-in quote** from the property management system — accommodation, cleaning and taxes — for one listing and one set of dates, plus a `checkoutUrl` to hand the traveller.\n\n" +
          "This is the one endpoint whose pricing is authoritative rather than indicative, because it is computed on request rather than read from the cache. It is correspondingly rate-limited more tightly than the read endpoints.\n\n" +
          `The quote expires: \`expiresAt\` is returned on every quote and is currently 24 hours after creation. After that the quote id no longer resolves and the traveller needs a new one.\n\n` +
          "**This API cannot take payment and creates no booking.** Send the traveller to `checkoutUrl`; they complete payment themselves on our checkout page, which re-fetches the quote. If rates moved in between, the guest pays the re-fetched price — so present this total as current rather than locked.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["listingId", "checkIn", "checkOut", "guests"],
                properties: {
                  listingId: {
                    type: "string",
                    pattern: "^[a-f0-9]{24}$",
                    description: "From searchListings or getListing.",
                  },
                  checkIn: { type: "string", format: "date" },
                  checkOut: {
                    type: "string",
                    format: "date",
                    description: `At most ${MAX_QUOTE_NIGHTS} nights after checkIn.`,
                  },
                  guests: {
                    type: "integer",
                    minimum: 1,
                    maximum: MAX_QUOTE_GUESTS,
                    description:
                      "Must not exceed the listing's maxGuests, or the request is rejected.",
                  },
                  agent: {
                    type: "string",
                    pattern: "^[a-z0-9][a-z0-9._-]{0,39}$",
                    description:
                      "Optional. A short identifier for your assistant, e.g. 'chatgpt'. Used only for traffic attribution on our side.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "A live quote and a checkout link.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quote" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description:
              "The request was valid but the stay is not bookable — unavailable, below the minimum stay, or occupancy refused. Error code NOT_AVAILABLE. Retrying unchanged will not help.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description: "A parameter was missing or unusable.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "No active listing with that id.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      RateLimited: {
        description:
          "Too many requests from this address. Retry after the interval in the Retry-After header.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: {
                type: "string",
                enum: [
                  "INVALID_PARAMETER",
                  "MISSING_PARAMETER",
                  "NOT_FOUND",
                  "RANGE_TOO_LARGE",
                  "NOT_AVAILABLE",
                  "INTERNAL",
                ],
              },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
      },
      PricingDisclosure: {
        type: "object",
        description:
          "Always present alongside any CACHED figure (search, availability). Read it before quoting a price to a traveller. A live quote from createQuote carries QuoteTerms instead, which says the opposite — do not confuse them.",
        properties: {
          priceBasis: { type: "string", const: "accommodation-only" },
          excludes: { type: "array", items: { type: "string" } },
          authoritative: { type: "boolean", const: false },
          note: { type: "string" },
        },
      },
      QuoteTerms: {
        type: "object",
        description:
          "Accompanies a live quote. Unlike PricingDisclosure, this figure IS the amount payable — until it expires, and subject to the checkout page re-fetching it.",
        properties: {
          priceBasis: { type: "string", const: "all-in" },
          includes: { type: "array", items: { type: "string" } },
          excludes: { type: "array", items: { type: "string" } },
          authoritative: { type: "boolean", const: true },
          authoritativeUntil: { type: "string", const: "expiresAt" },
          note: { type: "string" },
        },
      },
      Quote: {
        type: "object",
        properties: {
          quoteId: { type: "string" },
          listingId: { type: "string" },
          listingName: { type: "string" },
          listingUrl: { type: "string", format: "uri" },
          checkIn: { type: "string", format: "date" },
          checkOut: { type: "string", format: "date" },
          nights: { type: "integer" },
          guests: { type: "integer" },
          currency: { type: "string" },
          price: {
            type: "object",
            description:
              "Every member reconciles: accommodation + cleaning + taxes = total. There is deliberately no per-night breakdown here — the published nightly rates do not sum to the accommodation fare, so showing both would contradict each other. Use the availability endpoint for per-night rates, and treat those as indicative.",
            required: ["accommodation", "cleaning", "taxes", "total"],
            properties: {
              accommodation: {
                type: "number",
                description: "Accommodation fare, after any discount.",
              },
              accommodationBeforeDiscount: {
                type: "number",
                description:
                  "The fare before a promotion was applied. Present only when one was.",
              },
              discount: {
                type: "number",
                description:
                  "Amount taken off the fare by a promotion. Present only when one applied — worth telling the traveller about.",
              },
              cleaning: { type: "number" },
              taxes: { type: "number" },
              total: {
                type: "number",
                description: "The amount payable.",
              },
            },
          },
          expiresAt: {
            type: "string",
            format: "date-time",
            description:
              "When this quote stops being valid — 24 hours after creation. Omitted only in the unexpected case that the upstream system returns no expiry; treat an absent value as unknown, never as 'does not expire'.",
          },
          expiresInSeconds: { type: "integer", minimum: 0 },
          checkoutUrl: {
            type: "string",
            format: "uri",
            description:
              "Give this to the traveller. Do not fetch it yourself; it is a human checkout page and payment happens there.",
          },
          terms: { $ref: "#/components/schemas/QuoteTerms" },
        },
      },
      Listing: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          url: {
            type: "string",
            format: "uri",
            description: "Where a guest completes a booking.",
          },
          propertyType: { type: ["string", "null"] },
          bedrooms: { type: ["integer", "null"] },
          bathrooms: { type: ["number", "null"] },
          beds: { type: ["integer", "null"] },
          maxGuests: { type: ["integer", "null"] },
          location: {
            type: "object",
            properties: {
              city: { type: ["string", "null"] },
              state: { type: ["string", "null"] },
              postalCode: { type: ["string", "null"] },
              country: { type: ["string", "null"] },
              latitude: { type: ["number", "null"] },
              longitude: { type: ["number", "null"] },
            },
          },
          building: {
            type: ["object", "null"],
            description:
              "Set when the unit sits in one of our managed buildings.",
            properties: {
              name: { type: "string" },
              url: { type: "string", format: "uri" },
            },
          },
          amenities: { type: "array", items: { type: "string" } },
          checkInTime: { type: ["string", "null"] },
          checkOutTime: { type: ["string", "null"] },
          photo: { type: ["string", "null"], format: "uri" },
        },
      },
      StaySummary: {
        type: "object",
        properties: {
          checkIn: { type: "string", format: "date" },
          checkOut: { type: "string", format: "date" },
          nights: { type: "integer" },
          nightlyTotal: {
            type: "number",
            description:
              "Accommodation only for the whole stay. NOT the amount payable.",
          },
          averageNightly: { type: "number" },
          currency: { type: "string" },
          minimumStay: { type: ["integer", "null"] },
        },
      },
      SearchResponse: {
        type: "object",
        properties: {
          query: { type: "object" },
          resultCount: { type: "integer" },
          pricing: { $ref: "#/components/schemas/PricingDisclosure" },
          results: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/Listing" },
                {
                  type: "object",
                  properties: {
                    stay: { $ref: "#/components/schemas/StaySummary" },
                  },
                },
              ],
            },
          },
        },
      },
      AvailabilityResponse: {
        type: "object",
        properties: {
          listingId: { type: "string" },
          listingUrl: { type: "string", format: "uri" },
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
          dayCount: { type: "integer" },
          pricing: { $ref: "#/components/schemas/PricingDisclosure" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", format: "date" },
                available: { type: "boolean" },
                nightlyRate: { type: ["number", "null"] },
                minimumStay: { type: ["integer", "null"] },
                closedToArrival: { type: "boolean" },
                closedToDeparture: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=86400",
      "access-control-allow-origin": "*",
    },
  });
}
