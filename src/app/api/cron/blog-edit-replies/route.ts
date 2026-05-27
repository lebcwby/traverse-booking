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
} from "@/lib/blog-automation/github";
import { sendDraftEmail } from "@/lib/blog-automation/email";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface GmailMessage {
  id: string;
  threadId?: string;
  thread_id?: string;
  subject?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
  body?: string;
  snippet?: string;
  messageText?: string;
}

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

function decodeGmailBody(msg: GmailMessage): string {
  // Composio's GMAIL_FETCH_EMAILS commonly returns a `messageText` field with
  // plaintext extracted. Fall back to snippet if that's missing.
  return (msg.messageText ?? msg.body ?? msg.snippet ?? "").trim();
}

async function listUnreadDraftReplies(): Promise<GmailMessage[]> {
  // Gmail search: replies in the inbox that contain "[Draft]" and are unread.
  const res = await exec<GmailListResponse>("GMAIL_FETCH_EMAILS", {
    query: "is:unread subject:\"[Draft]\" in:inbox",
    max_results: 25,
  });
  if (!res.ok) throw new Error(`gmail fetch failed: ${res.error}`);
  return res.data.messages ?? res.data.data?.messages ?? [];
}

async function markRead(messageId: string): Promise<void> {
  // Best-effort. If the tool isn't available, log and move on — but we'd
  // process the same message every 5 minutes, so warn loudly.
  const res = await exec("GMAIL_MODIFY_MESSAGE", {
    message_id: messageId,
    remove_label_ids: ["UNREAD"],
  });
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
  if (!slug) {
    return {
      messageId: msg.id,
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
      messageId: msg.id,
      slug,
      status: "skipped",
      detail: `no open PR for ${branch} (already merged/closed?)`,
    };
  }

  const edits = stripQuotedReply(decodeGmailBody(msg));
  if (!edits || edits.length < 6) {
    return {
      messageId: msg.id,
      slug,
      status: "skipped",
      detail: "reply body empty after quote-strip",
    };
  }

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
    prUrl: pr.url,
    prNumber: pr.number,
    coverImageUrl: null, // image already committed on first draft; no change here
    issues: revised.issues.map((i) => `${i.kind}: ${i.detail}`),
    isRevision: true,
  });

  await markRead(msg.id);

  return { messageId: msg.id, slug, status: "revised" };
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
        id: m.id,
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
      results.push({
        messageId: msg.id,
        slug: null,
        status: "error",
        detail,
      });
      // Alert on real failures (not skips).
      try {
        await sendAlert(
          "Blog edit-reply: FAILED",
          `Failed to process reply ${msg.id}.\n\n${detail}`,
          `blog-edit-reply-${msg.id}`,
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
