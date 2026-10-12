/**
 * Hourly Guesty (Open API) → `calendar_days` sync.
 *
 * See src/lib/calendar-sync.ts for why this exists, why it reads the Open API
 * rather than BEAPI (the BEAPI calendar carries no price), and how the rolling
 * slice works.
 *
 * Schedule: 25 * * * * — offset from the other hourly jobs so the Guesty
 * budget is not spent all at once.
 *
 * ⚠️ FIRST RUN: verify the Guesty envelope before letting this write anything.
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.booktraverse.com/api/cron/sync-calendar?dryRun=1&limit=1"
 * Check that `sample` has a numeric `price` and a `date`, and that
 * `daysWithPrice` is close to `daysUpserted`. Only then let the cron run.
 */
import { NextResponse } from "next/server";
import { syncCalendarDays } from "@/lib/calendar-sync";
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
    const result = await syncCalendarDays({ limit, dryRun, listingId });
    const durationMs = Date.now() - startedAt;
    console.log("[Cron] sync-calendar complete", { durationMs, ...result });

    // Alert only on a run that achieved nothing, or one where most listings
    // failed. A couple of per-listing errors in a rolling sync are noise — the
    // next run picks those listings up again, because they stay the stalest.
    const mostlyFailed =
      result.errors.length > 0 && result.listingsProcessed === 0 && !dryRun;
    if (mostlyFailed) {
      await sendAlert(
        "Cron: sync-calendar produced nothing",
        [
          "<p>The calendar sync ran but refreshed no listings. <code>calendar_days</code> is going stale, which empties the Microsoft price feed and will break agent availability lookups.</p>",
          renderAlertDetails([
            ["Duration", `${durationMs}ms`],
            ["Errors", String(result.errors.length)],
            ["First error", result.errors[0] ?? ""],
          ]),
        ].join(""),
        "cron-sync-calendar-empty"
      );
    }

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Cron] sync-calendar failed:", message);
    await sendAlert(
      "Cron: sync-calendar failed",
      `<p>The calendar sync threw before completing.</p><p><strong>Error:</strong> ${message}</p>`,
      "cron-sync-calendar-fail"
    ).catch(() => {});
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
