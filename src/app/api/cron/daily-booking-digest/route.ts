/**
 * Daily Slack digest of yesterday's website bookings.
 *
 * Shows, per booking: listing, dates, guests, value, guest, the channel that
 * converted them, the channel that FIRST found them when it differs, the page
 * they entered on, and how long from first touch to booked.
 *
 * ⚠️ No page-by-page funnel path — we do not store a visit trail. See the
 * header of src/lib/booking-digest.ts for what that would take.
 *
 * GET /api/cron/daily-booking-digest     (Bearer CRON_SECRET)
 *     ?date=YYYY-MM-DD   report on a specific day instead of yesterday
 *     ?dryRun=1          return the payload as JSON, post nothing
 *
 * Posting needs SLACK_WEBHOOK_URL. Without it the route still returns the
 * payload and reports `slack: "not-configured"` rather than failing, so it can
 * be exercised before the webhook exists.
 */
import { NextResponse } from "next/server";
import {
  buildDigest,
  fetchCompletedCheckouts,
  renderSlackBlocks,
} from "@/lib/booking-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** UTC day bounds. Guests book from every timezone; UTC is at least honest. */
function dayBounds(date: string) {
  return {
    start: `${date}T00:00:00.000Z`,
    end: `${date}T23:59:59.999Z`,
  };
}

function yesterdayUtc(): string {
  const d = new Date(Date.now() - 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const dateParam = url.searchParams.get("date");
  const day =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : yesterdayUtc();

  let digest;
  try {
    const { start, end } = dayBounds(day);
    const rows = await fetchCompletedCheckouts(start, end);
    digest = buildDigest(rows, day);
  } catch (err) {
    console.error("[daily-booking-digest] query failed:", err);
    return NextResponse.json(
      { error: "Query failed", detail: String(err) },
      { status: 503 }
    );
  }

  const payload = renderSlackBlocks(digest);
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
        `[daily-booking-digest] Slack rejected the post: ${res.status} ${body.slice(0, 200)}`
      );
      return NextResponse.json(
        { slack: "failed", status: res.status, digest },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[daily-booking-digest] Slack post threw:", err);
    return NextResponse.json(
      { slack: "failed", detail: String(err), digest },
      { status: 502 }
    );
  }

  return NextResponse.json({
    slack: "posted",
    day,
    bookings: digest.bookings.length,
    totalValue: digest.totalValue,
  });
}
