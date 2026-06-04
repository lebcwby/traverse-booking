// Pick a cover image for a calendar entry from the Traverse-owned Google
// Drive folder. The folder is organized by market (and within each market,
// by property name or nickname). We ask Composio's Google Drive tools for
// the directory contents, then let Claude choose the best filename match
// for the post topic.
//
// Returns the chosen file as base64 so the caller (github.ts) can commit it
// directly into the PR at /public/blog/<slug>.<ext>.

import Anthropic from "@anthropic-ai/sdk";
import { exec } from "./composio";
import type { CalendarEntry } from "./calendar";

const ROOT_FOLDER_ID =
  process.env.DRIVE_BLOG_IMAGES_FOLDER_ID ?? "1NYFL4yN1t_BtoYi8Sh7VGxMdG_AqmmjM";
const PICKER_MODEL = "claude-haiku-4-5"; // fast + cheap, the choice is shallow

const MIME_FOLDER = "application/vnd.google-apps.folder";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveListResponse {
  files?: DriveFile[];
  // Composio sometimes wraps responses, so accept either shape.
  data?: { files?: DriveFile[] };
}

async function listDriveChildren(parentId: string): Promise<DriveFile[]> {
  // Standard Composio slug for Drive list. The `q` arg uses Drive's search
  // syntax: `'<parentId>' in parents and trashed = false`.
  const res = await exec<DriveListResponse>("GOOGLEDRIVE_LIST_FILES", {
    q: `'${parentId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 200,
  });
  if (!res.ok) throw new Error(`drive list failed: ${res.error}`);
  const files = res.data.files ?? res.data.data?.files ?? [];
  return files;
}

/**
 * Composio's GOOGLEDRIVE_DOWNLOAD_FILE doesn't return base64 inline — it
 * uploads the file to a temporary R2 bucket and returns a presigned URL at
 * `downloaded_file_content.s3url`. We fetch that URL ourselves.
 */
async function downloadDriveFile(
  fileId: string,
): Promise<{ contentBase64: string; mimeType: string }> {
  const res = await exec<{
    downloaded_file_content?: {
      s3url?: string;
      mimetype?: string;
      name?: string;
    };
    mimeType?: string;
  }>("GOOGLEDRIVE_DOWNLOAD_FILE", { file_id: fileId });
  if (!res.ok) throw new Error(`drive download failed: ${res.error}`);

  const dfc = res.data.downloaded_file_content;
  const s3url = dfc?.s3url;
  if (!s3url) {
    throw new Error(
      `drive download missing s3url — keys: ${Object.keys(res.data).join(",")}`,
    );
  }

  const r = await fetch(s3url);
  if (!r.ok) {
    throw new Error(
      `drive hosted-content fetch failed → HTTP ${r.status} ${r.statusText}`,
    );
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const mimeType =
    dfc?.mimetype ??
    res.data.mimeType ??
    r.headers.get("content-type") ??
    "application/octet-stream";
  return { contentBase64: buf.toString("base64"), mimeType };
}

function extensionForMime(mime: string, fallbackName: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  const ext = fallbackName.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}

interface PickerChoice {
  /** Index into the options array. */
  index: number;
  reason: string;
}

async function askClaudePick(
  client: Anthropic,
  context: { entry: CalendarEntry; kind: "subfolder" | "image" },
  options: { name: string }[],
): Promise<PickerChoice> {
  const promptHeader =
    context.kind === "subfolder"
      ? `Pick the Google Drive subfolder most likely to contain a good cover image for this blog post. Prefer market/location match over property match — the post is about a market or topic, not always a specific property.`
      : `Pick the Google Drive filename most likely to be the best cover image for this blog post. Prefer scenic / wide / hero shots over interior detail shots. Avoid floor plans, blueprints, or document-like images.`;

  const numbered = options.map((o, i) => `${i}. ${o.name}`).join("\n");

  const msg = await client.messages.create({
    model: PICKER_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `${promptHeader}

Post title: ${context.entry.title}
Primary keyword: ${context.entry.primaryKeyword}
Market: ${context.entry.market}
Brief: ${context.entry.brief}

Options:
${numbered}

Respond as JSON only: {"index": <number>, "reason": "<10 words max>"}. No prose around it.`,
      },
    ],
  });
  const block = msg.content[0];
  if (!block || block.type !== "text") {
    return { index: 0, reason: "fallback: non-text response" };
  }
  // Be lenient about Claude wrapping JSON in prose.
  const match = block.text.match(/\{[\s\S]*?"index"[\s\S]*?\}/);
  if (!match) return { index: 0, reason: "fallback: no JSON in response" };
  try {
    const parsed = JSON.parse(match[0]) as PickerChoice;
    const idx =
      typeof parsed.index === "number" &&
      parsed.index >= 0 &&
      parsed.index < options.length
        ? parsed.index
        : 0;
    return { index: idx, reason: parsed.reason ?? "" };
  } catch {
    return { index: 0, reason: "fallback: invalid JSON" };
  }
}

export interface PickedImage {
  /** Drive filename, for credit / debug. */
  sourceName: string;
  /** Drive subfolder the image came from. */
  sourceFolder: string;
  /** Path the image will be committed to in the PR. */
  repoPath: string;
  /** Url the posts.ts row will reference. */
  publicUrl: string;
  /** base64 file contents for committing to GitHub. */
  contentBase64: string;
  mimeType: string;
  /** Short human-readable reason Claude picked this one (for the email). */
  reason: string;
}

/**
 * Picks a cover image for an entry. Returns null if the Drive folder is
 * empty or unreachable — caller should fall back to leaving image blank
 * rather than failing the whole pipeline.
 */
export async function pickImageForEntry(
  entry: CalendarEntry,
): Promise<PickedImage | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY required for image-picker");
  const client = new Anthropic({ apiKey: anthropicKey });

  // 1. List subfolders in the root.
  const rootChildren = await listDriveChildren(ROOT_FOLDER_ID);
  const subfolders = rootChildren.filter((c) => c.mimeType === MIME_FOLDER);
  console.log(`[image-picker] root: ${rootChildren.length} items, ${subfolders.length} subfolders`);
  if (subfolders.length === 0) {
    console.warn("[image-picker] root folder has no subfolders");
    return null;
  }

  // 2. Pick a market subfolder.
  const folderChoice = await askClaudePick(
    client,
    { entry, kind: "subfolder" },
    subfolders.map((f) => ({ name: f.name })),
  );
  const marketFolder = subfolders[folderChoice.index] ?? subfolders[0];
  console.log(`[image-picker] picked market: ${marketFolder.name} (reason: ${folderChoice.reason})`);

  // 3. Recursively gather every image under the market folder. Folder
  // depth varies by property (some properties have a Photos/ subfolder,
  // some put images directly), so we walk until we find leaves.
  const allImages = await collectAllImages(marketFolder.id, marketFolder.name);
  console.log(`[image-picker] ${marketFolder.name}: ${allImages.length} images across all depths`);
  if (allImages.length === 0) {
    console.warn(`[image-picker] no images anywhere under ${marketFolder.name}`);
    return null;
  }

  // Big markets (Leadville has 7k+ images) blow Claude's 200K context if
  // we send every filename. Cap the candidate set at MAX_CANDIDATES via a
  // deterministic, slug-seeded sample so re-runs on the same post pick
  // consistently.
  const MAX_CANDIDATES = 300;
  const candidates =
    allImages.length <= MAX_CANDIDATES
      ? allImages
      : sampleDeterministic(allImages, MAX_CANDIDATES, entry.slug);
  if (candidates !== allImages) {
    console.log(`[image-picker] sampled ${candidates.length}/${allImages.length} candidates for Claude`);
  }

  return finalize(client, entry, marketFolder.name, candidates);
}

/** Mulberry32 PRNG seeded from a string — small, deterministic, no deps. */
function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function sampleDeterministic<T>(arr: T[], n: number, seedStr: string): T[] {
  const rng = mulberry32(seedFromString(seedStr));
  // Fisher-Yates first n
  const copy = arr.slice();
  for (let i = 0; i < n && i < copy.length - 1; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

interface DriveImageWithPath extends DriveFile {
  path: string; // "Crested Butte/Grand Lodge/exterior.jpg"
}

/**
 * Walk the folder tree breadth-first under `rootId`, returning every image
 * file with its display path. Bounded depth (5) and per-folder cap (200)
 * to keep this from blowing up on a hypothetically massive tree.
 */
async function collectAllImages(
  rootId: string,
  rootName: string,
  maxDepth = 5,
  perFolderCap = 200,
): Promise<DriveImageWithPath[]> {
  const out: DriveImageWithPath[] = [];
  const queue: Array<{ id: string; path: string; depth: number }> = [
    { id: rootId, path: rootName, depth: 0 },
  ];
  while (queue.length) {
    const { id, path, depth } = queue.shift()!;
    const children = (await listDriveChildren(id)).slice(0, perFolderCap);
    for (const c of children) {
      const childPath = `${path}/${c.name}`;
      if (c.mimeType === MIME_FOLDER) {
        if (depth < maxDepth) {
          queue.push({ id: c.id, path: childPath, depth: depth + 1 });
        }
      } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(c.name)) {
        out.push({ ...c, path: childPath });
      }
    }
  }
  return out;
}

async function finalize(
  client: Anthropic,
  entry: CalendarEntry,
  folderName: string,
  images: DriveImageWithPath[] | DriveFile[],
): Promise<PickedImage> {
  // Use the path when available so Claude sees folder context (e.g. "Grand
  // Lodge/exterior.jpg" — much easier to pick a hero shot from).
  const labeled = images.map((f) =>
    "path" in f ? { name: f.path } : { name: f.name },
  );
  const imageChoice = await askClaudePick(
    client,
    { entry, kind: "image" },
    labeled,
  );
  const chosen = images[imageChoice.index] ?? images[0];
  const { contentBase64, mimeType } = await downloadDriveFile(chosen.id);
  const ext = extensionForMime(mimeType, chosen.name);
  return {
    sourceName: "path" in chosen ? chosen.path : chosen.name,
    sourceFolder: folderName,
    repoPath: `public/blog/${entry.slug}.${ext}`,
    publicUrl: `/blog/${entry.slug}.${ext}`,
    contentBase64,
    mimeType,
    reason: imageChoice.reason,
  };
}
