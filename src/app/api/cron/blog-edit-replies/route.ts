// Reply-watcher cron — runs every 5 minutes.
//
// Polls the marketing@traversehospitality.com inbox (via Composio Gmail)
// for unread replies whose subject contains the "[Draft]" tag we set on
// outbound drafts. For each match:
//   1. Parse the slug out of the subject ("Re: [Draft] <slug>")
//   2. Find the open draft PR for that slug
//   3. Fetch the current draft HTML from the PR's content.ts
//   4. Ask Claude to revise the draft with the reviewer's edit text
//   5. Force-push the revised content.ts to the PR branch
//   6. Mark the email as read + send a new draft email (v2) to the reviewer
//
// Auth: Bearer CRON_SECRET (matches existing crons).

import { NextResponse } from "next/server";
import { CONTENT_CALENDAR } from "@/lib/blog-automation/calendar";
import { exec } from "@/lib/blog-automation/composio";
import { revisePost } from "@/lib/blog-automation/generate";
import {
  fetchDraftContent,
  findOpenPrByBranch,
  updateDraftContent,
  updateDraftCoverImage,
} from "@/lib/blog-automation/github";
import {
  sendCoverUpdatedEmail,
  sendDraftEmail,
} from "@/lib/blog-automation/email";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  // Composio returns the message ID as `messageId` (camelCase), not `id`.
  id?: string;
  messageId?: string;
  threadId?: string;
  thread_id?: string;
  subject?: string;
  // Top-level attachment list Composio provides (alongside MIME parts).
  attachmentList?: Array<{ attachmentId: string; filename: string; mimeType?: string }>;
  attachment_list?: Array<{ attachmentId: string; filename: string; mimeType?: string }>;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    filename?: string;
    body?: { attachmentId?: string; data?: string };
    parts?: GmailPart[];
  };
  body?: string;
  snippet?: string;
  messageText?: string;
}

const IMG_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

interface GmailListResponse {
  messages?: GmailMessage[];
  data?: { messages?: GmailMessage[] };
}

const DRAFT_SUBJECT_REGEX = /\[Draft(?:\s*v\d+)?\]\s+(.+?)(?:\s*$|\s*-)/i;
const SLUG_REGEX = /[a-z0-9-]+/g;

function headerValue(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value;
}

function slugFromSubject(subject: string): string | null {
  // Subject can be "[Draft] my-slug", "Re: [Draft] my-slug", "Re: [Draft v2] my-slug", etc.
  // First try to extract a real slug match against the calendar.
  const draftMatch = subject.match(/\[Draft[^\]]*\]\s+(.+)/i);
  const tail = (draftMatch?.[1] ?? subject).toLowerCase().trim();
  // Strip "re:" prefix repetitions
  const cleaned = tail.replace(/^(re|fw|fwd):\s*/i, "").trim();
  // Direct match against known slugs first.
  const directHit = CONTENT_CALENDAR.find((e) => cleaned.includes(e.slug));
  if (directHit) return directHit.slug;
  // Fallback: find the longest [a-z0-9-]+ substring that matches a calendar slug
  const tokens = cleaned.match(SLUG_REGEX) ?? [];
  for (const t of tokens.sort((a, b) => b.length - a.length)) {
    if (CONTENT_CALENDAR.find((e) => e.slug === t)) return t;
  }
  return null;
}

function stripQuotedReply(body: string): string {
  // Strip everything from common reply-quote markers onward.
  const markers = [
    /^On .* wrote:$/m,
    /^-----Original Message-----/m,
    /^>+\s/m,
  ];
  let cut = body.length;
  for (const m of markers) {
    const match = body.match(m);
    if (match && match.index !== undefined && match.index < cut) cut = match.index;
  }
  return body.slice(0, cut).trim();
}

function base64UrlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Walk MIME parts (recursively) for the first text/plain body. */
function textFromParts(parts: GmailPart[] | undefined): string {
  if (!parts) return "";
  for (const p of parts) {
    if (p.mimeType === "text/plain" && p.body?.data) {
      return base64UrlToBuffer(p.body.data).toString("utf8");
    }
    const nested = textFromParts(p.parts);
    if (nested) return nested;
  }
  return "";
}

function decodeGmailBody(msg: GmailMessage): string {
  // Composio's GMAIL_FETCH_EMAILS commonly returns a `messageText` field with
  // plaintext extracted. With include_payload on, dig text/plain out of the
  // MIME parts as a fallback; finally fall back to the snippet.
  return (
    msg.messageText ??
    msg.body ??
    (textFromParts(msg.payload?.parts) || undefined) ??
    msg.snippet ??
    ""
  ).trim();
}

/** Resolve the Composio message ID (camelCase `messageId` or legacy `id`). */
function resolveMessageId(msg: GmailMessage): string {
  return msg.messageId ?? msg.id ?? "";
}

/**
 * Find the first image attachment. Composio exposes a top-level `attachmentList`
 * array (most reliable) as well as embedding attachment info in MIME parts —
 * check the list first, fall back to MIME-part walking.
 */
