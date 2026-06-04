/**
 * Exercise the Drive image picker for a single calendar slug without
 * touching Claude generation or GitHub. Cheap + fast iteration loop.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/test-image-picker.ts what-to-pack-colorado-mountain-trip
 */

import { CONTENT_CALENDAR } from "../src/lib/blog-automation/calendar";
import { pickImageForEntry } from "../src/lib/blog-automation/image-picker";

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: test-image-picker <slug>");
    process.exit(1);
  }
  const entry = CONTENT_CALENDAR.find((e) => e.slug === slug);
  if (!entry) {
    console.error(`unknown slug: ${slug}`);
    process.exit(1);
  }
  console.log(`Picking image for: ${entry.title}`);
  console.log(`  market: ${entry.market}`);
  console.log(`  brief:  ${entry.brief.slice(0, 120)}…`);
  console.log("");

  const result = await pickImageForEntry(entry);
  if (!result) {
    console.log("✗ picker returned null");
    process.exit(1);
  }
  console.log("✓ picked:");
  console.log(`  sourceName:   ${result.sourceName}`);
  console.log(`  sourceFolder: ${result.sourceFolder}`);
  console.log(`  repoPath:     ${result.repoPath}`);
  console.log(`  publicUrl:    ${result.publicUrl}`);
  console.log(`  mimeType:     ${result.mimeType}`);
  console.log(`  base64 size:  ${result.contentBase64.length} chars (~${Math.round(result.contentBase64.length * 0.75 / 1024)} KB binary)`);
  console.log(`  reason:       ${result.reason}`);
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
