/**
 * Weekly Slack roll-up of the previous Monday–Sunday of website bookings.
 *
 * Sibling of ./daily-booking-digest. The daily report lists every booking with
 * its click path; this one aggregates — totals, week-on-week movement, channel
 * mix, top listings and a day-by-day line — because a week of per-booking
 * detail is unreadable in Slack.
 *
 * Weeks run Monday to Sunday, midnight to midnight **Mountain time**, matching
 * the daily digest's boundary. See src/lib/report-day.ts for why not UTC.
 *
 * Schedule from vercel.json:
 *   {"path":"/api/cron/weekly-booking-digest","schedule":"45 7 * * 1"}
 *
 * 07:45 UTC is 00:45 Mountain in MST and 01:45 in MDT, so Sunday has always
 * closed by the time it runs, in either half of the year. It sits 15 minutes
 * after the daily digest so the two never post at once on a Monday.
 *
 * GET /api/cron/weekly-booking-digest   (Bearer CRON_SECRET)
 *     ?weekStart=YYYY-MM-DD  report the Mon–Sun week beginning that date
 *     ?dryRun=1              return the payload as JSON, post nothing
 *
 * Posting needs SLACK_WEBHOOK_URL. Without it the route still returns the
 * payload and reports `slack: "not-configured"` rather than failing.
 */
import { NextResponse } from "next/server";
import { fetchCompletedCheckouts } from "@/lib/booking-digest";
import {
  buildWeeklyDigest,
  renderWeeklySlackBlocks,
} from "@/lib/weekly-digest";
import {
  REPORT_TIMEZONE,
  previousWeekIn,
  shiftCivilDate,
  zonedRangeBounds,
} from "@/lib/report-day";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const startParam = url.searchParams.get("weekStart");

  const { start: weekStart, end: weekEnd } =
    startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam)
      ? { start: startParam, end: shiftCivilDate(startParam, 6) }
      : previousWeekIn();

  let digest;
  try {
    const { start, end } = zonedRangeBounds(weekStart, weekEnd);
    const rows = await fetchCompletedCheckouts(start, end);

    // The week before, for the week-on-week line. A failure here must not
    // lose the report, so it degrades to no comparison rather than throwing.
    let priorRows = null;
    try {
      const priorStart = shiftCivilDate(weekStart, -7);
      const prior = zonedRangeBounds(priorStart, shiftCivilDate(priorStart, 6));
      priorRows = await fetchCompletedCheckouts(prior.start, prior.end);
    } catch (err) {
      console.warn("[weekly-booking-digest] prior-week query failed:", err);
    }

    digest = buildWeeklyDigest(rows, weekStart, weekEnd, priorRows);
  } catch (err) {
    console.error("[weekly-booking-digest] query failed:", err);
    return NextResponse.json(
      { error: "Query failed", detail: String(err) },
      { status: 503 }
    );
  }

  const payload = renderWeeklySlackBlocks(digest);
  const webhook = (process.env.SLACK_WEBHOOK_URL || "").trim();

  if (dryRun) {
    return NextResponse.json({ mode: "dryRun", digest, payload });
  }
  if (!webhook) {
    return NextResponse.json({
      slack: "not-configured",
      hint: "Set SLACK_WEBHOOK_URL in Vercel to enable posting.",
      digest,
      payload,
    });
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[weekly-booking-digest] Slack rejected the post: ${res.status} ${body.slice(0, 200)}`
      );
      return NextResponse.json(
        { slack: "failed", status: res.status, digest },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[weekly-booking-digest] Slack post threw:", err);
    return NextResponse.json(
      { slack: "failed", detail: String(err), digest },
      { status: 502 }
    );
  }

  return NextResponse.json({
    slack: "posted",
    weekStart,
    weekEnd,
    timezone: REPORT_TIMEZONE,
    bookings: digest.totals.bookings,
    totalValue: digest.totals.value,
  });
}
