// src/lib/plan/tools/search-listings.ts
// Hits Guesty BEAPI with real dates + guest count for authoritative
// availability. Every listing returned is actually bookable for the window
// the user described. The agent calls this once it knows dates + party and
// includes the top ids in the itinerary's availableListingIds field so the
// UI sidebar renders them.

import { tool } from "ai";
import { z } from "zod";
import { searchListings as beapiSearchListings } from "@/lib/guesty-beapi";

// Shape of the BEAPI response we care about.
interface BeapiListingResult {
  id?: string;
  _id?: string;
  title?: string;
  nickname?: string;
  bedrooms?: number;
  accommodates?: number;
  propertyType?: string;
  tags?: string[];
}

interface BeapiSearchResponse {
  results?: BeapiListingResult[];
  listings?: BeapiListingResult[];
}

export const searchListingsTool = tool({
  description:
    "Check real-time availability of Book Traverse vacation rentals for specific dates + group size. This hits Guesty's booking API directly, so every result is actually bookable for the window you pass. Call this EXACTLY ONCE during the planning phase, after you know the user's dates and party size, and pass the top listing ids into generate_itinerary's availableListingIds field. If the user has not given specific dates, do NOT call this tool — the sidebar will fall back to generic party-size matches.",
  inputSchema: z.object({
    checkIn: z
      .string()
      .describe("ISO date (YYYY-MM-DD) for the first night of the stay"),
    checkOut: z
      .string()
      .describe("ISO date (YYYY-MM-DD) for the morning the guests leave"),
    guests: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Total number of guests (adults + kids)"),
    bedrooms: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Minimum bedroom count, if the user stated a preference"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(6)
      .describe("Max results to fetch from BEAPI (default 6)"),
  }),
  execute: async (input) => {
    try {
      const raw = (await beapiSearchListings({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        minOccupancy: input.guests,
        numberOfBedrooms: input.bedrooms,
        limit: input.limit ?? 6,
      })) as BeapiSearchResponse;

      const items = raw.results ?? raw.listings ?? [];

      return {
        count: items.length,
        available: items.map((l) => ({
          id: l.id ?? l._id ?? "",
          title: l.title ?? l.nickname ?? "",
          bedrooms: l.bedrooms ?? null,
          accommodates: l.accommodates ?? null,
          propertyType: l.propertyType ?? null,
          tags: l.tags ?? [],
        })),
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
      };
    } catch (e) {
      return {
        error: (e as Error).message,
        count: 0,
        available: [],
      };
    }
  },
});
