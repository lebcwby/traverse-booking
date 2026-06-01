// src/lib/plan/tools/generate-itinerary.ts
// Terminal tool: when the agent calls this, it's committing to an itinerary
// and the client renders the result from this tool's OUTPUT (not input).
//
// Single responsibility: validate every poiId references a real sp_pois row
// and return the itinerary. Rental matching (BEAPI availability + listings
// hydration + quality ranking + neighborhood boost) runs OUT-OF-BAND on the
// client via /api/plan/listings so the agent turn can finish as soon as the
// itinerary JSON is complete — typical refinement turns dropped from
// 45-90s to 20-30s after this split.
//
// The sidebar's fetch is keyed on the itinerary contents (dates + POIs), so
// rentals appear ~2-4s after the itinerary paints instead of blocking the
// whole tool return behind BEAPI's 1-3s per date range.

import { tool } from "ai";
import { getPoisByIds } from "@/lib/pois/queries";
import type { Poi } from "@/lib/pois/types";
import { ItinerarySchema, type Itinerary } from "../schema";

async function validateAndLoadPois(itinerary: Itinerary): Promise<Itinerary> {
  const referencedIds = new Set<string>();
  for (const day of itinerary.days) {
    for (const item of day.items) {
      referencedIds.add(item.poiId);
    }
  }
  if (referencedIds.size === 0) {
    throw new Error("itinerary has no POI items — retry with search_pois");
  }

  const pois: Poi[] = await getPoisByIds([...referencedIds]);
  const validIds = new Set(pois.map((p) => p.id));

  const cleanedDays = itinerary.days.map((day) => ({
    ...day,
    items: day.items.filter((item) => validIds.has(item.poiId)),
  }));

  const emptyDays = cleanedDays.filter((d) => d.items.length === 0);
  if (emptyDays.length > 0) {
    const badIds = [...referencedIds].filter((id) => !validIds.has(id));
    throw new Error(
      `itinerary contains ${badIds.length} poiIds that don't exist in sp_pois: ${badIds
        .slice(0, 5)
        .join(
          ", "
        )}. Only use ids returned from search_pois in the same conversation, then retry generate_itinerary.`
    );
  }

  // Lunch enforcement: each midday slot needs to include a restaurant. The
  // system prompt requires "ONE lunch (category=restaurant)" at midday and
  // the schema requires at least one midday item, but Haiku has been known
  // to fill midday with only an activity and skip lunch entirely. Catch
  // that here so the agent retries instead of returning a lunch-less day.
  const poiById = new Map(pois.map((p) => [p.id, p]));
  const lunchlessDays = cleanedDays.filter((day) => {
    const middayItems = day.items.filter(
      (item) => item.timeSlot === "midday"
    );
    return !middayItems.some(
      (item) => poiById.get(item.poiId)?.category === "restaurant"
    );
  });
  if (lunchlessDays.length > 0) {
    const dayNumbers = lunchlessDays.map((d) => d.dayNumber).join(", ");
    throw new Error(
      `Day(s) ${dayNumbers} are missing a lunch — every day must have one midday item whose POI category is "restaurant". Call search_pois for restaurants in the right town/neighborhood, then re-emit generate_itinerary with a lunch added at the midday slot for each flagged day.`
    );
  }

  return { ...itinerary, days: cleanedDays };
}

export const generateItineraryTool = tool({
  description:
    "EMIT the final day-by-day itinerary. Call this EXACTLY ONCE when you have enough information from the user. Every poiId must reference a real id returned from a prior search_pois call in this conversation — inventing ids will cause the tool to fail. Leave availableListings empty — the server selects rentals from the itinerary dates out-of-band. After calling this, the conversation is effectively done: do not send any more text.",
  inputSchema: ItinerarySchema,
  execute: async (input) => {
    const validated = await validateAndLoadPois(input as Itinerary);
    return { ok: true, itinerary: validated };
  },
});
