/**
 * Nightly Guesty → Klaviyo guest-email sync.
 *
 * Guests grant marketing permission + a personal email via the SuiteOp portal,
 * which writes back to Guesty. This moves those (non-OTA) emails into the
 * Klaviyo marketing list so the list compounds with every stay instead of
 * sitting at 16 subscribers. See src/lib/klaviyo-guest-sync.ts for the why.
 *
 * Schedule: 0 10 * * * UTC (~4 AM Mountain), after sync-listings (0 9) so the
 * listing→market map used for segmentation is fresh.
 *
 * Idempotent — Klaviyo upserts by email, so re-runs are safe.
 *
 * Query params:
 *   ?dryRun=1        collect + report, write nothing (ALWAYS do this first)
 *   ?since=YYYY-MM-DD  override the window (use an old date to backfill)
 *
 * Manual run:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.booktraverse.com/api/cron/sync-klaviyo-guests?dryRun=1&since=2020-01-01"
 */
import { NextResponse } from "next/server";
import { syncGuestsToKlaviyo } from "@/lib/klaviyo-guest-sync";
import { renderAlertDetails, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly window. Generous on purpose: Klaviyo upserts, so re-sending a guest
 * is a no-op, and a wide window self-heals anything missed while the sync (or
 * Guesty) was down.
 */
const DEFAULT_LOOKBACK_DAYS = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const sinceParam = url.searchParams.get("since");
  const sinceISO =
    sinceParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam)
      ? sinceParam
      : new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 86400_000)
          .toISOString()
          .slice(0, 10);

  const startedAt = Date.now();
  try {
    const result = await syncGuestsToKlaviyo({ sinceISO, dryRun });
    const durationMs = Date.now() - startedAt;

    // Truncation means we silently missed guests — worth a look, not a page.
    if (result.truncated) {
      await sendAlert(
        "KLAVIYO GUEST SYNC — POSSIBLE TRUNCATION",
        [
          "<p>The Guesty reservation pull may not have covered the full window ",
          "(Guesty's list endpoint caps unfiltered results, and paging stopped ",
          "short of the reported total). Some guests may not have synced.</p>",
          renderAlertDetails([
            ["Since", sinceISO],
            ["Scanned", result.reservationsScanned],
            ["Guesty reported total", result.reportedTotal],
            ["Unique mailable", result.uniqueMailable],
          ]),
        ].join(""),
        `klaviyo-guest-sync-truncated-${sinceISO}`
      ).catch(() => {});
    }

    if (result.failedBatches > 0 || result.failedImportBatches > 0) {
      await sendAlert(
        "KLAVIYO GUEST SYNC — BATCH FAILURES",
        [
          `<p>${result.failedBatches} subscribe batch(es) and ${result.failedImportBatches} `,
          `profile-import batch(es) failed. Subscribe failures mean those guests are NOT on `,
          `the marketing list; import failures only mean missing names/properties.</p>`,
          renderAlertDetails([
            ["Subscribed", result.subscribed],
            ["Imported (attributes)", result.imported],
            ["Unique mailable", result.uniqueMailable],
            ["First errors", result.errors.join(" | ") || "—"],
          ]),
        ].join(""),
        `klaviyo-guest-sync-failures-${new Date().toISOString().slice(0, 10)}`
      ).catch(() => {});
    }

    return NextResponse.json({ ok: true, sinceISO, durationMs, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendAlert(
      "KLAVIYO GUEST SYNC — FAILED",
      [
        "<p>The nightly Guesty → Klaviyo guest sync failed. The Klaviyo list will ",
        "go stale until this is fixed (no guest data is lost — Guesty remains the ",
        "source of truth and the next run re-syncs the window).</p>",
        renderAlertDetails([
          ["Since", sinceISO],
          ["Error", message],
        ]),
      ].join(""),
      `klaviyo-guest-sync-failed-${new Date().toISOString().slice(0, 10)}`
    ).catch(() => {});
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
