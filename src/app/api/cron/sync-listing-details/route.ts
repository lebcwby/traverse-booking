/**
 * Hourly BEAPI → `listing_details` sync.
 *
 * The only thing in the codebase that should call BEAPI for listing detail.
 * See src/lib/listing-detail-cache.ts and the migration for the 429 data that
 * made this necessary.
 *
 * Schedule: 55 * * * * — the hour's crons are spread (:20 cancellation
 * refunds, :25 sync-calendar, :30 pricing cache, :45 orphan sweep), and :55
 * is the widest remaining gap. Two jobs pacing Guesty calls at the same
 * minute would each see only half the budget they think they have.
 *
 * ⚠️ FIRST RUN: check the payload shape before letting it write.
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.booktraverse.com/api/cron/sync-listing-details?dryRun=1&limit=1"
 * `listingsProcessed` should be 1 with no errors. Then run it for real with
 * a small limit and confirm a row appears in `listing_details`.
 */
import { NextResponse } from "next/server";
import { syncListingDetails } from "@/lib/listing-detail-cache";
import { renderAlertDetails, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const listingId = url.searchParams.get("listingId") || undefined;
  const limitParam = parseInt(url.searchParams.get("limit") || "", 10);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 208)
      : undefined;

  const startedAt = Date.now();
  try {
    const result = await syncListingDetails({ limit, dryRun, listingId });
    const durationMs = Date.now() - startedAt;
    console.log("[Cron] sync-listing-details complete", {
      durationMs,
      ...result,
    });

    // Alert only when the whole run failed, not on the odd listing. A single
    // 429 or a delisted id is self-healing: that listing is now the stalest,
    // so the next run retries it first. Alerting on it would recreate the
    // per-incident noise this project spent #111 removing.
    if (
      !dryRun &&
      result.listingsProcessed > 0 &&
      result.rowsWritten === 0 &&
      result.errors.length > 0
    ) {
      await sendAlert(
        "Listing detail cache is not being written",
        `The <code>sync-listing-details</code> cron processed ` +
          `${result.listingsProcessed} listing(s) and wrote none.<br/><br/>` +
          `Page renders read <code>listing_details</code> and fall back to ` +
          `the <code>listings</code> mirror on a miss, so pages stay up — but ` +
          `photos, descriptions and house rules will go stale, and if the ` +
          `table never fills, listing pages silently lose those sections.` +
          renderAlertDetails(
            result.errors.slice(0, 10).map((e, i) => [`error ${i + 1}`, e])
          ),
        "listing-details-sync-failed"
      );
    }

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Cron] sync-listing-details failed", message);
    await sendAlert(
      "Listing detail cache sync failed",
      `The <code>sync-listing-details</code> cron threw before it could ` +
        `finish.<br/><br/><code>${message}</code>`,
      "listing-details-sync-threw"
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
