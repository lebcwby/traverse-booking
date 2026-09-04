/**
 * Replace the cover image of an ALREADY-PUBLISHED blog post — commits
 * directly to main. For open drafts, use apply-edits.ts instead.
 *
 * Picks a Drive image via the same subfolder+hint interface as apply-edits,
 * downloads it, and force-updates public/blog/<slug>.<ext> on main.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/replace-live-cover.ts <slug> \
 *     --cover-subfolder <name> [--cover-hint <keyword>]
 */
import Anthropic from "@anthropic-ai/sdk";
import { exec } from "../src/lib/blog-automation/composio";
import { updateDraftCoverImage } from "../src/lib/blog-automation/github";

const ROOT_FOLDER_ID =
  process.env.DRIVE_BLOG_IMAGES_FOLDER_ID ?? "1NYFL4yN1t_BtoYi8Sh7VGxMdG_AqmmjM";
const MIME_FOLDER = "application/vnd.google-apps.folder";

interface DriveFile { id: string; name: string; mimeType: string }
interface DriveImageWithPath extends DriveFile { path: string }

function parseArgs() {
  const argv = process.argv.slice(2);
  const slug = argv[0];
  if (!slug || slug.startsWith("--")) {
    console.error("usage: replace-live-cover <slug> --cover-subfolder <name> [--cover-hint <k>]");
    process.exit(1);
  }
  let sub: string | undefined, hint: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--cover-subfolder") sub = argv[++i];
    else if (argv[i] === "--cover-hint") hint = argv[++i];
  }
  if (!sub) {
    console.error("--cover-subfolder is required");
    process.exit(1);
  }
  return { slug, sub, hint };
}

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

async function collectImages(rootId: string, rootName: string, maxDepth = 5): Promise<DriveImageWithPath[]> {
  const out: DriveImageWithPath[] = [];
  const queue: Array<{ id: string; path: string; depth: number }> = [
    { id: rootId, path: rootName, depth: 0 },
  ];
  while (queue.length) {
    const { id, path, depth } = queue.shift()!;
    for (const c of await listChildren(id)) {
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
  if (!res.ok) throw new Error(`download failed: ${res.error}`);
  const s3 = res.data.downloaded_file_content?.s3url;
  if (!s3) throw new Error("no s3url");
  const r = await fetch(s3);
  if (!r.ok) throw new Error(`fetch s3 → ${r.status}`);
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

async function pickWithHint(imgs: DriveImageWithPath[], hint: string, slug: string): Promise<DriveImageWithPath> {
  // Split hint on whitespace so each token is checked independently — any
  // path containing at least one token is a keyword hit. Falls back to all
  // images if no keyword hits (better than picking randomly).
  const tokens = hint.toLowerCase().split(/\s+/).filter(Boolean);
  const kw = imgs.filter((i) => {
    const lc = i.path.toLowerCase();
    return tokens.some((t) => lc.includes(t));
  });
  const sample = (kw.length > 0 ? kw : imgs).slice(0, 200);
  console.log(`[replace-live-cover] ${kw.length}/${imgs.length} paths hit any of "${tokens.join(", ")}" (using ${sample.length})`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const numbered = sample.map((s, i) => `${i}. ${s.path}`).join("\n");
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Pick the filename most likely to be a great blog cover matching hint "${hint}" for post ${slug}.
Prefer wide/scenic exteriors or hero interior shots. Avoid close-ups of towels, floors, walls, or tiny detail shots.

Options:
${numbered}

Respond as JSON only: {"index": <n>, "reason": "<12 words max>"}.`,
    }],
  });
  const block = msg.content[0];
  const text = block.type === "text" ? block.text : "";
  const match = text.match(/\{[\s\S]*?"index"[\s\S]*?\}/);
  const parsed = match ? (JSON.parse(match[0]) as { index?: number; reason?: string }) : { index: 0 };
  const idx = typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < sample.length ? parsed.index : 0;
  console.log(`[replace-live-cover] picked: ${sample[idx].path} — ${parsed.reason ?? ""}`);
  return sample[idx];
}

async function main(): Promise<void> {
  const { slug, sub, hint } = parseArgs();
  console.log(`Replacing live cover for ${slug} on main`);

  const folder = await findSubfolder(sub);
  if (!folder) throw new Error(`subfolder "${sub}" not found in Drive root`);
  const imgs = await collectImages(folder.id, folder.name);
  if (imgs.length === 0) throw new Error("no images in subfolder");
  const chosen = hint ? await pickWithHint(imgs, hint, slug) : imgs[0];

  const { base64, mimeType } = await downloadDrive(chosen.id);
  const ext = extForMime(mimeType);
  await updateDraftCoverImage({ slug, branch: "main", contentBase64: base64, ext });
  console.log(`✓ committed to main: public/blog/${slug}.${ext}`);
  console.log(`  source: ${chosen.path}`);
  console.log(`  Vercel will redeploy in ~2 min.`);
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
