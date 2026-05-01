// src/lib/plan/validate-itinerary.ts
// After the agent calls generate_itinerary, we re-parse the tool call input,
// confirm every poiId is a real sp_pois row, and hydrate the output with the
// full POI data so the client can render without a round-trip.

import { getPoisByIds } from "@/lib/pois/queries";
import {
  ItinerarySchema,
  type HydratedItinerary,
  type Itinerary,
} from "./schema";
import type { Poi } from "@/lib/pois/types";
import { sanitizePoiForClient } from "./poi-photo";

export type ValidationResult =
  | { ok: true; itinerary: HydratedItinerary }
  | { ok: false; error: string; missingIds?: string[] };

export async function validateAndHydrate(
  raw: unknown
): Promise<ValidationResult> {
  const parsed = ItinerarySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `itinerary failed schema validation: ${parsed.error.message}`,
    };
  }

  const itinerary: Itinerary = parsed.data;

  // Collect every poiId referenced across all days
  const allIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const item of day.items) {
      allIds.add(item.poiId);
    }
  }

  if (allIds.size === 0) {
    return { ok: false, error: "itinerary has no POI items" };
  }

  const fetched = await getPoisByIds([...allIds]);
  const poiById = new Map<string, Poi>(fetched.map((p) => [p.id, p]));

  const missing = [...allIds].filter((id) => !poiById.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `itinerary references POI ids that don't exist in sp_pois: ${missing.join(", ")}`,
      missingIds: missing,
    };
  }

  const hydrated: HydratedItinerary = {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        poi: sanitizePoiForClient(poiById.get(item.poiId)!),
      })),
    })),
  };

  return { ok: true, itinerary: hydrated };
}
