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
const PICKER_MODEL = "claude-haiku-4-6"; // fast + cheap, the choice is shallow

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

async function downloadDriveFile(
  fileId: string,
): Promise<{ contentBase64: string; mimeType: string }> {
  const res = await exec<{
    file?: string;
    data?: string;
    mimeType?: string;
    mime_type?: string;
  }>("GOOGLEDRIVE_DOWNLOAD_FILE", { fileId });
  if (!res.ok) throw new Error(`drive download failed: ${res.error}`);
  const b64 =
    typeof res.data.file === "string"
      ? res.data.file
      : typeof res.data.data === "string"
        ? res.data.data
        : "";
  if (!b64) throw new Error("drive download returned no base64 payload");
  const mimeType =
    res.data.mimeType ?? res.data.mime_type ?? "application/octet-stream";
  return { contentBase64: b64, mimeType };
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
  if (subfolders.length === 0) {
    console.warn("[image-picker] root folder has no subfolders");
    return null;
  }

  // 2. Pick a subfolder by market.
  const folderChoice = await askClaudePick(
    client,
    { entry, kind: "subfolder" },
    subfolders.map((f) => ({ name: f.name })),
  );
  const chosenFolder = subfolders[folderChoice.index] ?? subfolders[0];

  // 3. List image files in chosen subfolder.
  const folderChildren = await listDriveChildren(chosenFolder.id);
  const images = folderChildren.filter(
    (c) =>
      c.mimeType !== MIME_FOLDER &&
      /\.(jpg|jpeg|png|webp|gif)$/i.test(c.name),
  );
  if (images.length === 0) {
    // Subfolder might itself contain sub-subfolders (per-property). Walk
    // one level deeper if so.
    const nestedFolders = folderChildren.filter((c) => c.mimeType === MIME_FOLDER);
    if (nestedFolders.length === 0) {
      console.warn(`[image-picker] no images in ${chosenFolder.name}`);
      return null;
    }
    const nestedChoice = await askClaudePick(
      client,
      { entry, kind: "subfolder" },
      nestedFolders.map((f) => ({ name: f.name })),
    );
    const chosenNested = nestedFolders[nestedChoice.index] ?? nestedFolders[0];
    const nestedChildren = await listDriveChildren(chosenNested.id);
    const nestedImages = nestedChildren.filter(
      (c) =>
        c.mimeType !== MIME_FOLDER &&
        /\.(jpg|jpeg|png|webp|gif)$/i.test(c.name),
    );
    if (nestedImages.length === 0) return null;
    return finalize(client, entry, chosenNested.name, nestedImages);
  }

  return finalize(client, entry, chosenFolder.name, images);
}

async function finalize(
  client: Anthropic,
  entry: CalendarEntry,
  folderName: string,
  images: DriveFile[],
): Promise<PickedImage> {
  const imageChoice = await askClaudePick(
    client,
    { entry, kind: "image" },
    images.map((f) => ({ name: f.name })),
  );
  const chosen = images[imageChoice.index] ?? images[0];
  const { contentBase64, mimeType } = await downloadDriveFile(chosen.id);
  const ext = extensionForMime(mimeType, chosen.name);
  return {
    sourceName: chosen.name,
    sourceFolder: folderName,
    repoPath: `public/blog/${entry.slug}.${ext}`,
    publicUrl: `/blog/${entry.slug}.${ext}`,
    contentBase64,
    mimeType,
    reason: imageChoice.reason,
  };
}
