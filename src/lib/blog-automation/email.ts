// Draft-review email layer.
//
// Sends from marketing@traversehospitality.com via Composio's Gmail tool so
// replies land back in that inbox (which the reply-watcher cron polls). The
// "Approve & Publish" button is a signed link to /api/blog/approve — short
// HMAC tokens with a 30-day expiry, no DB needed.

import crypto from "node:crypto";
import { exec } from "./composio";
import type { CalendarEntry } from "./calendar";
import type { ParsedDraft } from "./markdown";

const REVIEWER_EMAIL =
  process.env.BLOG_REVIEWER_EMAIL ?? "ngtannous@gmail.com";
// Additional reviewers CC'd on every draft + revision email. Comma-separated
// in BLOG_REVIEWER_CC; defaults to Natasha. Their reply-all to a draft keeps
// the [Draft] subject, so the reply-watcher picks it up like any other edit.
const REVIEWER_CC = (
  process.env.BLOG_REVIEWER_CC ?? "natasha@traversehospitality.com"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const SENDER_FROM = "Traverse Blog Bot <marketing@traversehospitality.com>";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.booktraverse.com";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// ──────────────────────────────────────────────────────────────────────
//  Signed tokens
// ──────────────────────────────────────────────────────────────────────

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function getSecret(): string {
  const s = process.env.BLOG_APPROVAL_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "BLOG_APPROVAL_SECRET is required and must be at least 32 chars",
    );
  }
  return s;
}

export interface ApprovalPayload {
  slug: string;
  prNumber: number;
  exp: number; // unix seconds
}

export function signApprovalToken(
  p: Omit<ApprovalPayload, "exp">,
): string {
  const payload: ApprovalPayload = {
    ...p,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export function verifyApprovalToken(token: string): ApprovalPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let expectedSig: Buffer;
  try {
    expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(payloadB64)
      .digest();
  } catch {
    return null;
  }
  let givenSig: Buffer;
  try {
    givenSig = b64urlDecode(sigB64);
  } catch {
    return null;
  }
  if (
    expectedSig.length !== givenSig.length ||
    !crypto.timingSafeEqual(expectedSig, givenSig)
  ) {
    return null;
  }
  let payload: ApprovalPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
    return null;
  }
  if (
    typeof payload.slug !== "string" ||
    typeof payload.prNumber !== "number"
  ) {
    return null;
  }
  return payload;
}

// ──────────────────────────────────────────────────────────────────────
//  Email rendering
// ──────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function previewFromBody(body: string, words = 80): string {
  // Strip frontmatter + headings + markdown link wrappers, take first N words.
  const plain = body
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = plain.split(" ").filter(Boolean).slice(0, words);
  return tokens.join(" ") + (tokens.length === words ? "…" : "");
}

interface DraftEmailArgs {
  entry: CalendarEntry;
  draft: ParsedDraft;
  prUrl: string;
  prNumber: number;
  /** Public path on the live site, e.g. "/blog/<slug>.jpg" — left null when no image found. */
  coverImageUrl: string | null;
  coverImageReason?: string;
  /** Validation issues from the generator, if any. */
  issues?: string[];
  /** True if this is a re-send after a revision. */
  isRevision?: boolean;
}

