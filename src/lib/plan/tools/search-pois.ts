// src/lib/plan/tools/search-pois.ts
import { tool } from "ai";
import { z } from "zod";
import { searchPois } from "@/lib/pois/queries";
import {
  POI_CATEGORIES,
  POI_PARTY_TYPES,
  POI_TAGS,
  POI_TIME_SLOTS,
} from "@/lib/pois/types";
import { findFavoriteForPoi } from "@/lib/plan/favorites";

export const searchPoisTool = tool({
  description:
    "Search the curated Book Traverse POI catalog for real Colorado mountain-town places (restaurants, coffee, bars, parks, trails, activities, etc) across Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes. Returns POIs with stable ids that must be referenced in any itinerary you generate. Use this for every place you want to recommend.",
  inputSchema: z.object({
    neighborhoods: z
      .array(z.string())
      .optional()
      .describe(
        "Neighborhood / town slugs to filter by (e.g. 'crested-butte', 'mt-crested-butte', 'leadville-downtown', 'vail-village', 'avon', 'granby', 'twin-lakes'). Omit to search across all Colorado markets."
      ),
    category: z
      .enum(POI_CATEGORIES)
      .optional()
      .describe("Filter by a single category"),
    tags: z
      .array(z.enum(POI_TAGS))
      .optional()
      .describe(
        "Filter by controlled vocab tags. ANY match passes (OR, not AND). Pick 1-3 tags — too many filters everything out."
      ),
    timeSlot: z
      .enum(POI_TIME_SLOTS)
      .optional()
      .describe("Filter for places that work for this time of day"),
    partyType: z
      .enum(POI_PARTY_TYPES)
      .optional()
      .describe("Filter for places that suit this party type"),
    query: z
      .string()
      .optional()
      .describe(
        "Free-text substring match against POI name + description (case-insensitive). Use for cuisines or attributes that aren't in the tag vocab — e.g. 'italian', 'thai', 'pizza', 'natural wine'. Single word or short phrase."
      ),
    includeDayTrips: z
      .boolean()
      .optional()
      .describe(
        "Set to true ONLY when the user explicitly asks about day trips from their anchor market (e.g. Aspen from Leadville, Glenwood Springs from Vail, RMNP from Granby, Black Canyon of the Gunnison from Crested Butte). Default false — generic queries should stay within the anchor market."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(10)
      .describe("Max results to return (default 10)"),
  }),
  execute: async (input) => {
    const userLimit = input.limit ?? 10;
    // Cast a wider net than the user-requested limit so any matching favorite
    // is in the candidate pool before we sort-and-truncate. Without this, a
    // favorite that's alphabetically past the DB cutoff never surfaces.
    const searchBudget = Math.max(userLimit * 3, 30);

    const results = await searchPois({
      neighborhoods: input.neighborhoods,
      category: input.category,
      tags: input.tags,
      timeSlot: input.timeSlot,
      partyType: input.partyType,
      query: input.query,
      includeDayTrips: input.includeDayTrips,
      limit: searchBudget,
    });

    // Tag each result with its favorite match (if any), then sort favorites
    // to the top — same filter already passed, so the favorite is eligible
    // on vibe/geography. Alphabetical within each tier preserves stability.
    const tagged = results.map((p) => ({
      poi: p,
      favorite: findFavoriteForPoi({ id: p.id, name: p.name }),
    }));
    tagged.sort((a, b) => {
      const aRank = a.favorite ? 0 : 1;
      const bRank = b.favorite ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.poi.name.localeCompare(b.poi.name);
    });
    const top = tagged.slice(0, userLimit);

    // Trim output to the fields the model actually needs to reason about.
    // Full rows carry photo_url, hours_summary, etc — the client re-hydrates
    // those from sp_pois after generate_itinerary returns.
    return {
      count: top.length,
      pois: top.map(({ poi: p, favorite }) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        neighborhood: p.neighborhood,
        description: p.description,
        address: p.address,
        tags: p.tags,
        timeSlots: p.timeSlots,
        partyTypes: p.partyTypes,
        priceLevel: p.priceLevel,
        ...(favorite && {
          favorite: {
            orderThis: favorite.orderThis,
            note: favorite.note,
          },
        }),
      })),
    };
  },
});
