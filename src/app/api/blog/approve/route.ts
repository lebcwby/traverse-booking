// One-click approval endpoint. The draft email contains a link to this
// route with a signed token. Clicking it:
//   1. Verifies the HMAC token (slug + prNumber + 30-day exp)
//   2. Squash-merges the PR on GitHub
//   3. Sends a confirmation email
//   4. Returns a tiny HTML success page
//
// Idempotent — clicking an already-merged token reports the existing live
// URL rather than erroring.

import { verifyApprovalToken, sendApprovalConfirmation } from "@/lib/blog-automation/email";
import { mergePullRequest } from "@/lib/blog-automation/github";
import { CONTENT_CALENDAR } from "@/lib/blog-automation/calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.booktraverse.com";

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function successPage(args: { title: string; liveUrl: string }): string {
  return `<!doctype html>
<html><head><title>Approved</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:540px;margin:80px auto;padding:24px;color:#111827;text-align:center;">
  <div style="font-size:48px;margin-bottom:12px;">✓</div>
  <h1 style="font-size:24px;margin:0 0 12px 0;">Approved &amp; merged</h1>
  <p style="color:#4B5563;">${args.title}</p>
  <p style="color:#6B7280;font-size:14px;">Vercel will publish within ~2 minutes.</p>
  <p style="margin-top:24px;"><a href="${args.liveUrl}" style="color:#2563EB;">View the live post →</a></p>
</body></html>`;
}

function errorPage(message: string, status = 400): Response {
  return htmlResponse(
    status,
    `<!doctype html>
<html><head><title>Approval failed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:540px;margin:80px auto;padding:24px;color:#111827;text-align:center;">
  <div style="font-size:48px;margin-bottom:12px;">✗</div>
  <h1 style="font-size:24px;margin:0 0 12px 0;">Could not approve draft</h1>
  <p style="color:#4B5563;">${message.replace(/[<>]/g, "")}</p>
</body></html>`,
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return errorPage("Missing approval token", 400);

  const payload = verifyApprovalToken(token);
  if (!payload) {
    return errorPage(
      "Token is invalid, tampered with, or older than 30 days. Re-trigger the cron to get a fresh draft email.",
      401,
    );
  }

  const entry = CONTENT_CALENDAR.find((e) => e.slug === payload.slug);
  if (!entry) {
    return errorPage(`Unknown calendar slug: ${payload.slug}`, 404);
  }

  const liveUrl = `${SITE_URL}/blog/${entry.slug}`;

  try {
    const result = await mergePullRequest(
      payload.prNumber,
      `blog: publish ${entry.slug}`,
    );

    // Best-effort confirmation email — never fail the user-visible flow on it.
    try {
      await sendApprovalConfirmation({
        entry,
        liveUrl,
        mergedSha: result.sha,
      });
    } catch (e) {
      console.error("[blog-approve] confirmation email failed:", e);
    }

    return htmlResponse(
      200,
      successPage({ title: entry.title, liveUrl }),
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[blog-approve] merge failed:", e);
    return errorPage(`Merge failed: ${msg}`, 500);
  }
}
