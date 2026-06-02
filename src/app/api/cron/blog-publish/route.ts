// Blog publishing cron — runs every 3 days at 8am Mountain (15:00 UTC).
// Picks the next pending entry from src/lib/blog-automation/calendar.ts,
// asks Claude to write it, validates, opens a draft PR on GitHub.
//
// Auth: Bearer CRON_SECRET (same pattern as other crons in this repo).
// Manual test: GET /api/cron/blog-publish?slug=<calendar-slug> with the
// Bearer token to force a specific entry regardless of date.

import { NextResponse } from "next/server";
import { generateNextPost } from "@/lib/blog-automation/generate";
import { CONTENT_CALENDAR } from "@/lib/blog-automation/calendar";
import { openDraftPr } from "@/lib/blog-automation/github";
import { pickImageForEntry } from "@/lib/blog-automation/image-picker";
import { sendDraftEmail } from "@/lib/blog-automation/email";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — Claude can be slow on long posts.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const forcedSlug = url.searchParams.get("slug");
  const dryRun = url.searchParams.get("dryRun") === "1";

  const entry = forcedSlug
    ? CONTENT_CALENDAR.find((e) => e.slug === forcedSlug)
    : undefined;
  if (forcedSlug && !entry) {
    return NextResponse.json(
      { error: `Calendar entry not found for slug: ${forcedSlug}` },
      { status: 404 },
    );
  }

  try {
    const result = await generateNextPost({ entry });
    if (!result) {
      return NextResponse.json({ status: "nothing-due" });
    }

    if (dryRun) {
      return NextResponse.json({
        status: "dry-run",
        slug: result.entry.slug,
        title: result.draft.frontmatter.title,
        wordCount: result.draft.body.split(/\s+/).filter(Boolean).length,
        issues: result.issues,
        attempts: result.attempts,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
      });
    }

    // Pick a cover image from Drive. Failure here is non-fatal — we still
    // open the PR + email the draft, just without an image.
    let coverImage: Awaited<ReturnType<typeof pickImageForEntry>> = null;
    try {
      coverImage = await pickImageForEntry(result.entry);
    } catch (e) {
      console.error("[blog-publish] image-picker failed:", e);
    }

    const pr = await openDraftPr({
      entry: result.entry,
      draft: result.draft,
      html: result.html,
      issues: result.issues.map((i) => `${i.kind}: ${i.detail}`),
      coverImage: coverImage
        ? {
            repoPath: coverImage.repoPath,
            publicUrl: coverImage.publicUrl,
            contentBase64: coverImage.contentBase64,
          }
        : undefined,
    });

    // Send the draft-review email (Composio Gmail → marketing@). Best-effort:
    // if Gmail send fails, fall back to the in-repo sendAlert so we still
    // surface that a draft is waiting.
    try {
      await sendDraftEmail({
        entry: result.entry,
        draft: result.draft,
        articleHtml: result.html,
        prUrl: pr.url,
        prNumber: pr.number,
        coverImageUrl: coverImage?.publicUrl ?? null,
        coverImageReason: coverImage
          ? `Picked ${coverImage.sourceName} from ${coverImage.sourceFolder} — ${coverImage.reason}`
          : undefined,
        issues: result.issues.map((i) => `${i.kind}: ${i.detail}`),
      });
    } catch (e) {
      console.error("[blog-publish] draft email failed:", e);
      try {
        await sendAlert(
          `Blog draft ready (email failed): ${result.entry.title}`,
          `Gmail send failed for draft ${result.entry.slug}.\n\nPR: ${pr.url}\n\nError: ${(e as Error).message}`,
          `blog-draft-${result.entry.slug}`,
        );
      } catch {
        /* swallow */
      }
    }

    return NextResponse.json({
      status: "ok",
      slug: result.entry.slug,
      pr: pr.url,
      branch: pr.branch,
      coverImage: coverImage
        ? {
            sourceName: coverImage.sourceName,
            sourceFolder: coverImage.sourceFolder,
            publicUrl: coverImage.publicUrl,
          }
        : null,
      issues: result.issues,
      attempts: result.attempts,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[blog-publish] error:", e);
    try {
      await sendAlert(
        "Blog automation: FAILED",
        `The blog publishing cron failed.\n\n${msg}`,
        "blog-publish-failure",
      );
    } catch {
      /* swallow */
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