export function renderDraftEmailHtml(args: DraftEmailArgs): {
  subject: string;
  html: string;
  textFallback: string;
} {
  const { entry, draft, prUrl, prNumber, coverImageUrl, isRevision } = args;
  const token = signApprovalToken({ slug: entry.slug, prNumber });
  const approveUrl = `${SITE_URL}/api/blog/approve?token=${encodeURIComponent(token)}`;
  const editsSubject = `Re: [Draft] ${entry.slug}`;
  // mailto must NOT URL-encode the @ in the recipient itself; only encode the
  // subject/body params.
  const editsBody =
    `Hi blog bot,\n\n` +
    `Please revise the draft for "${entry.title}" with these edits:\n\n` +
    `[type your edits here — be specific about which sections to change]\n\n` +
    `— Nadim`;
  const editsHref = `mailto:marketing@traversehospitality.com?subject=${encodeURIComponent(editsSubject)}&body=${encodeURIComponent(editsBody)}`;

  const preview = previewFromBody(draft.body);
  const issuesBlock = args.issues?.length
    ? `<div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;margin:20px 0;border-radius:4px;font-size:14px;">
         <strong style="color:#92400E;">Validation notes:</strong>
         <ul style="margin:6px 0 0 0;padding-left:18px;color:#78350F;">
           ${args.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
         </ul>
       </div>`
    : "";

  const coverBlock = coverImageUrl
    ? `<div style="margin:20px 0;">
         <img src="${SITE_URL}${escapeHtml(coverImageUrl)}" alt="Cover image" style="max-width:100%;height:auto;border-radius:8px;display:block;" />
         ${args.coverImageReason ? `<div style="font-size:12px;color:#6B7280;margin-top:6px;text-align:center;font-style:italic;">${escapeHtml(args.coverImageReason)}</div>` : ""}
       </div>`
    : `<div style="background:#FEE2E2;border-left:4px solid #DC2626;padding:12px 16px;margin:20px 0;border-radius:4px;font-size:14px;color:#991B1B;">
         No cover image picked from Drive — add one manually before merging.
       </div>`;

  const heading = isRevision
    ? `Revised draft ready: ${escapeHtml(entry.title)}`
    : `New draft ready: ${escapeHtml(entry.title)}`;

  const subject = isRevision
    ? `[Draft v2] ${entry.title}`
    : `[Draft] ${entry.title}`;

  const html = `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;line-height:1.5;">
    <h1 style="font-size:22px;margin:0 0 8px 0;">${heading}</h1>
    <div style="color:#6B7280;font-size:14px;margin-bottom:16px;">
      Scheduled publish: ${escapeHtml(entry.publishDate)} &middot; Slug: <code>${escapeHtml(entry.slug)}</code>
    </div>

    ${coverBlock}

    <p style="font-size:14px;color:#4B5563;margin:0 0 4px 0;"><strong>Meta description</strong></p>
    <p style="font-size:14px;color:#111827;margin:0 0 16px 0;font-style:italic;">${escapeHtml(draft.frontmatter.meta_description)}</p>

    <p style="font-size:14px;color:#4B5563;margin:0 0 4px 0;"><strong>Preview</strong></p>
    <p style="font-size:14px;color:#111827;margin:0 0 16px 0;">${escapeHtml(preview)}</p>

    ${issuesBlock}

    <div style="margin:28px 0;">
      <a href="${approveUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px;">Approve &amp; Publish</a>
      <a href="${editsHref}" style="display:inline-block;background:#F3F4F6;color:#111827;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px;">Request edits</a>
      <a href="${escapeHtml(prUrl)}" style="display:inline-block;color:#2563EB;padding:12px 6px;text-decoration:none;font-weight:600;">View PR &rarr;</a>
    </div>

    <div style="border-top:1px solid #E5E7EB;padding-top:16px;font-size:12px;color:#9CA3AF;">
      <strong>To request edits:</strong> reply to this email keeping the <code>[Draft]</code> tag and slug in the subject. The bot polls this inbox every 5 minutes, rewrites the draft, and re-sends.
      <br/><br/>
      Approval link is signed and valid for 30 days. Sent by the Traverse blog automation.
    </div>
  </body>
</html>`;

  const textFallback = [
    heading,
    "",
    `Scheduled publish: ${entry.publishDate}`,
    `Slug: ${entry.slug}`,
    "",
    `Meta description: ${draft.frontmatter.meta_description}`,
    "",
    `Preview: ${preview}`,
    "",
    `Approve & Publish: ${approveUrl}`,
    `Request edits: reply to this email keeping "[Draft] ${entry.slug}" in the subject`,
    `View PR: ${prUrl}`,
  ].join("\n");

  return { subject, html, textFallback };
}

// ──────────────────────────────────────────────────────────────────────
//  Outbound
// ──────────────────────────────────────────────────────────────────────

interface GmailSendResult {
  id?: string;
  threadId?: string;
  thread_id?: string;
}

async function gmailSend(args: {
  to: string;
  subject: string;
  html: string;
  textFallback: string;
  cc?: string[];
}): Promise<{ messageId?: string; threadId?: string }> {
  const res = await exec<GmailSendResult>("GMAIL_SEND_EMAIL", {
    recipient_email: args.to,
    subject: args.subject,
    body: args.html,
    is_html: true,
    ...(args.cc && args.cc.length ? { cc: args.cc } : {}),
    // Some Composio Gmail tool versions take `from`; including it is harmless
    // if ignored, and required to send-as the marketing@ alias on others.
    from: SENDER_FROM,
  });
  if (!res.ok) throw new Error(`gmail send failed: ${res.error}`);
  return {
    messageId: res.data.id,
    threadId: res.data.threadId ?? res.data.thread_id,
  };
}

