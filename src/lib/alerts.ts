import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ALERT_TO = process.env.ALERT_TO_EMAIL ?? "";
const ALERT_FROM =
  process.env.ALERT_FROM_EMAIL ?? "Alerts <noreply@example.com>";

// Throttle: don't send the same alert type more than once per hour
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.SHARED_SUPABASE_URL;
    const key = process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return null;
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stringifyAlertValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return String(value);
}

export function formatDurationMs(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "0m";
  }

  const totalMinutes = Math.floor(durationMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function buildStripeDashboardPaymentUrl(
  paymentIntentId: string | null | undefined
) {
  if (!paymentIntentId) return null;
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const prefix = secretKey.startsWith("sk_test_")
    ? "https://dashboard.stripe.com/test/payments"
    : "https://dashboard.stripe.com/payments";
  return `${prefix}/${encodeURIComponent(paymentIntentId)}`;
}

export function renderAlertDetails(
  details: Array<[label: string, value: unknown]>
) {
  const rows = details
    .map(
      ([label, value]) => [label, stringifyAlertValue(value).trim()] as const
    )
    .filter(([, value]) => value.length > 0);

  if (rows.length === 0) return "";

  return `
    <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
      <tbody>
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding: 6px 10px; border: 1px solid #e5e7eb; width: 180px; font-weight: 600; vertical-align: top;">
              ${escapeHtml(label)}
            </td>
            <td style="padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top;">
              ${escapeHtml(value)}
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderAlertLinks(
  links: Array<{ label: string; url?: string | null }>
) {
  const validLinks = links.filter(
    (link) => typeof link.url === "string" && link.url.length > 0
  );
  if (validLinks.length === 0) return "";

  return `
    <ul style="margin: 12px 0 0 18px; padding: 0;">
      ${validLinks
        .map(
          (link) => `
        <li style="margin: 4px 0;">
          <a href="${escapeHtml(link.url!)}" style="color: #2563eb;">${escapeHtml(link.label)}</a>
        </li>
      `
        )
        .join("")}
    </ul>
  `;
}

async function readCooldownFromSupabase(key: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", `alert_cooldown:${key}`)
      .single();

    if (error || !data?.value || typeof data.value !== "object") {
      return null;
    }

    const lastSentAt = Number(
      (data.value as { lastSentAt?: number }).lastSentAt || 0
    );
    return Number.isFinite(lastSentAt) ? lastSentAt : null;
  } catch {
    return null;
  }
}

async function persistCooldownToSupabase(key: string, lastSentAt: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    await supabase.from("kv_store").upsert(
      {
        key: `alert_cooldown:${key}`,
        value: { lastSentAt },
      },
      { onConflict: "key" }
    );
  } catch {
    // best effort
  }
}

// ─── Dashboard Supabase (YoY rate comparison) ──────────────────────────────
// Optional: point at an internal dashboard DB to enrich alerts with listing
// nicknames and YoY price/calendar data. If unset, alerts still send without
// the enrichment. Set DASHBOARD_SUPABASE_URL and DASHBOARD_SUPABASE_ANON_KEY.

const DASHBOARD_SUPABASE_URL = process.env.DASHBOARD_SUPABASE_URL ?? "";
const DASHBOARD_SUPABASE_ANON_KEY =
  process.env.DASHBOARD_SUPABASE_ANON_KEY ?? "";

function dashboardConfigured() {
  return Boolean(DASHBOARD_SUPABASE_URL && DASHBOARD_SUPABASE_ANON_KEY);
}

interface CalendarDayData {
  date: string;
  price: number;
  status: string;
}

interface ResolvedListing {
  calendarListingId: string;
  nickname: string | null;
}

async function resolveListingFromDashboard(
  listingId: string
): Promise<ResolvedListing | null> {
  if (!listingId) {
    console.warn(
      "[BookingConfirmation] resolveListingFromDashboard called with empty listingId"
    );
    return null;
  }
  if (!dashboardConfigured()) return null;

  // Try dashboard Supabase first
  try {
    const url = `${DASHBOARD_SUPABASE_URL}/rest/v1/listings?select=guesty_id,nickname&guesty_id=eq.${encodeURIComponent(listingId)}&limit=1`;
    const resp = await fetch(url, {
      headers: {
        apikey: DASHBOARD_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DASHBOARD_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      console.warn(
        `[BookingConfirmation] Dashboard lookup failed: ${resp.status} for listingId=${listingId}`
      );
    } else {
      const rows = await resp.json();
      if (rows.length > 0) {
        const { nickname } = rows[0];

        // BEAPI listings have "X" suffix nicknames — calendar_days is stored under the non-"X" variant
        if (nickname && nickname.endsWith("X")) {
          const baseNickname = nickname.slice(0, -1);
          const mapUrl = `${DASHBOARD_SUPABASE_URL}/rest/v1/listings?select=guesty_id,nickname&nickname=eq.${encodeURIComponent(baseNickname)}&limit=1`;
          const mapResp = await fetch(mapUrl, {
            headers: {
              apikey: DASHBOARD_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${DASHBOARD_SUPABASE_ANON_KEY}`,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (mapResp.ok) {
            const mapRows = await mapResp.json();
            if (mapRows.length > 0) {
              return {
                calendarListingId: mapRows[0].guesty_id,
                nickname: mapRows[0].nickname,
              };
            }
          }
          return { calendarListingId: listingId, nickname: baseNickname };
        }

        return { calendarListingId: listingId, nickname };
      } else {
        console.warn(
          `[BookingConfirmation] Dashboard: no listing found for guesty_id=${listingId}`
        );
      }
    }
  } catch (err) {
    console.error(
      `[BookingConfirmation] Dashboard lookup error for listingId=${listingId}:`,
      err
    );
  }

  // Fallback: query the main site Supabase for nickname
  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from("listings")
        .select("guesty_id,nickname")
        .eq("guesty_id", listingId)
        .limit(1)
        .single();
      if (data?.nickname) {
        console.log(
          `[BookingConfirmation] Resolved nickname from main Supabase: ${data.nickname}`
        );
        return { calendarListingId: listingId, nickname: data.nickname };
      }
    }
  } catch (err) {
    console.error(
      `[BookingConfirmation] Main Supabase fallback error for listingId=${listingId}:`,
      err
    );
  }

  console.warn(
    `[BookingConfirmation] Could not resolve nickname for listingId=${listingId}`
  );
  return null;
}

