/**
 * Daily digest of yesterday's website bookings, for Slack.
 *
 * ── What the data can and cannot say ────────────────────────────────────
 *
 * Source: `pending_checkouts`, which retains completed rows (222 of them at
 * time of writing, each with a reservation_id). ⚠️ CLAUDE.md claims
 * single-listing rows are deleted on completion — they are not, they are
 * marked `completed` and kept. That is what makes this digest possible.
 *
 * Each row carries, in `tracking_context.cookies`:
 *   - `attribution`  — LAST touch: utm_*, gclid/fbclid/msclkid, and the
 *                      `landingPage` the visitor entered on
 *   - `firstTouch`   — FIRST touch, same shape. When the two differ, the
 *                      channel that *found* the guest is not the one that
 *                      closed them, which is the single most useful thing
 *                      here and is invisible in GA4's default reports.
 *
 * ⚠️ **There is no page-by-page funnel path.** We do not store a visit
 * trail anywhere — `sp_events` is local attractions data for /plan, not
 * analytics. What this digest can show is the *shape* of the journey:
 * entry page, first touch vs last touch, how long from first touch to
 * booking, and how long spent in checkout. A real click path would need
 * either the GA4 Data API (service-account credentials we do not have) or
 * storing a breadcrumb trail ourselves.
 *
 * Not inferring what we cannot measure is the point: a digest that invents
 * a funnel is worse than one that is honest about its edges.
 */
import { getPool } from "./db";

export interface DigestBooking {
  reservationId: string | null;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number | null;
  totalPaid: number;
  guestName: string;
  /** Last-touch channel, already prettified, e.g. "google / cpc". */
  source: string;
  /** First-touch channel when it differs from last touch. */
  firstTouchSource: string | null;
  /** Page the visitor entered the site on. */
  landingPage: string | null;
  /** Minutes from first recorded touch to the completed booking. */
  minutesFromFirstTouch: number | null;
  /** Minutes spent in checkout (checkout row created → completed). */
  minutesInCheckout: number | null;
}

export interface Digest {
  /** The day covered, YYYY-MM-DD in the reporting timezone. */
  day: string;
  bookings: DigestBooking[];
  totalValue: number;
  /** Booking count per last-touch channel, biggest first. */
  bySource: Array<{ source: string; count: number; value: number }>;
}

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * "google / cpc", "(direct) / (none)", "chatgpt / ai_agent".
 * Mirrors GA4's source/medium shape so the two can be compared directly.
 */
export function formatChannel(
  attribution: Record<string, unknown> | null
): string {
  const src = String(attribution?.utm_source || "").trim();
  const med = String(attribution?.utm_medium || "").trim();
  if (src || med) return `${src || "(not set)"} / ${med || "(not set)"}`;

  // No utm — fall back to the ad-click ids, which identify the platform even
  // when the link carried no campaign tagging.
  if (attribution?.gclid || attribution?.gbraid || attribution?.wbraid) {
    return "google / cpc (gclid)";
  }
  if (attribution?.fbclid) return "facebook / paid (fbclid)";
  if (attribution?.msclkid) return "bing / cpc (msclkid)";
  return "(direct) / (none)";
}

