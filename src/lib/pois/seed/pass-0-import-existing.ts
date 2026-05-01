// src/lib/pois/seed/pass-0-import-existing.ts
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { POIS } from "@/lib/portland-pois";
import { slugify } from "../normalize";
import type { PoiCategory } from "../types";

const LEGACY_CATEGORY_MAP: Record<string, PoiCategory> = {
  dining: "restaurant",
  coffee: "coffee",
  parks: "park",
  shopping: "shop",
  transit: "transit",
  attractions: "activity",
};

export function mapLegacyCategory(legacy: string): PoiCategory {
  const mapped = LEGACY_CATEGORY_MAP[legacy];
  if (!mapped) throw new Error(`Unknown legacy category: ${legacy}`);
  return mapped;
}

interface LegacyPoi {
  name: string;
  lat: number;
  lng: number;
  category: string;
}

export function toSeedRow(legacy: LegacyPoi) {
  return {
    id: slugify(legacy.name),
    name: legacy.name,
    category: mapLegacyCategory(legacy.category),
    neighborhood: "unknown",
    description: "Imported from legacy POI list — needs review.",
    address: "Portland, OR",
    lat: legacy.lat,
    lng: legacy.lng,
    tags: [] as string[],
    time_slots: [] as string[],
    party_types: [] as string[],
    price_level: null,
    hours_summary: null,
    photo_url: null,
    source_url: null,
    source_guide_slug: null,
    status: "draft" as const,
  };
}

/**
 * Inserts (or updates on conflict) all legacy POIs into sp_pois with status='draft'.
 * Returns the number of rows affected.
 */
export async function runPass0(): Promise<number> {
  const rows = POIS.map((poi) => toSeedRow(poi));

  // Upsert in batches of 100 to stay under PostgREST payload limits
  let total = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error, count } = await getSupabaseAdmin()
      .from("sp_pois")
      .upsert(batch, { onConflict: "id", count: "exact" });
    if (error) throw new Error(`Pass 0 upsert failed: ${error.message}`);
    total += count ?? batch.length;
  }
  return total;
}
