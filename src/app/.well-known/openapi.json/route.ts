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
      "Read-only access to Traverse Hospitality's portfolio of vacation rentals across six Colorado mountain markets.\n\n" +
      "**Pricing returned here is indicative and accommodation-only.** It excludes cleaning fees, taxes, pet fees and optional extras, and comes from a cache refreshed roughly every five hours. The all-in total a guest pays is computed live at checkout, which is authoritative. Do not present these figures to a traveller as the price they will be charged — present them as a starting estimate and link to the listing to complete a booking.\n\n" +
      "Availability is cached on the same cycle and re-validated at checkout. A listing returned as available is very likely bookable but not guaranteed.\n\n" +
      "There is no write access and no payment capability. Bookings are completed by the guest on the listing page.",
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
          "Always present alongside any figure. Read it before quoting a price to a traveller.",
        properties: {
          priceBasis: { type: "string", const: "accommodation-only" },
          excludes: { type: "array", items: { type: "string" } },
          authoritative: { type: "boolean", const: false },
          note: { type: "string" },
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
