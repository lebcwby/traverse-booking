/**
 * Quarterly portfolio refresh.
 *
 * Run this on Feb 1 / May 1 / Aug 1 / Nov 1 to keep the property-management
 * page and building pages in sync with reality:
 *  1. Pull live listing counts per market from the Guesty BEAPI
 *  2. Pick the best exterior/feature photo for Vail, Granby, Twin Lakes
 *     and download to /public/property-management/markets/
 *  3. Rewrite src/lib/portfolio-stats.ts
 *  4. AUDIT (report, don't rewrite) the user-facing portfolio-count claims
 *     across the marketing surfaces — see auditMarketingCount() for why this
 *     is deliberately read-only.
 *  5. Sweep Traverse-managed unit counts on the building pages
 *     (The Plaza, Grand Lodge, Lodge at Mountaineer Square) by pulling
 *     listing counts per BEAPI tag.
 *
 * Usage:
 *   npx tsx scripts/refresh-portfolio-data.ts               # apply changes
 *   npx tsx scripts/refresh-portfolio-data.ts --dry-run     # preview only
 *   npx tsx scripts/refresh-portfolio-data.ts --sweep-copy  # also force
 *                                    marketing copy to match the BEAPI total
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

/**
 * BEAPI rate-limits a burst of back-to-back requests with a 429. This script
 * fires ~12 of them in a row (6 cities + 3 photo details + 3 building tags),
 * which reliably trips it partway through and aborts the refresh. Retry on
 * 429/5xx with exponential backoff, honouring Retry-After when present.
 */
