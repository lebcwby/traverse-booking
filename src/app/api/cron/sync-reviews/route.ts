/**
 * Nightly Guesty → reviews-table sync.
 *
 * Built 2026-05-20. The initial 10-year backfill (19,278 reviews) ran on
 * 2026-05-19 via the admin endpoint; this cron keeps the table fresh as
 * new Airbnb/VRBO reviews come in.
 *
 * Schedule: 0 8 * * * UTC (≈2 AM Mountain DST / 1 AM Mountain MST). Off-peak
 * so the multi-minute run doesn't compete with traffic-hour token traffic.
 *
 * The full sync is idempotent (upsert on guesty review id) so a re-run is
 * safe. Typical nightly runtime is dominated by the listing-by-listing
 * paginated fetches rather than the upserts — most listings will have zero
 * new reviews to insert.
 *
 * Wired in vercel.json alongside the other crons. Same auth pattern as
 * record-payments (Bearer CRON_SECRET).
 */
import { NextResponse } from "next/server";
import { syncAllListingReviews } from "@/lib/guesty-reviews-sync";
import { renderAlertDetails, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
// Backfill takes ~2-5 min for 366 listings; nightly incremental pages should
// fall well under that, but Guesty rate-limit retries can push runtime up.
export const maxDuration = 800;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await syncAllListingReviews();
    const durationMs = Date.now() - startedAt;
    console.log("[Cron] reviews-sync complete", {
      durationMs,
      listingsProcessed: result.listingsProcessed,
      totalFetched: result.totalFetched,
      totalUpserted: result.totalUpserted,
      totalErrors: result.totalErrors,
    });

    if (result.totalErrors > 0) {
      const failing = result.perListing
        .filter((l) => l.errors > 0)
        .slice(0, 10);
      await sendAlert(
        "Cron: reviews-sync errors",
        [
          `<p>Nightly reviews-sync finished with ${result.totalErrors} listing-level error${result.totalErrors === 1 ? "" : "s"}. Successful upserts still applied.</p>`,
          renderAlertDetails([
            ["Listings processed", String(result.listingsProcessed)],
            ["Reviews fetched", String(result.totalFetched)],
            ["Reviews upserted", String(result.totalUpserted)],
            ["Errors", String(result.totalErrors)],
            ["Duration", `${Math.round(durationMs / 1000)}s`],
          ]),
          `<p>First failing listings:</p><ul>${failing
            .map(
              (l) =>
                `<li>${l.listingId} — ${(l.errorMessages || []).slice(0, 2).join("; ")}</li>`
            )
            .join("")}</ul>`,
        ].join(""),
        "cron-reviews-sync-errors"
      );
    }

    return NextResponse.json({ durationMs, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron] reviews-sync hard failure:", msg);
    await sendAlert(
      "Cron: reviews-sync hard failure",
      [
        "<p>Nightly reviews-sync threw before completing. No reviews were upserted this run.</p>",
        renderAlertDetails([
          ["Duration before failure", `${Math.round((Date.now() - startedAt) / 1000)}s`],
          ["Error", msg],
        ]),
      ].join(""),
      "cron-reviews-sync-hard-failure"
    );
    return NextResponse.json(
      { error: "reviews-sync failed", detail: msg },
      { status: 500 }
    );
  }
}
