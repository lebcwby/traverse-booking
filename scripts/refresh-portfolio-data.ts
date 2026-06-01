/**
 * Quarterly portfolio refresh.
 *
 * Run this on Feb 1 / May 1 / Aug 1 / Nov 1 to keep the property-management
 * page and building pages in sync with reality:
 *  1. Pull live listing counts per market from the Guesty BEAPI
 *  2. Pick the best exterior/feature photo for Vail, Granby, Twin Lakes
 *     and download to /public/property-management/markets/
 *  3. Rewrite src/lib/portfolio-stats.ts and sweep marketing copy in
 *     src/app/page.tsx + src/components/layout/footer.tsx
 *  4. Sweep Traverse-managed unit counts on the building pages
 *     (The Plaza, Grand Lodge, Lodge at Mountaineer Square) by pulling
 *     listing counts per BEAPI tag.
 *
 * Usage:
 *   npx tsx scripts/refresh-portfolio-data.ts            # apply changes
 *   npx tsx scripts/refresh-portfolio-data.ts --dry-run  # preview only
 *
 * Required env (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const PUBLIC_MARKETS_DIR = path.resolve(
  process.cwd(),
  "public/property-management/markets"
);
const STATS_FILE = path.resolve(process.cwd(), "src/lib/portfolio-stats.ts");

// Cities that map to a single image in the property-management page.
// Crested Butte, Leadville, and Avon use existing /public/markets/ photos
// (Avon was confirmed by the owner; CB + LV use brand market hero shots).
const PHOTO_REFRESH_CITIES = ["Vail", "Granby", "Twin Lakes"] as const;

// All markets we count listings for.
const ALL_CITIES = [
  "Crested Butte",
  "Leadville",
  "Vail",
  "Avon",
  "Granby",
  "Twin Lakes",
] as const;

// Lake County is included in Leadville's count per business policy.
const LAKE_COUNTY_INCLUDED_IN_LEADVILLE = true;

const EXTERIOR_KEYWORDS =
  /exterior|patio|deck|porch|balcon|outdoor|view|mountain|ski|hot tub|firepit|fire pit/i;

interface BeapiPicture {
  original: string;
  thumbnail?: string;
  caption?: string;
}

interface BeapiListing {
  _id: string;
  title?: string;
  nickname?: string;
  picture?: { thumbnail?: string; regular?: string; large?: string };
  pictures?: BeapiPicture[];
  address?: { city?: string };
}

async function getBeapiToken(): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await sb
    .from("guesty_tokens")
    .select("access_token, expires_at")
    .eq("token_type", "beapi")
    .single();
  if (error || !data) throw new Error(`Failed to load BEAPI token: ${error?.message}`);
  if (data.expires_at < Date.now()) {
    throw new Error(
      "BEAPI token in Supabase is expired. Trigger /api/cron/refresh-tokens first."
    );
  }
  return data.access_token;
}

async function fetchListingsForCity(
  token: string,
  city: string
): Promise<BeapiListing[]> {
  const url = new URL("https://booking.guesty.com/api/listings");
  url.searchParams.set("city", city);
  url.searchParams.set("country", "United States");
  url.searchParams.set("limit", "100");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`BEAPI ${city} ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { results?: BeapiListing[] };
  return j.results || [];
}

async function fetchListingDetail(
  token: string,
  id: string
): Promise<BeapiListing> {
  const r = await fetch(`https://booking.guesty.com/api/listings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`BEAPI listing ${id} ${r.status}`);
  return r.json();
}

function pickBestExteriorPhoto(listing: BeapiListing): string | null {
  const pics = listing.pictures || [];
  const exterior = pics.find((p) => EXTERIOR_KEYWORDS.test(p.caption || ""));
  if (exterior?.original) return exterior.original;
  // Fallback: first non-bedroom/bathroom photo
  const nonBedroom = pics.find(
    (p) => !/bedroom|bathroom|laundry|closet/i.test(p.caption || "")
  );
  if (nonBedroom?.original) return nonBedroom.original;
  return pics[0]?.original || listing.picture?.large || null;
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download ${url} ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(dest, buf);
}

function citySlug(city: string): string {
  return city.toLowerCase().replace(/\s+/g, "-");
}

function perMarketKey(city: string): string {
  // Map "Crested Butte" → "crestedButte", "Twin Lakes" → "twinLakes"
  return city
    .split(/\s+/)
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}

function formatCount(city: string, count: number): string {
  if (count === 0) return "Listings available";
  if (city === "Leadville" && LAKE_COUNTY_INCLUDED_IN_LEADVILLE) {
    return `${roundDown(count)}+ properties (incl. Lake County)`;
  }
  return `${roundDown(count)}+ properties`;
}

function roundDown(n: number): number {
  if (n < 10) return n;
  if (n < 100) return Math.floor(n / 10) * 10;
  return Math.floor(n / 50) * 50;
}

// Files outside portfolio-stats.ts that bake the total-listings count into
// human-facing copy. The script rewrites any "<digits>+" token that appears
// in the listed contexts (followed by one of the count-keyword words) so the
// rounded marketing number stays in sync with the precise BEAPI count.
const MARKETING_COPY_FILES = [
  path.resolve(process.cwd(), "src/app/page.tsx"),
  path.resolve(process.cwd(), "src/components/layout/footer.tsx"),
];
const MARKETING_COPY_KEYWORDS =
  /(homes|properties|rentals|stays|managed rentals|locally managed properties)/;

// Building pages that bake an exact Traverse-managed unit count into the
// content copy. Each entry lists the BEAPI tag to count by and the regex
// anchors to rewrite in the building's content.ts. Anchors must include a
// `(\d+)` capture group for the count digits.
interface BuildingSweep {
  name: string;
  tag: string;
  contentFile: string;
  anchors: RegExp[];
}
const BUILDING_SWEEPS: BuildingSweep[] = [
  {
    name: "The Plaza",
    tag: "The Plaza Crested Butte",
    contentFile: path.resolve(
      process.cwd(),
      "src/app/crested-butte/the-plaza/content.ts"
    ),
    anchors: [
      /<span class="fact-num">(\d+)<\/span><span class="fact-label">Traverse-managed/,
      /We manage (\d+) individually owned condos/,
      /View All (\d+) Plaza Units/,
      /(\d+) spacious condos for families/,
    ],
  },
  {
    name: "Grand Lodge",
    tag: "The Grand Lodge Crested Butte",
    contentFile: path.resolve(
      process.cwd(),
      "src/app/crested-butte/grand-lodge/content.ts"
    ),
    anchors: [/View All (\d+) Grand Lodge Units/],
  },
  {
    name: "Lodge at Mountaineer Square",
    tag: "The Lodge at Mountaineer Square",
    contentFile: path.resolve(
      process.cwd(),
      "src/app/crested-butte/lodge-at-mountaineer-square/content.ts"
    ),
    anchors: [/View All (\d+) Mountaineer Square Units/],
  },
];

async function fetchListingsForTag(
  token: string,
  tag: string
): Promise<BeapiListing[]> {
  const url = new URL("https://booking.guesty.com/api/listings");
  url.searchParams.set("tags", tag);
  url.searchParams.set("limit", "100");
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`BEAPI tag "${tag}" ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { results?: BeapiListing[] };
  return j.results || [];
}

async function rewriteBuildingContentFile(
  sweep: BuildingSweep,
  count: number
): Promise<{ path: string; before: string; after: string }> {
  const before = await fs.readFile(sweep.contentFile, "utf8");
  let after = before;
  for (const anchor of sweep.anchors) {
    after = after.replace(anchor, (match, _digits) =>
      match.replace(/\d+/, String(count))
    );
  }
  return { path: sweep.contentFile, before, after };
}

async function rewriteMarketingCopyFile(
  file: string,
  newCount: number
): Promise<{ path: string; before: string; after: string }> {
  const before = await fs.readFile(file, "utf8");
  const after = before.replace(
    /(\d+)\+(\s+|<\/strong>\s+|<\/strong>\s*<[^>]+>\s*)([A-Za-z][A-Za-z\s]*?)\b/g,
    (match, _digits, gap, word) => {
      if (!MARKETING_COPY_KEYWORDS.test(word)) return match;
      return `${newCount}+${gap}${word}`;
    }
  );
  return { path: file, before, after };
}

async function rewriteStatsFile(
  totals: { totalListings: number; perMarket: Record<string, string> }
): Promise<{ before: string; after: string }> {
  const before = await fs.readFile(STATS_FILE, "utf8");
  let after = before;
  // Update totalListings
  after = after.replace(
    /totalListings:\s*\d+,/,
    `totalListings: ${totals.totalListings},`
  );
  // Update perMarket entries
  for (const [key, value] of Object.entries(totals.perMarket)) {
    const re = new RegExp(`(${key}:\\s*)"[^"]*"`);
    after = after.replace(re, `$1"${value}"`);
  }
  // Update Last refreshed comment
  const today = new Date().toISOString().slice(0, 10);
  after = after.replace(/Last refreshed:\s*\d{4}-\d{2}-\d{2}/, `Last refreshed: ${today}`);
  return { before, after };
}

function diff(a: string, b: string): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const out: string[] = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) {
      if (aLines[i] !== undefined) out.push(`- ${aLines[i]}`);
      if (bLines[i] !== undefined) out.push(`+ ${bLines[i]}`);
    }
  }
  return out.join("\n") || "(no changes)";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🔄 Portfolio refresh${dryRun ? " (DRY RUN)" : ""}\n`);

  const token = await getBeapiToken();

  // 1. Counts per market
  const counts: Record<string, number> = {};
  let totalListings = 0;
  for (const city of ALL_CITIES) {
    const listings = await fetchListingsForCity(token, city);
    counts[city] = listings.length;
    totalListings += listings.length;
    console.log(`  ${city.padEnd(15)} ${listings.length} listings`);
  }
  console.log(`  ${"TOTAL".padEnd(15)} ${totalListings} listings\n`);

  // 2. Photos for the cities not covered by /public/markets/
  await fs.mkdir(PUBLIC_MARKETS_DIR, { recursive: true });
  for (const city of PHOTO_REFRESH_CITIES) {
    const listings = await fetchListingsForCity(token, city);
    if (listings.length === 0) {
      console.log(`  ⚠ ${city}: no listings, skipping photo refresh`);
      continue;
    }
    // Score each listing's pictures: prefer ones with explicit exterior captions
    let pickedUrl: string | null = null;
    let pickedFrom: string | null = null;
    for (const summary of listings.slice(0, 5)) {
      const detail = await fetchListingDetail(token, summary._id);
      const url = pickBestExteriorPhoto(detail);
      const hasExterior = (detail.pictures || []).some((p) =>
        EXTERIOR_KEYWORDS.test(p.caption || "")
      );
      if (hasExterior && url) {
        pickedUrl = url;
        pickedFrom = detail.title || detail.nickname || summary._id;
        break;
      }
      if (!pickedUrl && url) {
        pickedUrl = url;
        pickedFrom = detail.title || detail.nickname || summary._id;
      }
    }
    if (!pickedUrl) {
      console.log(`  ⚠ ${city}: no usable photo`);
      continue;
    }
    const dest = path.join(PUBLIC_MARKETS_DIR, `${citySlug(city)}.jpg`);
    if (dryRun) {
      console.log(`  📷 ${city}: would download ${pickedFrom} → ${path.relative(process.cwd(), dest)}`);
    } else {
      await downloadImage(pickedUrl, dest);
      console.log(`  📷 ${city}: ${pickedFrom} → ${path.relative(process.cwd(), dest)}`);
    }
  }

  // 3. Rewrite portfolio-stats.ts
  const perMarketUpdated: Record<string, string> = {};
  for (const city of ALL_CITIES) {
    perMarketUpdated[perMarketKey(city)] = formatCount(city, counts[city]);
  }
  const { before, after } = await rewriteStatsFile({
    totalListings,
    perMarket: perMarketUpdated,
  });

  console.log(`\n📝 ${path.relative(process.cwd(), STATS_FILE)} diff:\n`);
  console.log(diff(before, after));
  console.log("");

  if (dryRun) {
    console.log("Dry run — no files changed. Re-run without --dry-run to apply.");
  } else if (before === after) {
    console.log("✓ portfolio-stats.ts already up to date.");
  } else {
    await fs.writeFile(STATS_FILE, after);
    console.log(`✓ Wrote ${path.relative(process.cwd(), STATS_FILE)}`);
  }

  // 4. Sweep marketing-copy files (page.tsx, footer.tsx) so user-facing
  //    "189+ homes" strings stay aligned with totalListings.
  console.log("\n📝 Marketing copy sweep:");
  for (const file of MARKETING_COPY_FILES) {
    const result = await rewriteMarketingCopyFile(file, totalListings);
    const rel = path.relative(process.cwd(), result.path);
    if (result.before === result.after) {
      console.log(`  ✓ ${rel}: already up to date`);
    } else if (dryRun) {
      console.log(`  📝 ${rel}: would update ${countDifferences(result.before, result.after)} ref(s)`);
    } else {
      await fs.writeFile(result.path, result.after);
      console.log(
        `  ✓ ${rel}: updated ${countDifferences(result.before, result.after)} ref(s)`
      );
    }
  }

  // 5. Sweep building unit counts in /crested-butte/{plaza,grand-lodge,lodge-...}
  console.log("\n📝 Building unit-count sweep:");
  for (const sweep of BUILDING_SWEEPS) {
    const buildingListings = await fetchListingsForTag(token, sweep.tag);
    const count = buildingListings.length;
    console.log(`  ${sweep.name.padEnd(28)} ${count} units (tag "${sweep.tag}")`);
    const result = await rewriteBuildingContentFile(sweep, count);
    const rel = path.relative(process.cwd(), result.path);
    if (result.before === result.after) {
      console.log(`    ✓ ${rel}: already up to date`);
    } else if (dryRun) {
      console.log(
        `    📝 ${rel}: would update ${countDifferences(result.before, result.after)} ref(s)`
      );
    } else {
      await fs.writeFile(result.path, result.after);
      console.log(
        `    ✓ ${rel}: updated ${countDifferences(result.before, result.after)} ref(s)`
      );
    }
  }

  if (!dryRun) {
    console.log(
      "\nNext: review the diff, commit the changes, and deploy with `npx vercel@53.1.0 deploy --prod --yes --force`."
    );
  }
}

function countDifferences(a: string, b: string): number {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  let n = 0;
  for (let i = 0; i < Math.max(aLines.length, bLines.length); i++) {
    if (aLines[i] !== bLines[i]) n++;
  }
  return n;
}

main().catch((e) => {
  console.error("\n❌ Refresh failed:", e.message);
  process.exit(1);
});