async function beapiFetch(
  url: string | URL,
  token: string,
  label: string
): Promise<Response> {
  const MAX_ATTEMPTS = 5;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) return r;

    lastStatus = r.status;
    lastBody = await r.text();

    const retryable = r.status === 429 || r.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;

    const retryAfter = Number(r.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s, 8s
    console.log(
      `    ⏳ ${label} ${r.status} — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${MAX_ATTEMPTS - 1})`
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error(`BEAPI ${label} ${lastStatus}: ${lastBody}`);
}

async function fetchListingsForCity(
  token: string,
  city: string
): Promise<BeapiListing[]> {
  const url = new URL("https://booking.guesty.com/api/listings");
  url.searchParams.set("city", city);
  url.searchParams.set("country", "United States");
  url.searchParams.set("limit", "100");
  const r = await beapiFetch(url, token, city);
  const j = (await r.json()) as { results?: BeapiListing[] };
  return j.results || [];
}

async function fetchListingDetail(
  token: string,
  id: string
): Promise<BeapiListing> {
  const r = await beapiFetch(
    `https://booking.guesty.com/api/listings/${id}`,
    token,
    `listing ${id}`
  );
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

// Every surface that states a portfolio count to a user or to an AI. The
// read-only audit checks all of these; MARKETING_COPY_FILES above is only the
// (opt-in, legacy) rewrite set. Keep this list current when new count-bearing
// copy lands — a missed file is how the site drifted to 25 stale "189+" refs.
const MARKETING_AUDIT_FILES = [
  "src/app/page.tsx",
  "src/app/audit/page.tsx",
  "src/app/projection/page.tsx",
  "src/app/reviews/page.tsx",
  "src/app/crested-butte/content.ts",
  "src/app/api/plan/save/route.ts",
  "src/components/layout/footer.tsx",
  "src/components/marketing/stat-bar.tsx",
  "src/components/plan/plan-landing.tsx",
  "src/lib/faq-data.ts",
  "src/lib/schema.tsx",
  "src/lib/plan/system-prompt.ts",
  "src/lib/plan/slug-content.ts",
  "src/lib/blog-automation/brand.ts",
  "public/llms.txt",
  "public/llms-full.txt",
].map((p) => path.resolve(process.cwd(), p));

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
  const r = await beapiFetch(url, token, `tag "${tag}"`);
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

/**
 * Report every user-facing portfolio-count claim on the site and how it
 * compares to the live BEAPI total. Read-only by design — see the note at the
 * call site for why this is an audit and not a rewrite.
 *
 * Scans for "<n>+" and bare "<n>" claims sitting next to portfolio vocabulary
 * across the marketing surfaces (including the static llms*.txt files and the
 * AI-facing prompt/brand strings, none of which the old sweep touched).
 */
async function auditMarketingCount(actualTotal: number): Promise<void> {
  const CLAIM_PATTERN =
    /(\d{2,4})\+?\s*(?:<\/\w+>\s*(?:<[^>]+>\s*)?)?(homes|properties|rentals|stays|vacation\s+\w+|active\s+listings|managed\s+rentals)/gi;

  console.log("\n🔎 Marketing count audit (read-only):");
  console.log(`  Live BEAPI total: ${actualTotal}`);

  const found = new Map<string, number>(); // claimed value → occurrences
  const fileHits: Array<{ rel: string; claims: string[] }> = [];

  for (const file of MARKETING_AUDIT_FILES) {
    let text: string;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue; // file moved/renamed — not worth failing the refresh over
    }
    const claims: string[] = [];
    for (const m of text.matchAll(CLAIM_PATTERN)) {
      const value = m[1];
      // Skip obvious non-portfolio numbers (guest counts, years, percentages).
      if (Number(value) > 1000) continue;
      claims.push(`${value}${m[0].includes("+") ? "+" : ""} ${m[2].trim()}`);
      found.set(value, (found.get(value) || 0) + 1);
    }
    if (claims.length) {
      fileHits.push({ rel: path.relative(process.cwd(), file), claims });
    }
  }

  if (!fileHits.length) {
    console.log("  (no portfolio-count claims found)");
    return;
  }

  const distinct = [...found.keys()].sort((a, b) => Number(a) - Number(b));
  for (const { rel, claims } of fileHits) {
    console.log(`  ${rel}: ${claims.length} claim(s) — ${[...new Set(claims)].join(", ")}`);
  }

  if (distinct.length > 1) {
    console.log(
      `\n  ⚠️  INCONSISTENT: the site advertises ${distinct.length} different counts (${distinct.join(", ")}). Pick one and make it uniform.`
    );
  } else {
    const claimed = Number(distinct[0]);
    const delta = claimed - actualTotal;
    if (delta > 0) {
      console.log(
        `\n  ℹ️  Site claims ${claimed}, live total is ${actualTotal} (overstates by ${delta}). Fine if listings are mid-onboarding — otherwise update the copy.`
      );
    } else if (delta < 0) {
      console.log(
        `\n  ℹ️  Site claims ${claimed}, live total is ${actualTotal} (understates by ${-delta}). Consider raising the marketing number.`
      );
    } else {
      console.log(`\n  ✓ Site claim matches the live total (${claimed}).`);
    }
  }
  console.log(
    "  Copy is NOT auto-rewritten. To force alignment with BEAPI, re-run with --sweep-copy."
  );
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
  const sweepCopy = process.argv.includes("--sweep-copy");
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

  // 4. AUDIT (do not rewrite) the user-facing marketing count.
  //
  //    This used to auto-rewrite page.tsx/footer.tsx to match totalListings.
  //    That was wrong twice over:
  //      a) The regex only matched "<n>+ <keyword>", so it caught 3 of ~25
  //         site-wide references and reported the rest as "already up to date"
  //         — silently leaving the site self-inconsistent.
  //      b) The marketing number is a deliberate business decision, not a
  //         mirror of BEAPI. On 2026-08-03 it was set to "190+" while the live
  //         count was 186, because 5 listings were mid-onboarding. An
  //         auto-sweep would quietly walk that back down every quarter.
  //    So: report the drift, let a human decide.
  await auditMarketingCount(totalListings);

  // 4b. Legacy opt-in rewrite. Off by default; only use it when the marketing
  //     number really is meant to track BEAPI exactly.
  if (sweepCopy) {
    console.log("\n📝 Marketing copy sweep (--sweep-copy):");
    for (const file of MARKETING_COPY_FILES) {
      const result = await rewriteMarketingCopyFile(file, totalListings);
      const rel = path.relative(process.cwd(), result.path);
      if (result.before === result.after) {
        console.log(`  ✓ ${rel}: already up to date`);
      } else if (dryRun) {
        console.log(
          `  📝 ${rel}: would update ${countDifferences(result.before, result.after)} ref(s)`
        );
      } else {
        await fs.writeFile(result.path, result.after);
        console.log(
          `  ✓ ${rel}: updated ${countDifferences(result.before, result.after)} ref(s)`
        );
      }
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