/** First name plus last initial — enough to recognise, less than is needed. */
export function shortGuestName(guest: Record<string, unknown> | null): string {
  const first = String(guest?.firstName || "").trim();
  const last = String(guest?.lastName || "").trim();
  if (!first && !last) return "(no name)";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function minutesBetween(from: unknown, to: unknown): number | null {
  const a = from ? Date.parse(String(from)) : NaN;
  const b = to ? Date.parse(String(to)) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

interface Row {
  reservation_id: string | null;
  guest: Record<string, unknown> | null;
  tracking: Record<string, unknown> | null;
  tracking_context: Record<string, unknown> | null;
  created_at: string;
  completed_at: string;
}

export function rowToBooking(row: Row): DigestBooking {
  const t = row.tracking ?? {};
  const cookies = ((row.tracking_context ?? {}) as Record<string, unknown>)
    .cookies as Record<string, unknown> | undefined;

  const attribution = parseJson(cookies?.attribution);
  const firstTouch = parseJson(cookies?.firstTouch);

  const source = formatChannel(attribution);
  // Only when a first-touch cookie actually exists. Absent, we do not know
  // the first touch — and reporting "(direct)" for it would be a claim the
  // data does not support, on the one line a reader is most likely to act on.
  const firstSource = firstTouch ? formatChannel(firstTouch) : null;

  return {
    reservationId: row.reservation_id,
    listingTitle: String(t.listingTitle || "(unknown listing)"),
    checkIn: String(t.checkIn || "?"),
    checkOut: String(t.checkOut || "?"),
    guests: typeof t.guests === "number" ? t.guests : null,
    totalPaid: Number(t.totalPaid ?? t.stayTotal ?? 0),
    guestName: shortGuestName(row.guest),
    source,
    // Only surface first touch when we have one AND it tells a different story.
    firstTouchSource:
      firstSource && firstSource !== source ? firstSource : null,
    landingPage:
      (firstTouch?.landingPage as string) ||
      (attribution?.landingPage as string) ||
      null,
    minutesFromFirstTouch: minutesBetween(
      firstTouch?.capturedAt ?? attribution?.capturedAt,
      row.completed_at
    ),
    minutesInCheckout: minutesBetween(row.created_at, row.completed_at),
  };
}

export function buildDigest(rows: Row[], day: string): Digest {
  const bookings = rows.map(rowToBooking);

  const grouped = new Map<string, { count: number; value: number }>();
  for (const b of bookings) {
    const g = grouped.get(b.source) ?? { count: 0, value: 0 };
    g.count += 1;
    g.value += b.totalPaid;
    grouped.set(b.source, g);
  }

  return {
    day,
    bookings,
    totalValue:
      Math.round(bookings.reduce((s, b) => s + b.totalPaid, 0) * 100) / 100,
    bySource: [...grouped.entries()]
      .map(([source, g]) => ({
        source,
        count: g.count,
        value: Math.round(g.value * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count || b.value - a.value),
  };
}

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function duration(mins: number | null): string {
  if (mins === null) return "unknown";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.round(h / 24)}d`;
}

/** Slack Block Kit payload. Rendered from a Digest so it is unit-testable. */
export function renderSlackBlocks(d: Digest): Record<string, unknown> {
  if (d.bookings.length === 0) {
    return {
      text: `No website bookings on ${d.day}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Website bookings — ${d.day}*\nNo bookings yesterday.`,
          },
        },
      ],
    };
  }

  const n = d.bookings.length;
  const headline = `*Website bookings — ${d.day}*\n${n} booking${n === 1 ? "" : "s"} · ${money(d.totalValue)}`;

  const sourceLines = d.bySource
    .map((s) => `• \`${s.source}\` — ${s.count} · ${money(s.value)}`)
    .join("\n");

  const bookingBlocks = d.bookings.flatMap((b) => {
    const lines = [
      `*${b.listingTitle}* — ${money(b.totalPaid)}`,
      `${b.checkIn} → ${b.checkOut}${b.guests ? ` · ${b.guests} guest${b.guests === 1 ? "" : "s"}` : ""} · ${b.guestName}${b.reservationId ? ` · \`${b.reservationId}\`` : ""}`,
      `converted from \`${b.source}\`${b.firstTouchSource ? `  _(first touch: \`${b.firstTouchSource}\`)_` : ""}`,
    ];
    if (b.landingPage) lines.push(`entered on \`${b.landingPage}\``);
    lines.push(
      `first touch → booked: ${duration(b.minutesFromFirstTouch)} · in checkout: ${duration(b.minutesInCheckout)}`
    );
    return [
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      { type: "divider" },
    ];
  });

  return {
    text: `${n} website booking${n === 1 ? "" : "s"} on ${d.day} — ${money(d.totalValue)}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: headline } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*By channel*\n${sourceLines}` },
      },
      { type: "divider" },
      ...bookingBlocks,
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Channel is the attribution cookie captured on site, not GA4. No page-by-page path is stored — see src/lib/booking-digest.ts.",
          },
        ],
      },
    ],
  };
}

/**
 * Completed checkouts for one UTC day.
 *
 * Keyed on `completed_at`, not `created_at`: a checkout started at 23:50 and
 * finished at 00:05 belongs to the day the money moved.
 */
export async function fetchCompletedCheckouts(
  dayStartIso: string,
  dayEndIso: string
): Promise<Row[]> {
  const { rows } = await getPool().query(
    `select reservation_id, guest, tracking, tracking_context, created_at, completed_at
       from pending_checkouts
      where status = 'completed'
        and completed_at >= $1::timestamptz
        and completed_at <  $2::timestamptz
      order by completed_at asc`,
    [dayStartIso, dayEndIso]
  );
  return rows as Row[];
}
