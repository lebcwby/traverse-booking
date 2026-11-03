/**
 * 🗑️ TEMPORARY — DELETE ONCE THE CHECK-IN BASIS IS VERIFIED.
 *
 * Switching waiver attribution from charge date to check-in date rests on
 * one thing that cannot be tested offline: whether Stripe's Search API
 * accepts a metadata key containing spaces, `metadata["PMS Reservation ID"]`.
 * Unit tests cover the arithmetic; only live Stripe can answer the syntax.
 *
 * It also prints BOTH bases for the same day, which is the only way to see
 * how far apart they really are — the lead time between paying a waiver and
 * arriving runs to months, so these are different numbers, not rounding.
 *
 * Read-only. Not in vercel.json. Nothing calls it.
 *
 *   curl -H "Authorization: Bearer $PROBE_SECRET" \
 *     "https://www.booktraverse.com/api/admin/tmp-waiver-check?day=2026-11-02"
 */
import { NextResponse } from "next/server";
import { crmConfigured } from "@/lib/crm-db";
import { zonedDayBounds, yesterdayIn } from "@/lib/report-day";
import {
  buildWaiverSummary,
  fetchWaiverIntentsByChargeDay,
  fetchWaiverIntentsForCheckInDay,
  renderWaiverBlocks,
} from "@/lib/waiver-digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accepted = [process.env.PROBE_SECRET, process.env.CRON_SECRET]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
  if (!accepted.some((secret) => authHeader === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dayParam = url.searchParams.get("day");
  const day =
    dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : yesterdayIn();
  const { start, end } = zonedDayBounds(day);

  // Each basis is reported independently so one failing still shows the
  // other — if the Search syntax is wrong, that is exactly what we learn.
  let checkIn: unknown = null;
  let checkInError: string | null = null;
  try {
    const { intents, arrivals } = await fetchWaiverIntentsForCheckInDay(day);
    const summary = buildWaiverSummary(intents, day, "check_in", arrivals);
    checkIn = { summary, slack: renderWaiverBlocks(summary) };
  } catch (err) {
    checkInError = String(err);
  }

  let chargeDate: unknown = null;
  let chargeDateError: string | null = null;
  try {
    const summary = buildWaiverSummary(
      await fetchWaiverIntentsByChargeDay(start, end),
      day,
      "charge_date"
    );
    chargeDate = { summary, slack: renderWaiverBlocks(summary) };
  } catch (err) {
    chargeDateError = String(err);
  }

  return NextResponse.json({
    note: "TEMPORARY. Delete src/app/api/admin/tmp-waiver-check once verified.",
    day,
    bounds: { start, end },
    crmConfigured: crmConfigured(),
    checkIn,
    checkInError,
    chargeDate,
    chargeDateError,
  });
}
