import { NextResponse } from "next/server";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// ── Production content smoke test ────────────────────────────────────────
// WHY THIS EXISTS: the /plan page once served stale "Stay Portland" branding
// in production for an unknown stretch because the Colorado rewrite was
// finished locally but never committed/pushed. tsc/build guards can't catch
// that — the code that shipped was internally valid, it was just the OLD
// code. The only reliable signal is checking what the LIVE site actually
// renders. This cron fetches key public pages on the *currently deployed*
// app and asserts brand invariants: required Colorado tokens must be present
// and banned Portland-era phrases must be absent. If an assertion fails we
// email via sendAlert (1h dedup) so a stale/wrong deploy is caught in hours,
// not whenever a human happens to notice.
//
// We fetch the deployment's OWN origin (derived from the incoming request),
// not a hardcoded domain. That makes the check correct regardless of the
// booktraverse.com DNS-cutover state — it always validates the code that is
// actually live behind this cron.

// Phrases that must NEVER appear on any public page post-rebrand. Kept
// specific (not the bare word "Portland") to avoid false positives from
// legitimate uses like 301-redirect source paths.
const GLOBAL_BANNED = [
  "Stay Portland",
  "Plan your perfect Portland",
  "Portland trip",
  "275+ Portland",
  "Portland homes",
  "Portlanders",
  "managing 275+",
] as const;

interface PageCheck {
  path: string;
  // At least one of these must appear (proves the page rendered our brand,
  // not an error page or a stale cache). Empty = no positive requirement.
  mustContainAny: string[];
  // In addition to GLOBAL_BANNED, page-specific banned phrases.
  mustNotContain: string[];
}

const CHECKS: PageCheck[] = [
  {
    path: "/plan",
    mustContainAny: ["Colorado trip", "Colorado"],
    mustNotContain: ["Classic Portland", "Portland with kids"],
  },
  {
    path: "/",
    mustContainAny: ["Traverse"],
    mustNotContain: [],
  },
  {
    path: "/properties",
    mustContainAny: ["Traverse"],
    mustNotContain: [],
  },
];

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  const isVercelCron = userAgent.startsWith("vercel-cron/");
  const triggerSource = isVercelCron ? "vercel-cron" : "manual";
  const startMs = Date.now();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn(
      `[smoke-content] UNAUTHORIZED trigger=${triggerSource} (cronSecret set=${!!cronSecret})`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate the deployment that is serving THIS request.
  const origin = new URL(request.url).origin;
  console.log(`[smoke-content] start trigger=${triggerSource} origin=${origin}`);

  const failures: string[] = [];
  const results: Record<string, unknown> = {};

  for (const check of CHECKS) {
    const url = `${origin}${check.path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "traverse-smoke-content/1.0" },
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));

      if (!resp.ok) {
        const msg = `${check.path} returned HTTP ${resp.status}`;
        failures.push(msg);
        results[check.path] = { ok: false, status: resp.status };
        continue;
      }

      const html = await resp.text();

      const banned = [...GLOBAL_BANNED, ...check.mustNotContain].filter((p) =>
        html.includes(p)
      );
      const positiveOk =
        check.mustContainAny.length === 0 ||
        check.mustContainAny.some((p) => html.includes(p));

      const pageFailures: string[] = [];
      if (banned.length > 0) {
        pageFailures.push(
          `${check.path} contains banned phrase(s): ${banned.join(", ")}`
        );
      }
      if (!positiveOk) {
        pageFailures.push(
          `${check.path} missing all expected token(s): ${check.mustContainAny.join(", ")}`
        );
      }

      failures.push(...pageFailures);
      results[check.path] = {
        ok: pageFailures.length === 0,
        status: resp.status,
        bytes: html.length,
        ...(banned.length > 0 ? { banned } : {}),
        ...(positiveOk ? {} : { missingExpected: check.mustContainAny }),
      };
    } catch (err) {
      const msg = `${check.path} fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      failures.push(msg);
      results[check.path] = { ok: false, error: msg };
    }
  }

  const passed = failures.length === 0;
  console.log(
    `[smoke-content] done trigger=${triggerSource} passed=${passed} failures=${failures.length} totalMs=${Date.now() - startMs}`
  );

  if (!passed) {
    await sendAlert(
      "Production content smoke test FAILED",
      `<p>The content smoke test found problems on the live deploy (<code>${escapeHtml(origin)}</code>).</p>
       <p><strong>Trigger:</strong> ${escapeHtml(triggerSource)}</p>
       <ul>${failures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
       <p>This usually means finished work was never committed/pushed, a deploy
       served stale code, or a page is erroring. Check <code>git status</code>
       for an uncommitted backlog and the latest Vercel deployment.</p>`,
      "cron-smoke-content-fail"
    );
  }

  return NextResponse.json(
    { passed, origin, ...results },
    { status: passed ? 200 : 500 }
  );
}
