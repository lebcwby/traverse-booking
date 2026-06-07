/**
 * Daily Guesty (BEAPI) → `listings`-table sync.
 *
 * Populates/refreshes the Supabase `listings` mirror that the site's SEO/feed
 * surfaces read (landing pages, sitemap property URLs, Microsoft/Bing feeds,
 * search-suggestions, featured). The table was empty before this cron existed.
 *
 * Schedule: 0 9 * * * UTC (≈3 AM Mountain), just after the nightly reviews
 * sync and off peak traffic. The fetch is ~2 BEAPI pages and reuses the cached
 * token (no new OAuth mint), so it stays well under Guesty's 5-token/24h cap.
 *
 * Idempotent (upsert on guesty_id). Same auth pattern as the other crons
 * (Bearer CRON_SECRET). Trigger the initial population manually with:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.booktraverse.com/api/cron/sync-listings
 */
import { NextResponse } from "next/server";
import { syncAllListings } from "@/lib/guesty-listings-sync";
import { renderAlertDetails, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await syncAllListings();
    const durationMs = Date.now() - startedAt;
    console.log("[Cron] sync-listings complete", { durationMs, ...result });

    if (result.errors.length > 0) {
      await sendAlert(
        "Cron: sync-listings errors",
        [
          `<p>Daily listings sync finished with ${result.errors.length} error(s). Successful upserts still applied.</p>`,
          renderAlertDetails([
            ["Pages fetched", String(result.pagesFetched)],
            ["Reported total", String(result.reportedTotal ?? "—")],
            ["Fetched", String(result.totalFetched)],
            ["Upserted", String(result.totalUpserted)],
            ["Deactivated", String(result.deactivated)],
            ["Duration", `${Math.round(durationMs / 1000)}s`],
          ]),
          `<pre style="font-size:12px;color:#b91c1c;">${result.errors
            .slice(0, 10)
            .join("\n")}</pre>`,
        ].join(""),
        "cron-sync-listings-errors"
      );
    }

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Cron] sync-listings failed", { durationMs, message });
    await sendAlert(
      "Cron: sync-listings FAILED",
      `<p>The daily listings sync threw before completing.</p>` +
        `<pre style="font-size:12px;color:#b91c1c;">${message}</pre>`,
      "cron-sync-listings-failed"
    );
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