interface NightlyComparison {
  date: string;
  dayOfWeek: string;
  thisYearRate: number | null;
  lastYearRate: number | null;
  lastYearStatus: string | null;
  netRevenue: number | null;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function formatDateRange(checkIn: string, checkOut: string): string {
  const ci = new Date(checkIn + "T12:00:00Z");
  const co = new Date(checkOut + "T12:00:00Z");
  const sameMonth =
    ci.getUTCMonth() === co.getUTCMonth() &&
    ci.getUTCFullYear() === co.getUTCFullYear();
  if (sameMonth) {
    return `${MONTHS[ci.getUTCMonth()]} ${ci.getUTCDate()} – ${co.getUTCDate()}, ${ci.getUTCFullYear()}`;
  }
  return `${formatDateShort(checkIn)} – ${formatDateShort(checkOut)}, ${co.getUTCFullYear()}`;
}

function generateNightlyDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkIn + "T12:00:00Z");
  const end = new Date(checkOut + "T12:00:00Z");
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getLastYearDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ly = new Date(Date.UTC(y - 1, m - 1, d));
  if (ly.getUTCMonth() !== m - 1) {
    return new Date(Date.UTC(y - 1, m - 1, 0)).toISOString().slice(0, 10);
  }
  return ly.toISOString().slice(0, 10);
}

