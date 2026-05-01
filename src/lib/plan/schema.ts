// src/lib/plan/schema.ts
// Zod schema for the structured itinerary output of the AI trip planner.
// Emitted by the agent's terminal `generate_itinerary` tool, validated by
// the Vercel AI SDK, then post-validated by validate-itinerary.ts to ensure
// every poiId is a real row in sp_pois.

import { z } from "zod";

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD");

export const TimeSlotSchema = z.enum([
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
]);
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const VibeSchema = z.enum(["chill", "balanced", "packed"]);
export type Vibe = z.infer<typeof VibeSchema>;

export const ItineraryPartySchema = z.object({
  adults: z.number().int().min(1).max(20),
  kids: z.number().int().min(0).max(20).optional(),
  vibe: VibeSchema,
});

export const ItineraryDatesSchema = z.object({
  checkIn: IsoDateSchema.describe("ISO date YYYY-MM-DD — may be tentative"),
  checkOut: IsoDateSchema.describe("ISO date YYYY-MM-DD"),
  nights: z.number().int().min(1).max(60),
  isTentative: z
    .boolean()
    .describe("true when the user didn't give specific dates"),
});

export const ItineraryItemSchema = z.object({
  poiId: z
    .string()
    .describe(
      "Stable slug from sp_pois.id. MUST be an id returned by search_pois — never invented."
    ),
  timeSlot: TimeSlotSchema,
  reason: z
    .string()
    .describe(
      "1-2 sentences, friendly concierge voice, explaining why this stop fits the trip."
    ),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(240)
    .describe(
      "How many minutes this stop takes. Required. Typical: coffee 20-30, breakfast 45-75, lunch 60-90, casual activity 45-75, substantial activity 90-150, dinner 75-120, late drinks 60-120."
    ),
});

export const ItineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  label: z
    .string()
    .describe("Short header like 'Friday — arrive & explore the Pearl'"),
  items: z.array(ItineraryItemSchema).min(2),
});

export const ItinerarySchema = z.object({
  title: z.string().describe("Headline for the trip, ~6-10 words"),
  summary: z
    .string()
    .describe("1-2 sentence overview of what kind of trip this is"),
  party: ItineraryPartySchema,
  dates: ItineraryDatesSchema,
  anchorNeighborhood: z
    .string()
    .optional()
    .describe(
      "Slug of the neighborhood the trip centers on. Used to recommend matching properties."
    ),
  alternateDateRanges: z
    .array(
      z.object({
        checkIn: IsoDateSchema,
        checkOut: IsoDateSchema,
      })
    )
    .max(4)
    .optional()
    .describe(
      "When the user gives a broad window like 'a weekend in July' or 'sometime in the fall', populate this with up to 4 candidate date ranges that fit the window. The server will check availability across the primary dates + these alternates and return 1 confirmed listing per range in availableListings (up to 5 total). Leave empty when the user gave specific dates."
    ),
  availableListings: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        checkIn: IsoDateSchema,
        checkOut: IsoDateSchema,
      })
    )
    .max(5)
    .optional()
    .describe(
      "Filled in server-side by the generate_itinerary handler. Each entry is a Book Traverse vacation rental confirmed bookable for its specific checkIn/checkOut range. Do not populate this yourself — leave it empty and the server will fetch it."
    ),
  days: z.array(ItineraryDaySchema).min(1),
  notes: z
    .array(z.string())
    .optional()
    .describe(
      'Optional practical tips: weather, parking, reservations, etc. IMPORTANT: emit each tip as a SEPARATE array element — one tip per string. Do NOT concatenate multiple tips into a single long string. Typical length: 3-6 short tips, each 1-2 sentences max. Example: ["May weather is mild — bring layers.", "Apizza Scholls fills up fast — arrive early.", "Gorge drive gets busy on weekends — head back by mid-afternoon."]'
    ),
});

export type Itinerary = z.infer<typeof ItinerarySchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

// Hydrated variant: after server-side validation, each item includes the
// full Poi row so the client can render without another round-trip.
import type { Poi } from "@/lib/pois/types";

export interface HydratedItineraryItem extends ItineraryItem {
  poi: Poi;
}

export interface HydratedItineraryDay extends Omit<ItineraryDay, "items"> {
  items: HydratedItineraryItem[];
}

export interface HydratedItinerary extends Omit<Itinerary, "days"> {
  days: HydratedItineraryDay[];
}