function extractImageAttachment(
  msg: GmailMessage,
): { attachmentId: string; filename: string; ext: string } | null {
  // 1. Top-level attachmentList (Composio-native, most reliable).
  const list = msg.attachmentList ?? msg.attachment_list ?? [];
  for (const a of list) {
    const isImage =
      (a.mimeType ?? "").startsWith("image/") || IMG_EXT_RE.test(a.filename ?? "");
    if (isImage && a.attachmentId) {
      const m = (a.filename ?? "").match(IMG_EXT_RE);
      const ext = (m ? m[1] : (a.mimeType ?? "").split("/")[1] || "jpg")
        .toLowerCase().replace("jpeg", "jpg");
      return { attachmentId: a.attachmentId, filename: a.filename || `cover.${ext}`, ext };
    }
  }
  // 2. MIME-part fallback.
  const stack: GmailPart[] = [];
  if (msg.payload?.parts) stack.push(...msg.payload.parts);
  if (msg.payload?.body?.attachmentId) {
    stack.push({
      mimeType: msg.payload.mimeType,
      filename: msg.payload.filename,
      body: msg.payload.body,
    });
  }
  while (stack.length) {
    const p = stack.shift()!;
    if (p.parts) stack.push(...p.parts);
    const attachmentId = p.body?.attachmentId;
    const filename = p.filename ?? "";
    const isImage =
      (p.mimeType ?? "").startsWith("image/") || IMG_EXT_RE.test(filename);
    if (attachmentId && isImage) {
      const m = filename.match(IMG_EXT_RE);
      const ext = (m ? m[1] : (p.mimeType ?? "").split("/")[1] || "jpg")
        .toLowerCase().replace("jpeg", "jpg");
      return { attachmentId, filename: filename || `cover.${ext}`, ext };
    }
  }
  return null;
}

/**
 * Fetch an attachment's bytes as standard base64. Composio's GMAIL_GET_ATTACHMENT
 * may return the data inline (base64/base64url) or as a hosted-file descriptor
 * with a URL — handle both. Returns null if it can't be resolved.
 */
async function fetchAttachmentBase64(
  messageId: string,
  attachmentId: string,
  fileName: string,
): Promise<string | null> {
  const res = await exec<Record<string, unknown>>("GMAIL_GET_ATTACHMENT", {
    message_id: messageId,
    attachment_id: attachmentId,
    file_name: fileName,
  });
  if (!res.ok) {
    console.warn(`[blog-edit-replies] attachment fetch failed: ${res.error}`);
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = res.data as any;
  const inline =
    (typeof d?.data === "string" && d.data) ||
    (typeof d?.data?.data === "string" && d.data.data) ||
    (typeof d === "string" && d) ||
    null;
  if (inline && !/^https?:\/\//.test(inline)) {
    // base64url → base64 round-trip via Buffer normalizes either encoding.
    return base64UrlToBuffer(inline).toString("base64");
  }
  // Composio wraps the file descriptor as a JSON string: { mimetype, name, s3url }
  let fileDescriptor: Record<string, string> = {};
  if (typeof d?.file === "string") {
    try { fileDescriptor = JSON.parse(d.file); } catch { /* ignore */ }
  } else if (typeof d?.file === "object" && d.file) {
    fileDescriptor = d.file as Record<string, string>;
  }
  const url =
    fileDescriptor.s3url ??
    fileDescriptor.url ??
    fileDescriptor.download_url ??
    d?.url ?? d?.uri ?? d?.s3url ?? d?.download_url ?? d?.data?.url;
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`download ${r.status}`);
      return Buffer.from(await r.arrayBuffer()).toString("base64");
    } catch (e) {
      console.warn(
        `[blog-edit-replies] attachment download failed: ${(e as Error).message}`,
      );
      return null;
    }
  }
  console.warn(
    `[blog-edit-replies] attachment had no usable data/url; keys=${Object.keys(d ?? {}).join(",")}`,
  );
  return null;
}

async function listUnreadDraftReplies(): Promise<GmailMessage[]> {
  // Gmail search: replies in the inbox that contain "[Draft]" and are unread.
  const res = await exec<GmailListResponse>("GMAIL_FETCH_EMAILS", {
    query: "is:unread subject:\"[Draft]\" in:inbox",
    max_results: 25,
    // Need the full MIME payload so we can detect photo attachments on replies.
    include_payload: true,
  });
  if (!res.ok) throw new Error(`gmail fetch failed: ${res.error}`);
  return res.data.messages ?? res.data.data?.messages ?? [];
}

async function markRead(messageId: string): Promise<void> {
  // GMAIL_MODIFY_MESSAGE doesn't exist in this Composio Gmail toolkit.
  // Use GMAIL_BATCH_MODIFY_MESSAGES (operates on an array) as primary,
  // fall back to GMAIL_REMOVE_LABEL. Both silently no-op if the message
  // is already read, so this is safe to call multiple times.
  let res = await exec("GMAIL_BATCH_MODIFY_MESSAGES", {
    ids: [messageId],
    remove_label_ids: ["UNREAD"],
  });
  if (!res.ok) {
    // Fallback
    res = await exec("GMAIL_REMOVE_LABEL", {
      message_id: messageId,
      label_id: "UNREAD",
    });
  }
  if (!res.ok) {
    console.warn(`[blog-edit-replies] failed to mark read ${messageId}: ${res.error}`);
  }
}

