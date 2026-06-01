// src/lib/plan/tools/get-neighborhood.ts
import { tool } from "ai";
import { z } from "zod";
import { getAuthAdmin } from "@/lib/supabase-auth-admin";

export const getNeighborhoodTool = tool({
  description:
    "Get background info on a Colorado neighborhood or market (vibe, walkability, highlights, nearby attractions). Use this when the user asks about a specific area or when deciding where to anchor a trip.",
  inputSchema: z.object({
    slug: z
      .string()
      .describe(
        "Neighborhood / market slug like 'crested-butte', 'mt-crested-butte', 'leadville-downtown', 'vail-village', 'avon', 'granby', 'twin-lakes'."
      ),
  }),
  execute: async (input) => {
    try {
      const { data, error } = await getAuthAdmin()
        .from("seo_neighborhood_pages")
        .select(
          "slug, neighborhood_name, headline, intro_content_markdown, highlights, nearby_attractions"
        )
        .eq("slug", input.slug)
        .eq("status", "published")
        .maybeSingle();

      if (error) {
        return { error: error.message, found: false };
      }
      if (!data) {
        return {
          found: false,
          hint: "No seo_neighborhood_pages row for that slug. Try calling search_pois with neighborhoods: [slug] to see what's in the POI catalog.",
        };
      }

      const row = data as {
        slug: string;
        neighborhood_name: string;
        headline: string;
        intro_content_markdown: string | null;
        highlights: Array<{ label: string; description: string }> | null;
        nearby_attractions: string[] | null;
      };

      return {
        found: true,
        slug: row.slug,
        name: row.neighborhood_name,
        headline: row.headline,
        // Trim intro to first 800 chars so it doesn't blow up the context
        intro: row.intro_content_markdown?.slice(0, 800) ?? null,
        highlights: row.highlights ?? [],
        nearbyAttractions: row.nearby_attractions ?? [],
      };
    } catch (e) {
      return { error: (e as Error).message, found: false };
    }
  },
});