async function fetchCalendarDays(
  listingId: string,
  dates: string[]
): Promise<Map<string, CalendarDayData>> {
  const result = new Map<string, CalendarDayData>();
  if (!listingId || dates.length === 0) return result;
  if (!dashboardConfigured()) return result;

  const dateList = dates.join(",");
  const url = `${DASHBOARD_SUPABASE_URL}/rest/v1/calendar_days?select=date,price,status&listing_id=eq.${encodeURIComponent(listingId)}&date=in.(${dateList})&limit=100`;

  // Retry once on empty result (handles transient failures / cold-start timeouts)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          apikey: DASHBOARD_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DASHBOARD_SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        console.error(
          `[YoYRates] calendar_days fetch failed (attempt ${attempt}): ${resp.status} ${resp.statusText} for listing ${listingId}`
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return result;
      }
      const rows: CalendarDayData[] = await resp.json();
      console.log(
        `[YoYRates] Fetched ${rows.length} calendar days for listing ${listingId} (${dates.length} dates requested, attempt ${attempt})`
      );
      if (rows.length === 0 && attempt < 2) {
        console.warn(
          `[YoYRates] Empty result for listing ${listingId} with dates [${dateList}] — retrying`
        );
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      for (const row of rows) result.set(row.date, row);
      return result;
    } catch (err) {
      console.error(
        `[YoYRates] calendar_days fetch error (attempt ${attempt}) for listing ${listingId}:`,
        err
      );
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
    }
  }
  return result;
}

async function buildYoYComparison(
  listingId: string,
  checkIn: string,
  checkOut: string
): Promise<NightlyComparison[]> {
  const thisYearDates = generateNightlyDates(checkIn, checkOut);
  if (thisYearDates.length === 0) return [];

  const lastYearDates = thisYearDates.map(getLastYearDate);
  const allDates = [...thisYearDates, ...lastYearDates];
  const calendarData = await fetchCalendarDays(listingId, allDates);

  return thisYearDates.map((date, i) => {
    const lyDate = lastYearDates[i];
    const thisYear = calendarData.get(date);
    const lastYear = calendarData.get(lyDate);
    const thisRate = thisYear?.price ?? null;
    const lastRate = lastYear?.price ?? null;
    const lyStatus = lastYear?.status ?? null;

    // Net revenue: booked last year → rate differential; unbooked/blocked → full rate is incremental
    let netRevenue: number | null = null;
    if (thisRate !== null) {
      if (lyStatus === "booked" && lastRate !== null) {
        netRevenue = thisRate - lastRate;
      } else {
        // available, blocked, or unknown — was $0 actual revenue last year
        netRevenue = thisRate;
      }
    }

    return {
      date,
      dayOfWeek: DAYS[new Date(date + "T12:00:00Z").getUTCDay()],
      thisYearRate: thisRate,
      lastYearRate: lastRate,
      lastYearStatus: lyStatus,
      netRevenue,
    };
  });
}

