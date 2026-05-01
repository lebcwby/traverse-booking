import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const GUESTY_API = "https://open-api.guesty.com/v1";
const PAGE_SIZE = 100;
const BUFFER_MS = 5 * 60 * 1000;
const MAX_PAGES = 20;
const ALERT_RECENCY_MS = 15 * 60 * 1000;

const n = (v: unknown): unknown => (v === undefined || v === null ? null : v);

// ─── NEW BOOKING ALERT (Resend) ─────────────────────────────────
// Fires for genuinely new direct bookings that did NOT go through
// booktraverse.com checkout. Checkout-flow bookings are alerted
// directly from src/lib/alerts.ts in the Next.js app; they also
// carry a stripe_payment_intent_id, which we re-check to suppress
// double alerts when this sync picks them up.
//
// Template is ported from src/lib/alerts.ts `sendBookingConfirmation`
// to match the format every other direct-booking alert uses
// (cream background, teal header, YoY nightly rate comparison table).
// The old simple table template from the orphaned
// `sync-website-reservations` function is gone — it was never seen
// in practice because that function had no pg_cron.

const ALERT_RECIPIENTS = [
  "hayden.laverty@gmail.com",
  "wyatt@mossdigitalstrategies.com",
];

const EXCLUDED_ALERT_EMAILS = new Set([
  "trevor.stout164@gmail.com",
  "test@booktraverse.com",
  "testing1@booktraverse.com",
  "testing2@booktraverse.com",
  "trevor@164investments.com",
  "bolton.osaz@gmail.com",
]);

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

