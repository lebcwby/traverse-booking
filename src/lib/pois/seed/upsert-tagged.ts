// src/lib/pois/seed/upsert-tagged.ts
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "../normalize";
import type { TaggedPoi } from "./pass-3-tag";

export async function upsertTagged(tagged: TaggedPoi[]): Promise<number> {
  if (tagged.length === 0) return 0;

  // Build the full row list, then dedupe by primary key (id). Duplicates happen
  // when two tagged POIs slugify to the same id — e.g. multiple branches of the
  // same restaurant, or the same place mentioned in two neighborhood pages
  // where Claude assigned both to the same neighborhood slug. Postgres rejects
  // an upsert batch with duplicate conflict-target rows ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time"), so we collapse before sending.
  // Keep-first policy: the first occurrence wins, later duplicates are dropped.
  // Places that are genuinely different but collide should be disambiguated
  // in a later pass by inspecting placesId.
  const seenIds = new Set<string>();
  const rows: Array<ReturnType<typeof toRow>> = [];
  let duplicatesDropped = 0;

  function toRow(p: TaggedPoi) {
    return {
      id: slugify(
        p.resolvedName,
        p.neighborhood !== "other" ? p.neighborhood : undefined
      ),
      name: p.resolvedName,
      category: p.category,
      neighborhood: p.neighborhood,
      description: p.description,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      tags: p.tags,
      time_slots: p.timeSlots,
      party_types: p.partyTypes,
      price_level: p.priceLevel,
      hours_summary: p.hoursSummary,
      photo_url: p.photoUrl,
      source_url: null,
      source_guide_slug: p.sourceGuideSlug,
      status: "active" as const, // Pass 3 output is high-confidence enough to go live
    };
  }

  for (const p of tagged) {
    const row = toRow(p);
    if (seenIds.has(row.id)) {
      duplicatesDropped++;
      continue;
    }
    seenIds.add(row.id);
    rows.push(row);
  }

  if (duplicatesDropped > 0) {
    console.warn(
      `[upsertTagged] dropped ${duplicatesDropped} duplicate-id rows before upsert`
    );
  }

  let total = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error, count } = await getSupabaseAdmin()
      .from("sp_pois")
      .upsert(batch, { onConflict: "id", count: "exact" });
    if (error) throw new Error(`upsertTagged failed: ${error.message}`);
    total += count ?? batch.length;
  }
  return total;
}