function renderStatusBadge(status: string | null): string {
  if (!status) return '<span style="color:#d1d5db;">—</span>';
  switch (status) {
    case "booked":
      return '<span style="color:#f2c070;font-size:11px;">&#9679; Booked</span>';
    case "available":
      return '<span style="color:#6b7280;font-size:11px;">&#9675; Available</span>';
    default:
      return `<span style="color:#d1d5db;font-size:11px;">&#9679; ${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
  }
}

function renderNetRevenue(net: number | null): string {
  if (net === null) return '<span style="color:#d1d5db;">—</span>';
  const color = net > 0 ? "#16a34a" : net < 0 ? "#dc2626" : "#6b7280";
  const sign = net > 0 ? "+" : "";
  return `<span style="color:${color};font-weight:600;">${sign}$${Math.abs(Math.round(net))}</span>`;
}

function formatDateMMDD(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function renderRateComparisonTable(
  comparison: NightlyComparison[],
  checkIn: string
): string {
  if (comparison.length === 0) return "";
  const thisYear = new Date(checkIn + "T12:00:00Z").getUTCFullYear();
  const lastYear = thisYear - 1;
  const hasLastYearData = comparison.some((c) => c.lastYearRate !== null);

  const avgThis = comparison.filter((c) => c.thisYearRate !== null);
  const avgLast = comparison.filter((c) => c.lastYearRate !== null);
  const avgThisRate =
    avgThis.length > 0
      ? avgThis.reduce((s, c) => s + c.thisYearRate!, 0) / avgThis.length
      : null;
  const avgLastRate =
    avgLast.length > 0
      ? avgLast.reduce((s, c) => s + c.lastYearRate!, 0) / avgLast.length
      : null;

  const totalNet = comparison.reduce((s, c) => s + (c.netRevenue ?? 0), 0);
  const bookedLastYear = comparison.filter(
    (c) => c.lastYearStatus === "booked"
  ).length;
  const totalNights = comparison.length;

  return `
    <div style="padding:0 28px 24px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin:0 0 12px;font-weight:600;">Nightly Rate Comparison</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e8e5e0;">
        <thead>
          <tr style="background:#f7f5f0;">
            <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;color:#9ca3af;text-align:left;font-weight:600;">Date</th>
            <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;color:#9ca3af;text-align:right;font-weight:600;">${thisYear}</th>
            <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;color:#9ca3af;text-align:right;font-weight:600;">${lastYear}</th>
            <th style="padding:10px 14px;font-size:11px;text-transform:uppercase;color:#9ca3af;text-align:right;font-weight:600;">Net $</th>
          </tr>
        </thead>
        <tbody>
          ${comparison
            .map(
              (c) => `
            <tr style="border-top:1px solid #f0ede8;">
              <td style="padding:10px 14px;">
                <span style="font-size:13px;font-weight:600;color:#1c1d1d;">${c.dayOfWeek} ${formatDateMMDD(c.date)}</span>
              </td>
              <td style="padding:10px 14px;text-align:right;font-size:14px;font-weight:600;color:#1c1d1d;">
                ${c.thisYearRate !== null ? `$${c.thisYearRate}` : '<span style="color:#d1d5db;">—</span>'}
              </td>
              <td style="padding:10px 14px;text-align:right;">
                <span style="font-size:14px;color:#6b7280;">${c.lastYearRate !== null ? `$${c.lastYearRate}` : "—"}</span>
                ${hasLastYearData ? `<br>${renderStatusBadge(c.lastYearStatus)}` : ""}
              </td>
              <td style="padding:10px 14px;text-align:right;font-size:13px;">
                ${renderNetRevenue(c.netRevenue)}
              </td>
            </tr>
          `
            )
            .join("")}
          <tr style="border-top:2px solid #e8e5e0;background:#f7f5f0;">
            <td style="padding:12px 14px;font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;">Total</td>
            <td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:700;color:#1c1d1d;">
              ${avgThisRate !== null ? `$${Math.round(avgThisRate)}<br><span style="font-size:11px;color:#9ca3af;font-weight:400;">avg/night</span>` : "—"}
            </td>
            <td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:700;color:#6b7280;">
              ${avgLastRate !== null ? `$${Math.round(avgLastRate)}` : "—"}
              ${hasLastYearData ? `<br><span style="font-size:11px;color:#9ca3af;font-weight:400;">${bookedLastYear}/${totalNights} booked</span>` : ""}
            </td>
            <td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:700;">
              ${renderNetRevenue(totalNet)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function sendBookingConfirmation(details: {
  reservationId: string;
  confirmationCode?: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  listingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  chargedAmount: number;
  upsells?: string[];
  pets?: number;
  stripePaymentIntentId?: string;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    gclid?: string;
    fbclid?: string;
  } | null;
  firstTouchAttribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    gclid?: string;
    fbclid?: string;
  } | null;
}) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.error(
      "[BookingConfirmation] No Resend key — skipping notification"
    );
    return;
  }

  const resolved = await resolveListingFromDashboard(details.listingId);
  const calendarListingId = resolved?.calendarListingId || details.listingId;
  const nickname = resolved?.nickname || null;
  const displayName = nickname || details.listingTitle;

  const comparison = await buildYoYComparison(
    calendarListingId,
    details.checkIn,
    details.checkOut
  );
  const nights = generateNightlyDates(details.checkIn, details.checkOut).length;
  const stripeUrl = buildStripeDashboardPaymentUrl(
    details.stripePaymentIntentId || null
  );
  const guestyUrl = `https://app.guesty.com/reservations/${encodeURIComponent(details.reservationId)}/summary`;

  const extrasHtml: string[] = [];
  if (details.upsells && details.upsells.length > 0) {
    extrasHtml.push(details.upsells.map(escapeHtml).join(", "));
  }
  if (details.pets && details.pets > 0) {
    extrasHtml.push(`${details.pets} pet${details.pets > 1 ? "s" : ""}`);
  }

  // Build channel attribution labels
  function resolveChannel(a: typeof details.attribution) {
    let label = "Direct / Organic";
    let detail = "";
    if (a) {
      if (a.gclid) {
        label = "Google Ads";
        if (a.utm_campaign) detail = a.utm_campaign;
      } else if (a.fbclid) {
        label = "Meta Ads";
        if (a.utm_campaign) detail = a.utm_campaign;
      } else if (a.utm_source) {
        label = a.utm_source;
        if (a.utm_medium) label += ` / ${a.utm_medium}`;
        if (a.utm_campaign) detail = a.utm_campaign;
      }
    }
    return { label, detail };
  }

  const channel = resolveChannel(details.attribution);
  const firstTouch = resolveChannel(details.firstTouchAttribution);
  const showFirstTouch = firstTouch.label !== channel.label;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: ALERT_FROM,
      to: ["hayden.laverty@gmail.com", "wyatt@mossdigitalstrategies.com"],
      subject: `New Direct Booking — ${displayName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#faf8f5;">
          <!-- Header -->
          <div style="background:#404f52;padding:24px 28px 20px;">
            <p style="color:#f2c070;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;font-weight:600;">New Direct Booking</p>
            <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">${escapeHtml(displayName)}</h1>
            <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:6px 0 0;">${escapeHtml(details.confirmationCode || details.reservationId)}</p>
          </div>

          <!-- Guest card -->
          <div style="padding:20px 28px;">
            <div style="background:#fff;border-radius:8px;padding:16px 20px;border:1px solid #e8e5e0;">
              <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1c1d1d;">${escapeHtml(details.guestName)}</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(details.guestEmail)}${details.guestPhone ? ` &middot; ${escapeHtml(details.guestPhone)}` : ""}</p>
              <div style="border-top:1px solid #f0ede8;margin:12px 0;padding-top:12px;">
                <table style="width:100%;"><tr>
                  <td style="font-size:13px;color:#6b7280;">${formatDateRange(details.checkIn, details.checkOut)}</td>
                  <td style="font-size:13px;color:#6b7280;text-align:right;">${nights} night${nights !== 1 ? "s" : ""} &middot; ${details.guests} guest${details.guests !== 1 ? "s" : ""}</td>
                </tr></table>
              </div>
              <div style="display:flex;align-items:baseline;gap:12px;margin-top:8px;">
                <span style="font-size:22px;font-weight:700;color:#1c1d1d;">$${details.chargedAmount.toFixed(2)}</span>
                ${extrasHtml.length > 0 ? `<span style="font-size:12px;color:#9ca3af;">+ ${extrasHtml.join(", ")}</span>` : ""}
              </div>
            </div>
          </div>

          <!-- Channel attribution -->
          <div style="padding:0 28px 16px;">
            <div style="background:#fff;border:1px solid #e8e5e0;border-radius:6px;padding:12px 16px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 ${showFirstTouch ? "8px" : "0"} 0;">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600;">Booking Session</span>
                    <span style="font-size:13px;font-weight:600;color:#1c1d1d;margin-left:8px;">${escapeHtml(channel.label)}</span>
                    ${channel.detail ? `<span style="font-size:12px;color:#6b7280;margin-left:6px;">${escapeHtml(channel.detail)}</span>` : ""}
                  </td>
                </tr>
                ${
                  showFirstTouch
                    ? `
                <tr>
                  <td style="padding:8px 0 0;border-top:1px solid #f0ede8;">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600;">First Visit</span>
                    <span style="font-size:13px;font-weight:600;color:#1c1d1d;margin-left:8px;">${escapeHtml(firstTouch.label)}</span>
                    ${firstTouch.detail ? `<span style="font-size:12px;color:#6b7280;margin-left:6px;">${escapeHtml(firstTouch.detail)}</span>` : ""}
                  </td>
                </tr>
                `
                    : ""
                }
              </table>
            </div>
          </div>

          <!-- Rate comparison -->
          ${renderRateComparisonTable(comparison, details.checkIn)}

          <!-- Actions -->
          <div style="padding:0 28px 24px;text-align:center;">
            <a href="${escapeHtml(guestyUrl)}" style="display:inline-block;padding:10px 20px;background:#404f52;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px;">View in Guesty</a>
            ${stripeUrl ? `<a href="${escapeHtml(stripeUrl)}" style="display:inline-block;padding:10px 20px;background:#635bff;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">View in Stripe</a>` : ""}
          </div>

          <!-- Footer -->
          <div style="padding:16px 28px;border-top:1px solid #e8e5e0;">
            <p style="color:#9ca3af;font-size:11px;margin:0;">${new Date().toISOString()} &middot; booktraverse.com</p>
          </div>
        </div>
      `,
    });
    console.log(
      `[BookingConfirmation] Sent for ${details.confirmationCode || details.reservationId}`
    );
  } catch (err) {
    console.error("[BookingConfirmation] Failed to send:", err);
  }
}

