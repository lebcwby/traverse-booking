/**
 * Smoke test for the blog-automation Composio integrations.
 *
 * Runs three independent checks:
 *   1. Drive — list children of the blog-images folder. Proves Composio
 *      auth + Google Drive linkage are working.
 *   2. Gmail — send a tiny "hello" email to BLOG_REVIEWER_EMAIL from the
 *      marketing@ alias. Proves Composio Gmail linkage works AND that the
 *      email actually arrives in your inbox.
 *   3. HMAC token round-trip — signs an approval payload with
 *      BLOG_APPROVAL_SECRET and verifies it. Catches a missing or too-short
 *      secret BEFORE the cron tries to send a real approve link.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/smoke-test-blog-automation.ts
 *
 * Each check runs and reports independently — one failure doesn't block the
 * others. Exit code 0 only if all three pass.
 */

import { exec } from "../src/lib/blog-automation/composio";
import {
  signApprovalToken,
  verifyApprovalToken,
} from "../src/lib/blog-automation/email";

const ROOT_FOLDER_ID =
  process.env.DRIVE_BLOG_IMAGES_FOLDER_ID ??
  "1NYFL4yN1t_BtoYi8Sh7VGxMdG_AqmmjM";
const REVIEWER =
  process.env.BLOG_REVIEWER_EMAIL ?? "nadim@traversehospitality.com";

function line(): void {
  console.log("─".repeat(60));
}

function header(n: number, title: string): void {
  console.log("");
  line();
  console.log(`  ${n}. ${title}`);
  line();
}

function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string): void {
  console.log(`  ✗ ${msg}`);
}

async function checkDrive(): Promise<boolean> {
  header(1, "Drive — list blog-images folder");
  console.log(`  Folder ID: ${ROOT_FOLDER_ID}`);

  const res = await exec<{
    files?: Array<{ id: string; name: string; mimeType: string }>;
    data?: { files?: Array<{ id: string; name: string; mimeType: string }> };
  }>("GOOGLEDRIVE_LIST_FILES", {
    q: `'${ROOT_FOLDER_ID}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 200,
  });

  if (!res.ok) {
    fail(`drive list failed: ${res.error}`);
    return false;
  }

  const files = res.data.files ?? res.data.data?.files ?? [];
  if (files.length === 0) {
    fail("folder is reachable but empty — check the folder ID + sharing");
    return false;
  }

  const folders = files.filter(
    (f) => f.mimeType === "application/vnd.google-apps.folder",
  );
  const images = files.filter((f) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name),
  );

  ok(`found ${files.length} items (${folders.length} subfolders, ${images.length} images at root)`);
  if (folders.length > 0) {
    console.log("  Subfolders:");
    for (const f of folders.slice(0, 10)) console.log(`    • ${f.name}`);
    if (folders.length > 10) console.log(`    … and ${folders.length - 10} more`);
  }
  return true;
}

async function checkGmail(): Promise<boolean> {
  header(2, `Gmail — send smoke-test email to ${REVIEWER}`);

  const subject = "[Smoke test] Traverse blog automation — Gmail OK";
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,sans-serif;max-width:540px;margin:40px auto;padding:24px;">
  <h2 style="color:#059669;">✓ Composio Gmail is working</h2>
  <p>If you're reading this, the blog automation can send emails from
     <code>marketing@traversehospitality.com</code> to your inbox.</p>
  <p style="color:#6B7280;font-size:13px;">Sent by <code>scripts/smoke-test-blog-automation.ts</code> at ${new Date().toISOString()}.</p>
  <p style="color:#9CA3AF;font-size:12px;">Safe to delete.</p>
</body></html>`;

  const res = await exec<{ id?: string; threadId?: string }>(
    "GMAIL_SEND_EMAIL",
    {
      recipient_email: REVIEWER,
      subject,
      body: html,
      is_html: true,
      from: "Traverse Blog Bot <marketing@traversehospitality.com>",
    },
  );

  if (!res.ok) {
    fail(`gmail send failed: ${res.error}`);
    return false;
  }
  ok(`sent. message id: ${res.data.id ?? "(none returned)"}`);
  ok(`check ${REVIEWER} inbox — should arrive within ~30 seconds`);
  return true;
}

function checkHmac(): boolean {
  header(3, "HMAC — sign + verify approval token");

  if (!process.env.BLOG_APPROVAL_SECRET) {
    fail("BLOG_APPROVAL_SECRET is not set");
    return false;
  }
  if (process.env.BLOG_APPROVAL_SECRET.length < 32) {
    fail(
      `BLOG_APPROVAL_SECRET is only ${process.env.BLOG_APPROVAL_SECRET.length} chars — needs ≥ 32`,
    );
    return false;
  }

  const token = signApprovalToken({
    slug: "smoke-test-slug",
    prNumber: 99999,
  });
  const verified = verifyApprovalToken(token);

  if (!verified) {
    fail("token signed but failed to verify — implementation bug");
    return false;
  }
  if (verified.slug !== "smoke-test-slug" || verified.prNumber !== 99999) {
    fail(`payload mismatch: ${JSON.stringify(verified)}`);
    return false;
  }

  // Tamper test — should fail.
  const tampered = token.slice(0, -3) + "AAA";
  if (verifyApprovalToken(tampered) !== null) {
    fail("tampered token verified — HMAC implementation is broken");
    return false;
  }

  ok("sign + verify works");
  ok("tamper detection works");
  return true;
}

async function main(): Promise<void> {
  console.log("");
  console.log("Traverse blog automation — smoke test");
  console.log(`Composio API key: ${process.env.COMPOSIO_API_KEY ? "set" : "MISSING"}`);
  console.log(`Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`);

  if (!process.env.COMPOSIO_API_KEY) {
    console.log("");
    console.log("✗ COMPOSIO_API_KEY is missing. Add it to .env.local first.");
    process.exit(1);
  }

  const results = {
    drive: false,
    gmail: false,
    hmac: false,
  };

  try {
    results.drive = await checkDrive();
  } catch (e) {
    fail(`drive check threw: ${(e as Error).message}`);
  }
  try {
    results.gmail = await checkGmail();
  } catch (e) {
    fail(`gmail check threw: ${(e as Error).message}`);
  }
  try {
    results.hmac = checkHmac();
  } catch (e) {
    fail(`hmac check threw: ${(e as Error).message}`);
  }

  console.log("");
  line();
  console.log("  Summary");
  line();
  console.log(`  Drive:  ${results.drive ? "✓ pass" : "✗ FAIL"}`);
  console.log(`  Gmail:  ${results.gmail ? "✓ pass" : "✗ FAIL"}`);
  console.log(`  HMAC:   ${results.hmac ? "✓ pass" : "✗ FAIL"}`);
  console.log("");

  const allPassed = results.drive && results.gmail && results.hmac;
  if (allPassed) {
    console.log("  All three pass — you're clear to run the cron.");
    console.log("");
    process.exit(0);
  } else {
    console.log("  One or more checks failed. Fix above, then re-run.");
    console.log("");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