function formatDateMMDD(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
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

interface CalendarDayData {
  date: string;
  price: number;
  status: string;
}

interface NightlyComparison {
  date: string;
  dayOfWeek: string;
  thisYearRate: number | null;
  lastYearRate: number | null;
  lastYearStatus: string | null;
  netRevenue: number | null;
}

interface ResolvedListing {
  calendarListingId: string;
  nickname: string | null;
}

async function resolveListingFromDashboard(
  supabase: SupabaseClient,
  listingId: string
): Promise<ResolvedListing | null> {
  if (!listingId) return null;
  try {
    const { data: rows } = await supabase
      .from("listings")
      .select("guesty_id,nickname")
      .eq("guesty_id", listingId)
      .limit(1);
    if (!rows || rows.length === 0) return null;
    const nickname = rows[0].nickname as string | null;

    // BEAPI "X" suffix resolution — calendar_days is stored under the non-X variant
    if (nickname && nickname.endsWith("X")) {
      const base = nickname.slice(0, -1);
      const { data: mapRows } = await supabase
        .from("listings")
        .select("guesty_id,nickname")
        .eq("nickname", base)
        .limit(1);
      if (mapRows && mapRows.length > 0) {
        return {
          calendarListingId: mapRows[0].guesty_id as string,
          nickname: mapRows[0].nickname as string,
        };
      }
      return { calendarListingId: listingId, nickname: base };
    }

    return { calendarListingId: listingId, nickname };
  } catch (err) {
    console.error(`[BookingAlert] resolveListing error for ${listingId}:`, err);
    return null;
  }
}

async function fetchCalendarDays(
  supabase: SupabaseClient,
  listingId: string,
  dates: string[]
): Promise<Map<string, CalendarDayData>> {
  const result = new Map<string, CalendarDayData>();
  if (!listingId || dates.length === 0) return result;
  try {
    const { data: rows } = await supabase
      .from("calendar_days")
      .select("date,price,status")
      .eq("listing_id", listingId)
      .in("date", dates);
    for (const row of rows || []) {
      result.set(row.date as string, row as CalendarDayData);
    }
  } catch (err) {
    console.error(
      `[BookingAlert] calendar_days fetch error for ${listingId}:`,
      err
    );
  }
  return result;
}

async function buildYoYComparison(
  supabase: SupabaseClient,
  listingId: string,
  checkIn: string,
  checkOut: string
): Promise<NightlyComparison[]> {
  const thisYearDates = generateNightlyDates(checkIn, checkOut);
  if (thisYearDates.length === 0) return [];
  const lastYearDates = thisYearDates.map(getLastYearDate);
  const allDates = [...thisYearDates, ...lastYearDates];
  const calendarData = await fetchCalendarDays(supabase, listingId, allDates);

  return thisYearDates.map((date, i) => {
    const lyDate = lastYearDates[i];
    const thisYear = calendarData.get(date);
    const lastYear = calendarData.get(lyDate);
    const thisRate = thisYear?.price ?? null;
    const lastRate = lastYear?.price ?? null;
    const lyStatus = lastYear?.status ?? null;

    // Net revenue: if booked last year → rate differential;
    // unbooked/blocked → full this-year rate is incremental
    let netRevenue: number | null = null;
    if (thisRate !== null) {
      if (lyStatus === "booked" && lastRate !== null) {
        netRevenue = thisRate - lastRate;
      } else {
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

async function sendNewBookingAlert(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[BookingAlert] No RESEND_API_KEY — skipping");
    return;
  }

  const guest = row.guest as {
    fullName?: string;
    email?: string;
    phone?: string;
  } | null;
  const listing = row.listing as { nickname?: string; title?: string } | null;
  const money = row.money as {
    hostPayout?: number;
    totalPaid?: number;
    balanceDue?: number;
    invoiceItems?: Array<{ title?: string; isUpsellFee?: boolean }>;
  } | null;
  const nog = row.number_of_guests as {
    numberOfPets?: number;
  } | null;

  const listingId = row.listing_id as string | null;
  const resolved = listingId
    ? await resolveListingFromDashboard(supabase, listingId)
    : null;
  const calendarListingId = resolved?.calendarListingId || listingId || "";
  const nickname =
    resolved?.nickname || (row.listing_nickname as string | null) || null;
  const displayName = nickname || listing?.title || "Unknown Property";
  const guestName = guest?.fullName || "Unknown Guest";
  const guestEmail = guest?.email || "";
  const guestPhone = guest?.phone || "";

  const checkIn =
    (row.check_in_date_localized as string) ||
    ((row.check_in as string) || "").slice(0, 10);
  const checkOut =
    (row.check_out_date_localized as string) ||
    ((row.check_out as string) || "").slice(0, 10);

  const comparison = calendarListingId
    ? await buildYoYComparison(supabase, calendarListingId, checkIn, checkOut)
    : [];
  const nights = generateNightlyDates(checkIn, checkOut).length;
  const chargedAmount = money?.totalPaid ?? 0;
  const guests = (row.guests_count as number | null) ?? 1;
  const guestyUrl = `https://app.guesty.com/reservations/${encodeURIComponent(
    row.guesty_id as string
  )}/summary`;

  // Upsells + pets from money.invoiceItems / number_of_guests
  const extrasHtml: string[] = [];
  const upsells = (money?.invoiceItems || [])
    .filter((ii) => ii?.isUpsellFee)
    .map((ii) => escapeHtml(ii.title || ""))
    .filter((t) => t.length > 0);
  if (upsells.length > 0) extrasHtml.push(upsells.join(", "));
  const pets = nog?.numberOfPets ?? 0;
  if (pets > 0) extrasHtml.push(`${pets} pet${pets > 1 ? "s" : ""}`);

  // Widget bookings are inherently direct (no UTM/gclid context in Guesty)
  const channelLabel = "Direct / Organic";

  const confirmationCode =
    (row.confirmation_code as string) || (row.guesty_id as string);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#faf8f5;">
      <!-- Header -->
      <div style="background:#404f52;padding:24px 28px 20px;">
        <p style="color:#f2c070;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;font-weight:600;">New Direct Booking</p>
        <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700;">${escapeHtml(displayName)}</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:6px 0 0;">${escapeHtml(confirmationCode)}</p>
      </div>

      <!-- Guest card -->
      <div style="padding:20px 28px;">
        <div style="background:#fff;border-radius:8px;padding:16px 20px;border:1px solid #e8e5e0;">
          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1c1d1d;">${escapeHtml(guestName)}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(guestEmail)}${guestPhone ? ` &middot; ${escapeHtml(guestPhone)}` : ""}</p>
          <div style="border-top:1px solid #f0ede8;margin:12px 0;padding-top:12px;">
            <table style="width:100%;"><tr>
              <td style="font-size:13px;color:#6b7280;">${formatDateRange(checkIn, checkOut)}</td>
              <td style="font-size:13px;color:#6b7280;text-align:right;">${nights} night${nights !== 1 ? "s" : ""} &middot; ${guests} guest${guests !== 1 ? "s" : ""}</td>
            </tr></table>
          </div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-top:8px;">
            <span style="font-size:22px;font-weight:700;color:#1c1d1d;">$${chargedAmount.toFixed(2)}</span>
            ${extrasHtml.length > 0 ? `<span style="font-size:12px;color:#9ca3af;">+ ${extrasHtml.join(", ")}</span>` : ""}
          </div>
        </div>
      </div>

      <!-- Channel attribution -->
      <div style="padding:0 28px 16px;">
        <div style="background:#fff;border:1px solid #e8e5e0;border-radius:6px;padding:12px 16px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td>
                <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:600;">Booking Session</span>
                <span style="font-size:13px;font-weight:600;color:#1c1d1d;margin-left:8px;">${channelLabel}</span>
                <span style="font-size:12px;color:#6b7280;margin-left:6px;">Guesty booking engine widget — verify payment</span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Rate comparison -->
      ${renderRateComparisonTable(comparison, checkIn)}

      <!-- Actions -->
      <div style="padding:0 28px 24px;text-align:center;">
        <a href="${escapeHtml(guestyUrl)}" style="display:inline-block;padding:10px 20px;background:#404f52;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">View in Guesty</a>
      </div>

      <!-- Footer -->
      <div style="padding:16px 28px;border-top:1px solid #e8e5e0;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">${new Date().toISOString()} &middot; booktraverse.com</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Book Traverse Alerts <noreply@booktraverse.com>",
        to: ALERT_RECIPIENTS,
        subject: `New Direct Booking — ${displayName}`,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[BookingAlert] Resend API error ${res.status}: ${errText}`
      );
    } else {
      console.log(
        `[BookingAlert] Sent alert for ${confirmationCode} — ${guestName} at ${displayName}`
      );
    }
  } catch (err) {
    console.error("[BookingAlert] Failed to send:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get cached token — NEVER refresh directly (5 per 24h limit)
    const { data: tokens } = await supabase
      .from("guesty_tokens")
      .select("access_token, expires_at")
      .eq("token_type", "openapi")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!tokens?.length || tokens[0].expires_at <= Date.now()) {
      console.error(
        "No valid Guesty token in cache — token must be refreshed externally"
      );
      return json(
        { error: "Guesty token expired — refresh via token cron" },
        500
      );
    }
    const token = tokens[0].access_token;

    // Get last sync time
    const { data: meta, error: metaError } = await supabase
      .from("sync_metadata")
      .select("last_sync_at")
      .eq("sync_type", "reservations")
      .single();

    if (metaError) {
      console.error("sync_metadata query failed:", metaError.message);
    }

    const lastSync = Number(meta?.last_sync_at) || 0;
    const cutoff = new Date(lastSync - BUFFER_MS).toISOString();
    console.log(
      `Sync cutoff: ${cutoff} (last_sync_at=${meta?.last_sync_at}, parsed=${lastSync})`
    );

    // Fetch reservations sorted by lastUpdatedAt (the correct Guesty field — NOT updatedAt)
    let skip = 0;
    let total = 0;
    let totalAlertsSent = 0;
    let pages = 0;
    let stoppedEarly = false;
    const fields =
      "_id confirmationCode listingId guestId status source secondarySource checkIn checkOut checkInDateLocalized checkOutDateLocalized nightsCount listing guest money integration notes numberOfGuests guestsCount review specialRequests plannedArrival plannedDeparture keyCode isReturningGuest manuallyCreated confirmedAt createdAt updatedAt lastUpdatedAt cancellationPolicy customFields daysInAdvance guestStay isMidStay";

    while (pages < MAX_PAGES) {
      // Use JSON filter format — bracket format is ignored by Guesty's API
      const filter = JSON.stringify([
        { field: "lastUpdatedAt", operator: "$gte", value: cutoff },
      ]);
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip: String(skip),
        sort: "-lastUpdatedAt",
        fields: fields,
        filters: filter,
      });
      const url = `${GUESTY_API}/reservations?${params.toString()}`;

      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (resp.status === 429) {
        console.log("Rate limited, stopping");
        break;
      }
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`Guesty ${resp.status}:`, errText.slice(0, 200));
        break;
      }

      const data = await resp.json();
      const items = data.results || [];
      if (items.length === 0) {
        if (pages === 0) {
          return json({
            success: true,
            synced: 0,
            pages: 0,
            stoppedEarly: false,
            alertsSent: 0,
            debug: {
              url: url.slice(0, 300),
              count: data.count,
              cutoff,
              hasResults: !!data.results,
              error: data.error,
            },
          });
        }
        break;
      }

      // Stop when we hit records last updated before our cutoff
      const cutoffIdx = items.findIndex((r: { lastUpdatedAt?: string }) => {
        return (r.lastUpdatedAt || "") < cutoff;
      });

      const pageItems = cutoffIdx >= 0 ? items.slice(0, cutoffIdx) : items;
      if (cutoffIdx >= 0) stoppedEarly = true;

      // Build rows and upsert
      const rows = pageItems
        .filter(
          (r: {
            checkIn?: string;
            checkOut?: string;
            listing?: { nickname?: string };
          }) => {
            if (!r.checkIn || !r.checkOut) return false;
            const nick = r.listing?.nickname || "";
            return !nick.startsWith("TC -") && !nick.startsWith("TC-");
          }
        )
        .map((r: Record<string, any>) => buildRow(r)); // eslint-disable-line @typescript-eslint/no-explicit-any

      if (rows.length > 0) {
        // Pre-fetch existing rows so we can tell "new" from "updated" for the
        // alert path. Updates must never re-alert — the 15-min createdAt guard
        // alone is not enough because a row can be re-synced on every run as
        // long as its lastUpdatedAt >= cutoff.
        const guestyIds = rows.map(
          (r: Record<string, unknown>) => r.guesty_id as string
        );
        const { data: existingRecords } = await supabase
          .from("reservations")
          .select("guesty_id, stripe_payment_intent_id")
          .in("guesty_id", guestyIds);
        const existingMap = new Map(
          (existingRecords || []).map((r: Record<string, unknown>) => [
            r.guesty_id as string,
            r,
          ])
        );

        // Upsert BEFORE alerting so a mid-run crash can't cause a duplicate
        // alert on retry — the row is persisted and will appear in existingMap
        // on the next run.
        const { error } = await supabase
          .from("reservations")
          .upsert(rows, { onConflict: "guesty_id" });
        if (error) {
          console.error("Upsert error:", error.message);
        } else {
          total += rows.length;
        }

        // Identify alert candidates: direct sources, confirmed, new to DB,
        // created within the recency window, non-test email.
        const candidates = rows.filter((row: Record<string, unknown>) => {
          if (existingMap.has(row.guesty_id as string)) return false;
          if (row.status !== "confirmed") return false;
          const src = row.source as string | null;
          if (src !== "website" && src !== "BE-API") return false;
          const email = (
            (row.guest_email as string | null) || ""
          ).toLowerCase();
          if (EXCLUDED_ALERT_EMAILS.has(email)) return false;
          const createdAt = row.guesty_created_at as string | null;
          if (!createdAt) return false;
          const ageMs = Date.now() - new Date(createdAt).getTime();
          return ageMs >= 0 && ageMs < ALERT_RECENCY_MS;
        });

        if (candidates.length > 0) {
          // Re-read from DB after upsert to check stripe_payment_intent_id.
          // checkout-finalizer in the Next.js app sets that column when it
          // completes a booktraverse.com checkout; the upsert above does not
          // overwrite it. Any row with that column set is already alerted by
          // the Next.js path — skip it here.
          const candidateIds = candidates.map(
            (r: Record<string, unknown>) => r.guesty_id as string
          );
          const { data: persisted } = await supabase
            .from("reservations")
            .select("guesty_id, stripe_payment_intent_id")
            .in("guesty_id", candidateIds);
          const checkoutFlowIds = new Set(
            (persisted || [])
              .filter(
                (r: Record<string, unknown>) =>
                  r.stripe_payment_intent_id != null
              )
              .map((r: Record<string, unknown>) => r.guesty_id as string)
          );

          for (const row of candidates) {
            if (checkoutFlowIds.has(row.guesty_id as string)) continue;
            await sendNewBookingAlert(supabase, row);
            totalAlertsSent++;
          }
        }
      }

      if (stoppedEarly) break;
      skip += PAGE_SIZE;
      pages++;
      if (items.length < PAGE_SIZE) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // Update sync metadata
    await supabase.from("sync_metadata").upsert(
      {
        sync_type: "reservations",
        last_sync_at: Date.now(),
        last_sync_status: "success",
        items_synced: total,
      },
      { onConflict: "sync_type" }
    );

    return json({
      success: true,
      synced: total,
      pages,
      stoppedEarly,
      cutoff,
      alertsSent: totalAlertsSent,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Sync failed:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildRow(res: Record<string, any>): Record<string, unknown> {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = res.money || {};
  const now = Date.now();
  return {
    guesty_id: res._id,
    confirmation_code: n(res.confirmationCode),
    listing_id: n(res.listingId),
    guest_id: n(res.guestId),
    status: n(res.status),
    source: n(res.source),
    secondary_source: n(res.secondarySource),
    check_in: res.checkIn,
    check_out: res.checkOut,
    check_in_date_localized: n(res.checkInDateLocalized),
    check_out_date_localized: n(res.checkOutDateLocalized),
    nights_count: n(res.nightsCount),
    listing_nickname: n(res.listing?.nickname),
    guest_email: n(res.guest?.email),
    guest_phone: n(res.guest?.phone),
    fare_accommodation: n(m.fareAccommodation),
    fare_cleaning: n(m.fareCleaning),
    total_fees: n(m.totalFees),
    total_taxes: n(m.totalTaxes),
    total_paid: n(m.totalPaid),
    balance_due: n(m.balanceDue),
    host_payout: n(m.hostPayout),
    net_income: n(m.netIncome),
    owner_revenue: n(m.ownerRevenue),
    commission: n(m.commission),
    currency: n(m.currency),
    guest: res.guest
      ? {
          _id: n(res.guest._id),
          firstName: n(res.guest.firstName),
          lastName: n(res.guest.lastName),
          fullName: n(res.guest.fullName),
          email: n(res.guest.email),
          phone: n(res.guest.phone),
        }
      : null,
    listing: res.listing
      ? {
          _id: n(res.listing._id),
          title: n(res.listing.title),
          nickname: n(res.listing.nickname),
        }
      : null,
    guests_count: n(res.guestsCount),
    number_of_guests: res.numberOfGuests
      ? typeof res.numberOfGuests === "number"
        ? res.numberOfGuests
        : {
            numberOfAdults: n(res.numberOfGuests.numberOfAdults),
            numberOfChildren: n(res.numberOfGuests.numberOfChildren),
            numberOfInfants: n(res.numberOfGuests.numberOfInfants),
            numberOfPets: n(res.numberOfGuests.numberOfPets),
          }
      : null,
    money: res.money
      ? {
          fareAccommodation: n(m.fareAccommodation),
          fareCleaning: n(m.fareCleaning),
          totalFees: n(m.totalFees),
          totalTaxes: n(m.totalTaxes),
          totalPaid: n(m.totalPaid),
          balanceDue: n(m.balanceDue),
          hostPayout: n(m.hostPayout),
          netIncome: n(m.netIncome),
          ownerRevenue: n(m.ownerRevenue),
          commission: n(m.commission),
          currency: n(m.currency),
          invoiceItems: n(m.invoiceItems),
          hostServiceFee: n(m.hostServiceFee),
          hostServiceFeeIncTax: n(m.hostServiceFeeIncTax),
          channelCommission: n(m.channelCommission),
          subTotalPrice: n(m.subTotalPrice),
          payments: n(m.payments),
        }
      : null,
    money_full: n(res.money),
    integration: res.integration
      ? {
          platform: n(res.integration.platform),
          externalId: n(res.integration.externalId || res.integration._id),
        }
      : null,
    notes: n(res.notes),
    review: res.review
      ? {
          rating: n(res.review.rating),
          publicReview: n(res.review.publicReview),
          privateReview: n(res.review.privateReview),
        }
      : null,
    special_requests: n(res.specialRequests),
    planned_arrival: n(res.plannedArrival),
    planned_departure: n(res.plannedDeparture),
    key_code: n(res.keyCode),
    is_returning_guest: n(res.isReturningGuest),
    manually_created: n(res.manuallyCreated),
    confirmed_at: n(res.confirmedAt),
    guesty_created_at: n(res.createdAt),
    guesty_updated_at: n(res.lastUpdatedAt || res.updatedAt),
    cancellation_policy: n(res.cancellationPolicy),
    custom_fields: n(res.customFields),
    days_in_advance: n(res.daysInAdvance),
    guest_stay: n(res.guestStay),
    is_mid_stay: n(res.isMidStay),
    enriched_at: m.invoiceItems ? now : null,
    last_synced_at: now,
  };
}