export async function sendAlert(
  subject: string,
  body: string,
  alertKey?: string
) {
  const key = alertKey || subject;
  const now = Date.now();

  // Check cooldown to prevent alert spam
  const lastSent = alertCooldowns.get(key);
  if (lastSent && now - lastSent < COOLDOWN_MS) {
    console.log(`Alert suppressed (cooldown): ${subject}`);
    return;
  }

  const sharedLastSent = await readCooldownFromSupabase(key);
  if (sharedLastSent && now - sharedLastSent < COOLDOWN_MS) {
    alertCooldowns.set(key, sharedLastSent);
    console.log(`Alert suppressed (shared cooldown): ${subject}`);
    return;
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.error(`ALERT (no Resend key): ${subject} — ${body}`);
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `[BookTraverse Alert] ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #dc2626;">${subject}</h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 22px;">${body}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            ${new Date().toISOString()} — booktraverse.com automated alert
          </p>
        </div>
      `,
    });
    alertCooldowns.set(key, now);
    await persistCooldownToSupabase(key, now);
    console.log(`Alert sent: ${subject}`);
  } catch (err) {
    // Alert delivery is best-effort — never let it break the main flow
    console.error(`Failed to send alert: ${subject}`, err);
  }
}

export async function sendGuestyRefundRecordFailedAlert(details: {
  reservationId: string;
  confirmationCode: string | null;
  refundAmount: number;
  stripeRefundId: string;
  error: string;
}) {
  await sendAlert(
    "Guesty Refund Record Failed",
    `Stripe refund <strong>$${details.refundAmount.toFixed(2)}</strong> ` +
      `succeeded for reservation <strong>${details.confirmationCode || details.reservationId}</strong> ` +
      `but recording the negative payment in Guesty FAILED.<br/><br/>` +
      `<strong>Action:</strong> manually post a -$${details.refundAmount.toFixed(2)} payment in Guesty.<br/>` +
      `Stripe refund ID: <code>${details.stripeRefundId}</code><br/>` +
      `Error: ${details.error}`,
    `guesty-refund-record-failed-${details.reservationId}`
  );
}
