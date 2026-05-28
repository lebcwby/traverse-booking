// Seed a blog post from a local .md file using the same conversion path the
// automation cron will use. Reads frontmatter + body, validates against brand
// rules, writes src/app/blog/<slug>/content.ts, and prepends a row to
// src/app/blog/posts.ts. Local-only; doesn't touch GitHub.
//
// Usage:
//   npx tsx scripts/seed-blog-post.ts <path-to-md>
//
// The .md file's frontmatter must include: title, meta_description, category,
// tags, slug. An `excerpt` field is optional — if missing, we'll derive one
// from meta_description.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bodyToHtml, parseDraft, renderContentModule } from "../src/lib/blog-automation/markdown";
import { CONTENT_CALENDAR } from "../src/lib/blog-automation/calendar";
import { renderPostRow, insertPostRow } from "../src/lib/blog-automation/github";
import { validateDraft } from "../src/lib/blog-automation/brand";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

function main() {
  const mdPath = process.argv[2];
  if (!mdPath) {
    console.error("Usage: npx tsx scripts/seed-blog-post.ts <path-to-md>");
    process.exit(1);
  }

  const raw = readFileSync(mdPath, "utf8");

  // The wildflower file has frontmatter but no excerpt field. The handoff doc
  // for this file used "Crested Butte wildflower season peaks in July..." —
  // derive an excerpt from meta_description if `excerpt:` is missing.
  let augmented = raw;
  if (!/^excerpt:/m.test(raw)) {
    augmented = raw.replace(
      /^(meta_description:\s*[^\n]+)$/m,
      (m) => `${m}\nexcerpt: ${extractMetaDesc(raw)}`,
    );
  }

  const draft = parseDraft(augmented);
  const entry = CONTENT_CALENDAR.find((e) => e.slug === draft.frontmatter.slug);
  if (!entry) {
    console.error(
      `No calendar entry for slug "${draft.frontmatter.slug}". Add one to src/lib/blog-automation/calendar.ts first.`,
    );
    process.exit(1);
  }

  // Validation is a warning, not a hard fail, when seeding existing content.
  const issues = validateDraft(draft.body, { primaryKeyword: entry.primaryKeyword });
  if (issues.length) {
    console.warn("Validation warnings (review before publishing):");
    for (const i of issues) console.warn(`  - ${i.kind}: ${i.detail}`);
  }

  const html = bodyToHtml(draft.body);
  const postDir = join(REPO_ROOT, "src/app/blog", entry.slug);
  if (!existsSync(postDir)) mkdirSync(postDir, { recursive: true });
  writeFileSync(join(postDir, "content.ts"), renderContentModule(html), "utf8");
  console.log(`Wrote ${join("src/app/blog", entry.slug, "content.ts")}`);

  const postsPath = join(REPO_ROOT, "src/app/blog/posts.ts");
  const postsSource = readFileSync(postsPath, "utf8");
  if (postsSource.includes(`slug: "${entry.slug}"`)) {
    console.log(`posts.ts already contains slug "${entry.slug}" — skipping insert.`);
  } else {
    const row = renderPostRow(entry, draft);
    writeFileSync(postsPath, insertPostRow(postsSource, row), "utf8");
    console.log(`Prepended ${entry.slug} row to src/app/blog/posts.ts`);
  }

  console.log(`\nDone. Next: pnpm dev, visit /blog/${entry.slug}, then add a hero image.`);
}

function extractMetaDesc(raw: string): string {
  const m = raw.match(/^meta_description:\s*(.+)$/m);
  return m ? m[1].trim().slice(0, 160) : "Read our latest guide.";
}

main();
