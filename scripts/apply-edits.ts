/**
 * Apply text edits and/or swap the cover image on an existing draft PR,
 * then re-email the reviewer. Mirrors what the reply-watcher does — but
 * driven by CLI args instead of an inbound Gmail reply.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/apply-edits.ts <slug> \
 *     --edits "text of edit instructions" \
 *     --cover-subfolder "Granby" \
 *     --cover-hint "exterior"
 *
 * Either --edits, --cover-subfolder, or both may be given. At least one
 * required.
 */
import Anthropic from "@anthropic-ai/sdk";
import { CONTENT_CALENDAR } from "../src/lib/blog-automation/calendar";
import { exec } from "../src/lib/blog-automation/composio";
import { revisePost } from "../src/lib/blog-automation/generate";
import { sendDraftEmail } from "../src/lib/blog-automation/email";
import {
  fetchDraftContent,
  findOpenPrByBranch,
  updateDraftContent,
  updateDraftCoverImage,
} from "../src/lib/blog-automation/github";

const ROOT_FOLDER_ID =
  process.env.DRIVE_BLOG_IMAGES_FOLDER_ID ?? "1NYFL4yN1t_BtoYi8Sh7VGxMdG_AqmmjM";
const MIME_FOLDER = "application/vnd.google-apps.folder";

function parseArgs(): { slug: string; edits?: string; coverSubfolder?: string; coverHint?: string } {
  const argv = process.argv.slice(2);
  const slug = argv[0];
  if (!slug || slug.startsWith("--")) {
    console.error("usage: apply-edits <slug> [--edits '...'] [--cover-subfolder Granby] [--cover-hint exterior]");
    process.exit(1);
  }
  const out: { slug: string; edits?: string; coverSubfolder?: string; coverHint?: string } = { slug };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--edits") out.edits = argv[++i];
    else if (argv[i] === "--cover-subfolder") out.coverSubfolder = argv[++i];
    else if (argv[i] === "--cover-hint") out.coverHint = argv[++i];
  }
  if (!out.edits && !out.coverSubfolder) {
    console.error("must pass --edits and/or --cover-subfolder");
    process.exit(1);
  }
  return out;
}

interface DriveFile { id: string; name: string; mimeType: string }
interface DriveImageWithPath extends DriveFile { path: string }

async function listChildren(id: string): Promise<DriveFile[]> {
  const res = await exec<{ files?: DriveFile[]; data?: { files?: DriveFile[] } }>(
    "GOOGLEDRIVE_LIST_FILES",
    { q: `'${id}' in parents and trashed = false`, fields: "files(id,name,mimeType)", pageSize: 200 },
  );
  if (!res.ok) throw new Error(`drive list failed: ${res.error}`);
  return res.data.files ?? res.data.data?.files ?? [];
}

async function findSubfolder(name: string): Promise<DriveFile | null> {
  const root = await listChildren(ROOT_FOLDER_ID);
  const lc = name.toLowerCase();
  return (
    root.find((f) => f.mimeType === MIME_FOLDER && f.name.toLowerCase() === lc) ??
    root.find((f) => f.mimeType === MIME_FOLDER && f.name.toLowerCase().includes(lc)) ??
    null
  );
}

async function collectImages(folderId: string, folderName: string, maxDepth = 5): Promise<DriveImageWithPath[]> {
  const out: DriveImageWithPath[] = [];
  const queue: Array<{ id: string; path: string; depth: number }> = [{ id: folderId, path: folderName, depth: 0 }];
  while (queue.length) {
    const { id, path, depth } = queue.shift()!;
    const children = await listChildren(id);
    for (const c of children) {
      const p = `${path}/${c.name}`;
      if (c.mimeType === MIME_FOLDER) {
        if (depth < maxDepth) queue.push({ id: c.id, path: p, depth: depth + 1 });
      } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(c.name)) {
        out.push({ ...c, path: p });
      }
    }
  }
  return out;
}

async function downloadDrive(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const res = await exec<{ downloaded_file_content?: { s3url?: string; mimetype?: string } }>(
    "GOOGLEDRIVE_DOWNLOAD_FILE",
    { file_id: fileId },
  );
  if (!res.ok) throw new Error(`drive download failed: ${res.error}`);
  const s3 = res.data.downloaded_file_content?.s3url;
  if (!s3) throw new Error("no s3url in drive download response");
  const r = await fetch(s3);
  if (!r.ok) throw new Error(`fetch s3 failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return {
    base64: buf.toString("base64"),
    mimeType: res.data.downloaded_file_content?.mimetype ?? r.headers.get("content-type") ?? "image/jpeg",
  };
}

function extForMime(m: string): string {
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return "jpg";
}

async function pickImageWithHint(
  images: DriveImageWithPath[],
  hint: string,
  slugContext: string,
): Promise<DriveImageWithPath> {
  // First try a filename-based filter — cheap and often good enough.
  const kw = hint.toLowerCase();
  const keyword = images.filter((i) => i.path.toLowerCase().includes(kw));
  const candidates = keyword.length > 0 ? keyword : images;

  // Cap for Claude context.
  const MAX = 200;
  const sample = candidates.length <= MAX ? candidates : candidates.slice(0, MAX);
  console.log(`[apply-edits] ${candidates.length} images matching "${hint}" (using ${sample.length})`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const numbered = sample.map((s, i) => `${i}. ${s.path}`).join("\n");
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Pick the filename most likely to be a great cover image matching the hint "${hint}".
Prefer wide/scenic shots of building exteriors, not interior close-ups.
Context: post is about ${slugContext}.

Options:
${numbered}

Respond as JSON only: {"index": <number>, "reason": "<12 words max>"}. No prose.`,
      },
    ],
  });
  const block = msg.content[0];
  const text = block.type === "text" ? block.text : "";
  const match = text.match(/\{[\s\S]*?"index"[\s\S]*?\}/);
  const parsed = match ? (JSON.parse(match[0]) as { index?: number; reason?: string }) : { index: 0 };
  const idx = typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < sample.length ? parsed.index : 0;
  console.log(`[apply-edits] picked: ${sample[idx].path} (reason: ${parsed.reason ?? "n/a"})`);
  return sample[idx];
}