interface ProcessedResult {
  messageId: string;
  slug: string | null;
  status: "revised" | "skipped" | "error";
  detail?: string;
}

async function processReply(msg: GmailMessage): Promise<ProcessedResult> {
  const subject =
    msg.subject ?? headerValue(msg.payload?.headers, "Subject") ?? "";
  const slug = slugFromSubject(subject);
  const msgId = resolveMessageId(msg);
  if (!slug) {
    return {
      messageId: msgId,
      slug: null,
      status: "skipped",
      detail: `no calendar slug in subject "${subject}"`,
    };
  }

  const entry = CONTENT_CALENDAR.find((e) => e.slug === slug)!;
  const branch = `blog-draft/${slug}`;
  const pr = await findOpenPrByBranch(branch);
  if (!pr) {
    return {
      messageId: msgId,
      slug,
      status: "skipped",
      detail: `no open PR for ${branch} (already merged/closed?)`,
    };
  }

  const edits = stripQuotedReply(decodeGmailBody(msg));
  const hasEdits = !!edits && edits.length >= 6;
  const attachment = extractImageAttachment(msg);

  if (!hasEdits && !attachment) {
    return {
      messageId: msgId,
      slug,
      status: "skipped",
      detail: "reply has no edit text or image attachment",
    };
  }

  // 1. If the reviewer attached a photo, swap the post's cover image.
  let newCoverUrl: string | null = null;
  if (attachment) {
    const b64 = await fetchAttachmentBase64(
      msgId,
      attachment.attachmentId,
      attachment.filename,
    );
    if (b64) {
      newCoverUrl = await updateDraftCoverImage({
        slug,
        branch,
        contentBase64: b64,
        ext: attachment.ext,
      });
    } else {
      console.warn(
        `[blog-edit-replies] ${slug}: image attachment found but could not be fetched/decoded`,
      );
    }
  }

  // 2. If the reviewer wrote edits, revise the copy via Claude and email v2.
  if (hasEdits) {
    const currentHtml = await fetchDraftContent({ slug, branch });
    const revised = await revisePost({ entry, currentHtml, edits });
    await updateDraftContent({
      slug,
      branch,
      html: revised.html,
      commitMessage: `blog(draft): revise ${slug} per reviewer edits`,
    });
    await sendDraftEmail({
      entry,
      draft: revised.draft,
      articleHtml: revised.html,
      prUrl: pr.url,
      prNumber: pr.number,
      coverImageUrl: newCoverUrl,
      coverBranch: branch,
      issues: revised.issues.map((i) => `${i.kind}: ${i.detail}`),
      isRevision: true,
    });
  } else if (newCoverUrl) {
    // Photo-only reply: confirm the new cover, no text revision.
    await sendCoverUpdatedEmail({
      entry,
      prUrl: pr.url,
      prNumber: pr.number,
      coverImageUrl: newCoverUrl,
      coverBranch: branch,
    });
  } else {
    // Attachment present but unusable, and no text edits → nothing to apply.
    await markRead(msgId);
    return {
      messageId: msgId,
      slug,
      status: "skipped",
      detail: "image attachment present but could not be applied",
    };
  }

  await markRead(msgId);
  const applied = [hasEdits ? "text" : null, newCoverUrl ? "cover" : null]
    .filter(Boolean)
    .join("+");
  return { messageId: msgId, slug, status: "revised", detail: applied };
}

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  let messages: GmailMessage[];
  try {
    messages = await listUnreadDraftReplies();
  } catch (e) {
    console.error("[blog-edit-replies] gmail list failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ status: "no-new-replies" });
  }

  if (dryRun) {
    return NextResponse.json({
      status: "dry-run",
      candidates: messages.map((m) => ({
        id: resolveMessageId(m),
        subject:
          m.subject ?? headerValue(m.payload?.headers, "Subject") ?? "(no subject)",
        slug: slugFromSubject(
          m.subject ?? headerValue(m.payload?.headers, "Subject") ?? "",
        ),
        snippet: (m.snippet ?? "").slice(0, 120),
      })),
    });
  }

  const results: ProcessedResult[] = [];
  for (const msg of messages) {
    try {
      results.push(await processReply(msg));
    } catch (e) {
      const detail = (e as Error).message;
      console.error("[blog-edit-replies] process failed:", e);
      const errMsgId = resolveMessageId(msg);
      results.push({
        messageId: errMsgId,
        slug: null,
        status: "error",
        detail,
      });
      // Alert on real failures (not skips).
      try {
        await sendAlert(
          "Blog edit-reply: FAILED",
          `Failed to process reply ${errMsgId}.\n\n${detail}`,
          `blog-edit-reply-${errMsgId}`,
        );
      } catch {
        /* swallow */
      }
    }
  }

  return NextResponse.json({
    status: "ok",
    processed: results.length,
    results,
  });
}