export async function sendDraftEmail(
  args: DraftEmailArgs,
): Promise<{ messageId?: string; threadId?: string }> {
  const { subject, html, textFallback } = renderDraftEmailHtml(args);
  void textFallback; // Gmail tool sends HTML; fallback kept in code for future plain-text mode.
  return gmailSend({
    to: REVIEWER_EMAIL,
    subject,
    html,
    textFallback,
    cc: REVIEWER_CC,
  });
}

export async function sendApprovalConfirmation(args: {
  entry: CalendarEntry;
  liveUrl: string;
  mergedSha: string;
}): Promise<void> {
  const html = `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;line-height:1.5;">
    <h1 style="font-size:22px;margin:0 0 12px 0;">Published: ${escapeHtml(args.entry.title)}</h1>
    <p style="font-size:14px;color:#4B5563;">The PR has been squash-merged. Vercel will deploy the post within a couple of minutes.</p>
    <p style="font-size:14px;color:#4B5563;">Live URL: <a href="${escapeHtml(args.liveUrl)}">${escapeHtml(args.liveUrl)}</a></p>
    <p style="font-size:12px;color:#9CA3AF;">Merged commit: <code>${escapeHtml(args.mergedSha.slice(0, 8))}</code></p>
  </body>
</html>`;
  await gmailSend({
    to: REVIEWER_EMAIL,
    subject: `Published: ${args.entry.title}`,
    html,
    textFallback: `Published: ${args.entry.title}\nLive: ${args.liveUrl}\nMerged: ${args.mergedSha}`,
  });
}

/**
 * Lightweight notice sent when a reviewer reply updated only the cover image
 * (no text edits) — shows the new cover and keeps the approve/edit/PR buttons.
 * Subject keeps the "[Draft] <title>" tag so further replies still route to
 * the reply-watcher.
 */
export async function sendCoverUpdatedEmail(args: {
  entry: CalendarEntry;
  prUrl: string;
  prNumber: number;
  coverImageUrl: string;
}): Promise<{ messageId?: string; threadId?: string }> {
  const { entry, prUrl, prNumber, coverImageUrl } = args;
  const token = signApprovalToken({ slug: entry.slug, prNumber });
  const approveUrl = `${SITE_URL}/api/blog/approve?token=${encodeURIComponent(token)}`;
  const editsHref = `mailto:marketing@traversehospitality.com?subject=${encodeURIComponent(`Re: [Draft] ${entry.slug}`)}`;
  const subject = `[Draft] ${entry.title} — cover image updated`;

  const html = `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;line-height:1.5;">
    <h1 style="font-size:22px;margin:0 0 8px 0;">Cover image updated: ${escapeHtml(entry.title)}</h1>
    <div style="color:#6B7280;font-size:14px;margin-bottom:16px;">
      Applied the photo from your reply. Text content is unchanged. Slug: <code>${escapeHtml(entry.slug)}</code>
    </div>
    <div style="margin:20px 0;">
      <img src="${SITE_URL}${escapeHtml(coverImageUrl)}" alt="Updated cover image" style="max-width:100%;height:auto;border-radius:8px;display:block;" />
    </div>
    <div style="margin:28px 0;">
      <a href="${approveUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px;">Approve &amp; Publish</a>
      <a href="${editsHref}" style="display:inline-block;background:#F3F4F6;color:#111827;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px;">Request edits</a>
      <a href="${escapeHtml(prUrl)}" style="display:inline-block;color:#2563EB;padding:12px 6px;text-decoration:none;font-weight:600;">View PR &rarr;</a>
    </div>
    <div style="border-top:1px solid #E5E7EB;padding-top:16px;font-size:12px;color:#9CA3AF;">
      Reply (keeping the <code>[Draft]</code> tag + slug in the subject) to request text edits or send another photo. Approval link is signed and valid for 30 days.
    </div>
  </body>
</html>`;

  const textFallback = [
    `Cover image updated: ${entry.title}`,
    `Approve & Publish: ${approveUrl}`,
    `View PR: ${prUrl}`,
  ].join("\n");

  return gmailSend({
    to: REVIEWER_EMAIL,
    subject,
    html,
    textFallback,
    cc: REVIEWER_CC,
  });
}

export const __test = {
  previewFromBody,
  REVIEWER_EMAIL,
};
