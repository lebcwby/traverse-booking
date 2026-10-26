/**
 * Weekly roll-up of website bookings, for Slack.
 *
 * Sibling of ./booking-digest.ts. That one lists every booking with its click
 * path; a week's worth of those would be an unreadable wall in Slack, so this
 * aggregates instead: totals, week-on-week movement, channel mix, top listings
 * and a day-by-day line.
 *
 * It reuses rowToBooking from the daily digest deliberately — the two reports
 * must agree on what a booking is worth and which channel gets the credit. If
 * attribution changes there, it changes here.
 *
 * Weeks run Monday–Sunday midnight to midnight **Mountain time**, matching the
 * daily digest's day boundary. See src/lib/report-day.ts for why not UTC.
 */
import {
  displayListing,
  rowToBooking,
  type DigestBooking,
  type Row,
} from "./booking-digest";
import { civilDate, REPORT_TIMEZONE } from "./report-day";

export interface WeeklyTotals {
  bookings: number;
  value: number;
  nights: number;
}

export interface WeeklyDigest {
  /** First day covered (Monday), YYYY-MM-DD in the reporting timezone. */
  weekStart: string;
  /** Last day covered (Sunday), inclusive. */
  weekEnd: string;
  totals: WeeklyTotals;
  /** Same shape for the week before, for comparison. Null if not fetched. */
  prior: WeeklyTotals | null;
  /** Average booking value, 0 when there were no bookings. */
  avgValue: number;
  /** Average nights per booking, 0 when there were no bookings. */
  avgNights: number;
  bySource: Array<{ source: string; count: number; value: number }>;
  byListing: Array<{ listing: string; count: number; value: number }>;
  /** One entry per day of the week, Monday first, zero-filled. */
  byDay: Array<{ day: string; count: number; value: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nights between two YYYY-MM-DD dates; 0 when either is unparseable. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  const nights = Math.round((b - a) / 86_400_000);
  return nights > 0 ? nights : 0;
}

function totals(bookings: DigestBooking[]): WeeklyTotals {
  return {
    bookings: bookings.length,
    value: round2(bookings.reduce((s, b) => s + b.totalPaid, 0)),
    nights: bookings.reduce(
      (s, b) => s + nightsBetween(b.checkIn, b.checkOut),
      0
    ),
  };
}

/** Every civil date from start to end inclusive. */
function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const last = Date.parse(`${end}T00:00:00Z`);
  for (
    let t = Date.parse(`${start}T00:00:00Z`);
    t <= last;
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function buildWeeklyDigest(
  rows: Row[],
  weekStart: string,
  weekEnd: string,
  priorRows: Row[] | null = null
): WeeklyDigest {
  const bookings = rows.map(rowToBooking);
  const t = totals(bookings);

  const bySourceMap = new Map<string, { count: number; value: number }>();
  const byListingMap = new Map<string, { count: number; value: number }>();
  const byDayMap = new Map<string, { count: number; value: number }>();

  rows.forEach((row, i) => {
    const b = bookings[i];

    const s = bySourceMap.get(b.source) ?? { count: 0, value: 0 };
    s.count += 1;
    s.value += b.totalPaid;
    bySourceMap.set(b.source, s);

    // Grouped on the nickname so the weekly roll-up and the daily report
    // name the same property the same way.
    const listing = displayListing(b);
    const l = byListingMap.get(listing) ?? { count: 0, value: 0 };
    l.count += 1;
    l.value += b.totalPaid;
    byListingMap.set(listing, l);

    // Bucketed on when the booking was COMPLETED, in Mountain time — the same
    // instant and the same zone the week bounds were built from, so every row
    // the query returned lands on one of the seven days and none drift to an
    // eighth. Bucketing on check-in would scatter them across future months.
    const day = civilDate(new Date(row.completed_at), REPORT_TIMEZONE);
    const d = byDayMap.get(day) ?? { count: 0, value: 0 };
    d.count += 1;
    d.value += b.totalPaid;
    byDayMap.set(day, d);
  });

  const rank = (m: Map<string, { count: number; value: number }>) =>
    [...m.entries()]
      .map(([k, v]) => ({ key: k, count: v.count, value: round2(v.value) }))
      .sort((a, b) => b.count - a.count || b.value - a.value);

  return {
    weekStart,
    weekEnd,
    totals: t,
    prior: priorRows ? totals(priorRows.map(rowToBooking)) : null,
    avgValue: t.bookings ? round2(t.value / t.bookings) : 0,
    avgNights: t.bookings ? round2(t.nights / t.bookings) : 0,
    bySource: rank(bySourceMap).map(({ key, count, value }) => ({
      source: key,
      count,
      value,
    })),
    byListing: rank(byListingMap).map(({ key, count, value }) => ({
      listing: key,
      count,
      value,
    })),
    byDay: daysInRange(weekStart, weekEnd).map((day) => ({
      day,
      count: byDayMap.get(day)?.count ?? 0,
      value: round2(byDayMap.get(day)?.value ?? 0),
    })),
  };
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** "+18%" / "−6%" / "—" when there is no prior figure to compare against. */
export function delta(current: number, prior: number | undefined): string {
  if (prior === undefined || prior === 0) return "—";
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return "flat";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

/** "Mon" … "Sun" for a YYYY-MM-DD, read as a civil date. */
function weekdayLabel(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

const prettyDate = (date: string) =>
  new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Slack Block Kit payload. Rendered from a WeeklyDigest so it is testable. */
export function renderWeeklySlackBlocks(
  d: WeeklyDigest
): Record<string, unknown> {
  const range = `${prettyDate(d.weekStart)} – ${prettyDate(d.weekEnd)}`;

  if (d.totals.bookings === 0) {
    return {
      text: `Weekly website bookings — ${range}: none`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `Weekly website bookings` },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${range}*\nNo website bookings completed this week.`,
          },
        },
      ],
    };
  }

  const p = d.prior;
  const headline = [
    `*${d.totals.bookings}* booking${d.totals.bookings === 1 ? "" : "s"}` +
      (p ? `  _(${delta(d.totals.bookings, p.bookings)} vs prior week)_` : ""),
    `*${money(d.totals.value)}* total` +
      (p ? `  _(${delta(d.totals.value, p.value)})_` : ""),
    `*${money(d.avgValue)}* average booking · *${d.avgNights}* nights average · *${d.totals.nights}* nights total`,
  ].join("\n");

  const sourceLines = d.bySource
    .map((s) => `• ${s.source} — ${s.count} · ${money(s.value)}`)
    .join("\n");

  const listingLines = d.byListing
    .slice(0, 5)
    .map((l) => `• ${l.listing} — ${l.count} · ${money(l.value)}`)
    .join("\n");

  const peak = Math.max(...d.byDay.map((x) => x.count), 1);
  const dayLines = d.byDay
    .map((x) => {
      const bar = x.count ? "█".repeat(Math.max(1, Math.round((x.count / peak) * 8))) : "·";
      return `${weekdayLabel(x.day)}  ${bar} ${x.count || ""}`.trimEnd();
    })
    .join("\n");

  return {
    text: `Weekly website bookings — ${range}: ${d.totals.bookings} bookings, ${money(d.totals.value)}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Weekly website bookings" },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `*${range}* · Mountain time` }],
      },
      { type: "section", text: { type: "mrkdwn", text: headline } },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*By channel*\n${sourceLines}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Top listings*\n${listingLines}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Bookings by day*\n\`\`\`${dayLines}\`\`\`` },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Weeks run Monday–Sunday midnight to midnight Mountain time. Channel is the attribution cookie captured on site, not GA4. Value is total paid at checkout. See src/lib/weekly-digest.ts.",
          },
        ],
      },
    ],
  };
}