async function fetchPostsRow(args: { owner: string; repo: string; branch: string; slug: string }) {
  const r = await fetch(
    `https://api.github.com/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent("src/app/blog/posts.ts")}?ref=${encodeURIComponent(args.branch)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  if (!r.ok) throw new Error(`posts.ts fetch failed: ${r.status}`);
  const file = (await r.json()) as { content: string };
  const src = Buffer.from(file.content, "base64").toString("utf8");
  const escSlug = args.slug.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const block = src.match(new RegExp(`\\{[^}]*slug:\\s*"${escSlug}"[^}]*\\}`, "m"))?.[0];
  if (!block) throw new Error(`slug not in posts.ts on branch`);
  const pick = (f: string) =>
    block.match(new RegExp(`${f}:\\s*"((?:\\\\.|[^"\\\\])*)"`))?.[1].replace(/\\"/g, '"') ?? "";
  return { title: pick("title"), excerpt: pick("excerpt"), image: pick("image") };
}

async function main(): Promise<void> {
  const { slug, edits, coverSubfolder, coverHint } = parseArgs();
  const entry = CONTENT_CALENDAR.find((e) => e.slug === slug);
  if (!entry) throw new Error(`unknown slug: ${slug}`);

  const branch = `blog-draft/${slug}`;
  const pr = await findOpenPrByBranch(branch);
  if (!pr) throw new Error(`no open PR on branch ${branch}`);
  console.log(`Found PR #${pr.number} → ${pr.url}`);

  // ── 1. Text edits ──
  let revisedHtml: string | null = null;
  if (edits) {
    console.log(`Applying text edits (${edits.length} chars)...`);
    const currentHtml = await fetchDraftContent({ slug, branch });
    const revised = await revisePost({ entry, currentHtml, edits });
    console.log(`  attempts: ${revised.attempts}, issues: ${revised.issues.length}`);
    await updateDraftContent({
      slug,
      branch,
      html: revised.html,
      commitMessage: `blog(draft): revise ${slug} per manual edits`,
    });
    revisedHtml = revised.html;
    console.log(`  content.ts updated`);
  }

  // ── 2. Cover image swap ──
  let newCoverPath: string | undefined;
  if (coverSubfolder) {
    console.log(`Swapping cover: subfolder="${coverSubfolder}" hint="${coverHint ?? ""}"`);
    const sub = await findSubfolder(coverSubfolder);
    if (!sub) throw new Error(`subfolder "${coverSubfolder}" not found in Drive root`);
    const imgs = await collectImages(sub.id, sub.name);
    console.log(`  ${imgs.length} images under ${sub.name}`);
    if (imgs.length === 0) throw new Error("no images in subfolder");
    const chosen = coverHint
      ? await pickImageWithHint(imgs, coverHint, `${entry.title} (market: ${entry.market})`)
      : imgs[0];
    const { base64, mimeType } = await downloadDrive(chosen.id);
    const ext = extForMime(mimeType);
    await updateDraftCoverImage({ slug, branch, contentBase64: base64, ext });
    newCoverPath = `/blog/${slug}.${ext}`;
    console.log(`  cover swapped → ${chosen.path}`);
  }

  // ── 3. Re-email ──
  const row = await fetchPostsRow({
    owner: process.env.GITHUB_OWNER!,
    repo: process.env.GITHUB_REPO!,
    branch,
    slug,
  });
  const html = revisedHtml ?? (await fetchDraftContent({ slug, branch }));
  await sendDraftEmail({
    entry,
    draft: {
      frontmatter: {
        title: row.title || entry.title,
        meta_description: row.excerpt,
        category: entry.category,
        tags: entry.secondaryKeywords ?? [],
        slug: entry.slug,
        excerpt: row.excerpt,
        author: "Traverse Hospitality",
      },
      body: html,
    },
    prUrl: pr.url,
    prNumber: pr.number,
    coverImageUrl: newCoverPath ?? row.image ?? null,
    coverBranch: branch,
    coverImageReason: [
      edits ? "text edits applied" : null,
      newCoverPath ? "cover swapped" : null,
    ]
      .filter(Boolean)
      .join(" + "),
    issues: [],
    isRevision: true,
  });
  console.log("✓ email sent");
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
