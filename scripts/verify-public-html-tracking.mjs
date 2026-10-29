#!/usr/bin/env node
/*
 * Fails the build if any user-facing static HTML page in public/ is missing
 * the Stay Portland tracking bundle.
 *
 * Context: Next.js routes get tracking via src/app/layout.tsx, but files dropped
 * into public/ bypass that tree entirely. On 2026-04-22 we shipped /no-fees/
 * as static HTML and discovered ~24h later that no ads landing there were being
 * tracked (no Meta pixel, no GA4, no GTM). This check prevents a repeat.
 *
 * Rule: every .html in public/ must reference /scripts/sp-tracking.js, unless
 * the path is listed in EXEMPT below (internal previews, email-client shims).
 */
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const REQUIRED_MARKER = "/scripts/sp-tracking.js";

// Explicit allowlist of HTML files that don't need tracking.
// Add with a one-line comment explaining WHY the file is exempt.
const EXEMPT = new Set([
  // Internal design preview for rose-stem icon options — never linked from
  // production, not an ad destination.
  "badge-preview.html",
  // Meta Business domain-verification token. Its whole contract is that the
  // body is the bare token and nothing else — adding the tracking scripts
  // would make Meta's check fail, which is the opposite of what this file is
  // for. Never a destination: only Meta's crawler fetches it.
  "u2z8ve88hyoqevwbissu2apayfkl8b.html",
]);

async function walkHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkHtml(full)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

const files = await walkHtml(PUBLIC_DIR);
const missing = [];
let checked = 0;

for (const file of files) {
  const rel = relative(PUBLIC_DIR, file);
  if (EXEMPT.has(rel)) continue;
  checked += 1;
  const html = await readFile(file, "utf8");
  if (!html.includes(REQUIRED_MARKER)) {
    missing.push(rel);
  }
}

if (missing.length > 0) {
  console.error(
    "\n✗ Static HTML pages missing tracking bundle (/scripts/sp-tracking.js):\n"
  );
  for (const rel of missing) {
    console.error("    public/" + rel);
  }
  console.error(
    "\nFix: add these lines inside <head> of each page:\n" +
      '    <script src="/scripts/consent-default.js"></script>\n' +
      '    <script src="/scripts/sp-tracking.js" defer></script>\n' +
      "\nand the GTM + Meta Pixel <noscript> fallbacks at the top of <body>.\n" +
      "See public/no-fees/index.html for the canonical example.\n" +
      "If the page is genuinely internal (preview, email shim), add its path\n" +
      "to EXEMPT in scripts/verify-public-html-tracking.mjs with a reason.\n"
  );
  process.exit(1);
}

// Count what was actually checked, not `files.length - EXEMPT.size`: that
// subtracted every allowlist entry whether or not a matching file existed, so
// once badge-preview.html was deleted the script cheerfully reported checking
// -1 pages.
console.log(`✓ Tracking bundle present on ${checked} public HTML page(s).`);
