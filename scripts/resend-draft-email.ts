/**
 * Re-send the draft-review email for an existing open PR without
 * regenerating the post. Useful when the inbox-side email got lost / you
 * want a fresh approval token.
 *
 * Reads:
 *   - PR by branch via GitHub API
 *   - Current content.ts on that branch (rendered HTML)
 *   - posts.ts row for the slug (title, excerpt, image path)
 *
 * Then calls sendDraftEmail with a ParsedDraft reconstructed from those.
 *
 * Run: npx tsx --env-file=.env.local scripts/resend-draft-email.ts <slug>
 */
import { CONTENT_CALENDAR } from "../src/lib/blog-automation/calendar";
import { sendDraftEmail } from "../src/lib/blog-automation/email";
import {
  fetchDraftContent,
  findOpenPrByBranch,
} from "../src/lib/blog-automation/github";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} required`);
  return v;
}

async function fetchPostsRow(args: {
  owner: string;
  repo: string;
  branch: string;
  slug: string;
}): Promise<{ title: string; excerpt: string; image: string }> {
  const r = await fetch(
    `https://api.github.com/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(
      "src/app/blog/posts.ts",
    )}?ref=${encodeURIComponent(args.branch)}`,
    {
      headers: {
        Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!r.ok) throw new Error(`posts.ts fetch failed: ${r.status}`);
  const file = (await r.json()) as { content: string };
  const src = Buffer.from(file.content, "base64").toString("utf8");
  // Pull the block matching `slug: "<slug>"` and read sibling fields.
  const escSlug = args.slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const blockRe = new RegExp(
    `\\{[^}]*slug:\\s*"${escSlug}"[^}]*\\}`,
    "m",
  );
  const block = src.match(blockRe)?.[0];
  if (!block) throw new Error(`slug "${args.slug}" not in posts.ts on branch`);
  const pick = (field: string) =>
    block.match(new RegExp(`${field}:\\s*"((?:\\\\.|[^"\\\\])*)"`))?.[1].replace(/\\"/g, '"') ?? "";
  return {
    title: pick("title"),
    excerpt: pick("excerpt"),
    image: pick("image"),
  };
}

async function main(): Promise<void> {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: resend-draft-email <slug>");
    process.exit(1);
  }
  const entry = CONTENT_CALENDAR.find((e) => e.slug === slug);
  if (!entry) throw new Error(`unknown slug: ${slug}`);

  const branch = `blog-draft/${slug}`;
  const pr = await findOpenPrByBranch(branch);
  if (!pr) throw new Error(`no open PR on branch ${branch}`);
  console.log(`Found PR #${pr.number} → ${pr.url}`);

  const owner = env("GITHUB_OWNER");
  const repo = env("GITHUB_REPO");

  const html = await fetchDraftContent({ slug, branch });
  console.log(`Pulled content.ts: ${html.length} chars`);

  const row = await fetchPostsRow({ owner, repo, branch, slug });
  console.log(`posts.ts row: title="${row.title}", image="${row.image}"`);

  // Reconstruct a ParsedDraft. The body field is normally markdown but the
  // email's preview extractor (previewFromBody) is tolerant of HTML —
  // it strips frontmatter, headings, and markdown links, then takes the
  // first ~80 words. HTML tags will leak into the preview but the email
  // also embeds the full rendered article below, which is what reviewers
  // actually read.
  const draft = {
    frontmatter: {
      title: row.title || entry.title,
      meta_description: row.excerpt, // best available — excerpt was generated from meta
      category: entry.category,
      tags: entry.secondaryKeywords ?? [],
      slug: entry.slug,
      excerpt: row.excerpt,
      author: "Traverse Hospitality",
    },
    body: html, // HTML rather than markdown; preview will be approximate
  };

  await sendDraftEmail({
    entry,
    draft,
    prUrl: pr.url,
    prNumber: pr.number,
    coverImageUrl: row.image || null,
    coverBranch: branch,
    coverImageReason: "Re-sent from existing PR (no regeneration)",
    issues: [],
    isRevision: false,
  });

  console.log("✓ resent");
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
