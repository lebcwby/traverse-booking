#!/usr/bin/env tsx
// scripts/seed-pois.ts
// Orchestrates the 5-pass POI seeding pipeline.
// Run: npm run seed-pois -- [--skip-pass-0] [--skip-pass-1] [--skip-pass-2] [--skip-pass-3] [--skip-pass-4]

import { runPass0 } from "@/lib/pois/seed/pass-0-import-existing";
import { runPass1 } from "@/lib/pois/seed/pass-1-extract";
import { runPass2 } from "@/lib/pois/seed/pass-2-geocode";
import { runPass3 } from "@/lib/pois/seed/pass-3-tag";
import { runPass4 } from "@/lib/pois/seed/pass-4-csv-import";
import { upsertTagged } from "@/lib/pois/seed/upsert-tagged";

interface Flags {
  skipPass0: boolean;
  skipPass1: boolean;
  skipPass2: boolean;
  skipPass3: boolean;
  skipPass4: boolean;
}

function parseFlags(argv: string[]): Flags {
  return {
    skipPass0: argv.includes("--skip-pass-0"),
    skipPass1: argv.includes("--skip-pass-1"),
    skipPass2: argv.includes("--skip-pass-2"),
    skipPass3: argv.includes("--skip-pass-3"),
    skipPass4: argv.includes("--skip-pass-4"),
  };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  console.log("[seed-pois] starting", flags);

  if (!flags.skipPass0) {
    console.log("\n=== Pass 0: import existing portland-pois.ts ===");
    const count = await runPass0();
    console.log(
      `[seed-pois] Pass 0 done: ${count} legacy POIs imported as drafts`
    );
  }

  if (!flags.skipPass1) {
    console.log("\n=== Pass 1: extract from auth-DB SEO content ===");
    const { candidates } = await runPass1();
    console.log(`[seed-pois] Pass 1 done: ${candidates.length} candidates`);
  }

  if (!flags.skipPass2) {
    console.log("\n=== Pass 2: Google Places enrichment ===");
    const { enriched, misses } = await runPass2();
    console.log(
      `[seed-pois] Pass 2 done: ${enriched.length} enriched, ${misses.length} missed`
    );
  }

  if (!flags.skipPass3) {
    console.log("\n=== Pass 3: Claude tagging ===");
    const { tagged } = await runPass3();
    const upserted = await upsertTagged(tagged);
    console.log(
      `[seed-pois] Pass 3 done: ${tagged.length} tagged, ${upserted} upserted as active`
    );
  }

  if (!flags.skipPass4) {
    console.log("\n=== Pass 4: CSV manual import ===");
    const count = await runPass4();
    console.log(
      `[seed-pois] Pass 4 done: ${count} CSV rows imported as drafts`
    );
  }

  console.log("\n[seed-pois] complete ✓");
}

main().catch((e) => {
  console.error("[seed-pois] FAILED:", e);
  process.exit(1);
});
