#!/usr/bin/env tsx
// scripts/backfill-poi-photos.ts
// One-off backfill for sp_pois rows missing photo_url. Queries Google Places
// for each row using a neighborhood-aware location bias (so Cannon Beach POIs
// don't get matched against Portland), takes the first photo, and updates the
// row via photoUrl() — same shape as the existing seeder.
//
// Dry-run by default. Pass --apply to actually write updates.
//
//   npx tsx scripts/backfill-poi-photos.ts           # dry run
//   npx tsx scripts/backfill-poi-photos.ts --apply   # write updates

import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
// google-places.ts reads GOOGLE_PLACES_API_KEY inside its functions at call
// time, so a static import here is safe even though we load env vars below.
import { searchPlace, photoUrl } from "../src/lib/pois/seed/google-places";

// dotenv handles quoted values, escapes, and comments properly — our previous
// hand-rolled parser left literal quotes in place and broke the Supabase URL.
loadDotenv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
  );
}
if (!process.env.GOOGLE_PLACES_API_KEY) {
  throw new Error("GOOGLE_PLACES_API_KEY must be set in .env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Neighborhood slug → Google Places location bias. Accuracy matters because
// "Haystack Rock" in a Portland-biased search lands on random unrelated hits.
const LOCATION_BIAS: Record<string, string> = {
  // Oregon (legacy)
  astoria: "Astoria, Oregon",
  cannon_beach: "Cannon Beach, Oregon",
  carlton: "Carlton, Oregon",
  columbia_gorge: "Columbia River Gorge, Oregon",
  dundee: "Dundee, Oregon",
  hood_river: "Hood River, Oregon",
  mcminnville: "McMinnville, Oregon",
  mt_hood: "Mount Hood, Oregon",
  seaside: "Seaside, Oregon",
  tillamook: "Tillamook, Oregon",
  turner: "Turner, Oregon",
  // Colorado — Crested Butte
  crested_butte: "Crested Butte, Colorado",
  mt_crested_butte: "Mt. Crested Butte, Colorado",
  kebler_pass: "Kebler Pass, Crested Butte, Colorado",
  gothic: "Gothic, Crested Butte, Colorado",
  almont: "Almont, Colorado",
  washington_gulch: "Washington Gulch, Crested Butte, Colorado",
  elk_range: "Elk Range, Crested Butte, Colorado",
  ohio_city: "Ohio City, Colorado",
  // Colorado — Leadville
  leadville: "Leadville, Colorado",
  tennessee_pass: "Tennessee Pass, Leadville, Colorado",
  san_isabel_nf: "San Isabel National Forest, Colorado",
  twin_lakes: "Twin Lakes, Colorado",
  buena_vista: "Buena Vista, Colorado",
  lake_county: "Lake County, Colorado",
};

function biasFor(neighborhood: string | null): string {
  if (!neighborhood) return "Colorado";
  return LOCATION_BIAS[neighborhood] ?? "Colorado";
}

interface PoiRow {
  id: string;
  name: string;
  neighborhood: string | null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  // --refresh re-fetches EVERY active POI, not just those missing a photo. Use
  // it when the stored Google Places photo references have gone stale (Places
  // (New) references expire — Google then returns 400 "photo resource invalid").
  const refresh = process.argv.includes("--refresh");
  console.log(
    `[backfill-poi-photos] mode=${apply ? "APPLY" : "dry-run (pass --apply to write)"}` +
      `${refresh ? " | refresh=ALL active rows" : " | only rows missing photo_url"}`
  );

  let query = supabase
    .from("sp_pois")
    .select("id, name, neighborhood")
    .eq("status", "active");
  if (!refresh) query = query.is("photo_url", null);
  const { data: rows, error } = await query.order("neighborhood", {
    ascending: true,
  });

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("[backfill-poi-photos] no matching active rows");
    return;
  }

  console.log(`[backfill-poi-photos] ${rows.length} rows to process\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows as PoiRow[]) {
    const bias = biasFor(row.neighborhood);
    try {
      const place = await searchPlace(row.name, bias);
      const photoName = place?.photos?.[0]?.name;

      if (!photoName) {
        console.log(
          `  SKIP  ${row.id}  "${row.name}"  (no photo in Places result)`
        );
        skipped += 1;
      } else {
        const url = photoUrl(photoName);
        console.log(
          `  ${apply ? "WRITE" : "WOULD"}  ${row.id}  "${row.name}"  [${bias}]`
        );

        if (apply) {
          const { error: upErr } = await supabase
            .from("sp_pois")
            .update({ photo_url: url })
            .eq("id", row.id);
          if (upErr) {
            console.log(`  FAIL   ${row.id}  update error: ${upErr.message}`);
            failed += 1;
            continue;
          }
        }
        updated += 1;
      }
    } catch (err) {
      console.log(
        `  FAIL  ${row.id}  "${row.name}"  ${(err as Error).message}`
      );
      failed += 1;
    }

    // 200ms spacing = 5 req/sec, well under Places API quotas.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(
    `\n[backfill-poi-photos] done — ${apply ? "updated" : "would update"}: ${updated}, skipped: ${skipped}, failed: ${failed}`
  );
}

main().catch((err) => {
  console.error("[backfill-poi-photos] fatal:", err);
  process.exit(1);
});
