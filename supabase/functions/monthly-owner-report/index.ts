// Monthly booking report for the Lodge at Mountaineer Square (CB:LMS) units.
//
// Scheduled by pg_cron, `monthly-owner-report`, "0 9 1 * *" — 09:00 UTC on the
// 1st. The job POSTs here with the CRON_SECRET read from kv_store. Emails a
// per-unit table of last month's reservations and booked nights to REPORT_TO.
//
// ── Vendored into the repo 2026-10-19 ───────────────────────────────────
//
// This ran for months as a deployed function with NO source in version
// control. It was never reviewed, never type-checked against the schema, and
// invisible to search — which is how the bug below survived. If you change
// it, change it here and redeploy; do not edit it in the dashboard.
//
// ⚠️ FIXED 2026-10-19 — the filter was on the wrong column and the report was
// empty every single month. It did:
//
//     .like('confirmation_code', 'CB:LMS%')
//
// but `CB:LMS…` is a **listings.nickname** pattern. Every confirmation_code in
// the table starts with `GY-`. The query matched 0 rows of 328, fell into the
// "no data" branch, and mailed "No confirmed CB:LMS reservations were found"
// — while September alone had 10 real check-ins across those units.
//
// The correct path is nickname → listings.guesty_id → reservations.listing_id,
// which is what it now does. Fetching the units first also removes the second
// lookup the old version needed to resolve nicknames afterwards.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const REPORT_TO = [
  "erin@traversehospitality.com",
  "nadim@traversehospitality.com",
];
// ⚠️ traversehospitality.com must stay verified in Resend. An unverified FROM
// domain does not bounce — Resend accepts the call, returns 200 and an id, and
// queues forever. That silently dropped 155 days of mail once already, and it
// is why nobody noticed this report was broken: the empty emails were not
// arriving either.
const FROM_EMAIL = "Traverse Hospitality <reports@traversehospitality.com>";

/** The units this report covers, matched on listings.nickname. */
const UNIT_NICKNAME_PREFIX = "CB:LMS";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (CRON_SECRET && token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const firstOfThisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const firstOfLastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );
    const startDate = firstOfLastMonth.toISOString().split("T")[0];
    const endDate = firstOfThisMonth.toISOString().split("T")[0];
    const reportMonth = MONTH_NAMES[firstOfLastMonth.getUTCMonth()];
    const reportYear = firstOfLastMonth.getUTCFullYear();

    // 1. Which listings are CB:LMS. This is the step the old version skipped,
    //    filtering reservations on a column that never holds a nickname.
    const { data: units, error: unitErr } = await supabase
      .from("listings")
      .select("guesty_id, nickname")
      .like("nickname", `${UNIT_NICKNAME_PREFIX}%`);

    if (unitErr) throw new Error(`Listing lookup failed: ${unitErr.message}`);

    const nicknameById: Record<string, string> = {};
    for (const u of units ?? []) {
      if (u.guesty_id) nicknameById[u.guesty_id] = u.nickname ?? u.guesty_id;
    }
    const listingIds = Object.keys(nicknameById);

    // An empty unit list is a configuration problem, not a quiet month, and
    // must not be reported as "no bookings".
    if (listingIds.length === 0) {
      const msg = `No listings matched nickname ${UNIT_NICKNAME_PREFIX}% — the report cannot run.`;
      console.error(msg);
      await sendEmail(
        `⚠️ CB:LMS Booking Report — misconfigured (${reportMonth} ${reportYear})`,
        `<p>${msg}</p><p>Check the nickname prefix against the listings table.</p>`
      );
      return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    // 2. Last month's check-ins for those units.
    const { data: reservations, error: resError } = await supabase
      .from("reservations")
      .select("listing_id, listing_title, check_in, check_out, nights_count, status")
      .in("listing_id", listingIds)
      .gte("check_in", startDate)
      .lt("check_in", endDate)
      .neq("status", "canceled");

    if (resError) throw new Error(`DB query failed: ${resError.message}`);

    if (!reservations || reservations.length === 0) {
      await sendEmail(
        `CB:LMS Booking Report — ${reportMonth} ${reportYear}`,
        buildNoDataHtml(reportMonth, reportYear, listingIds.length)
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: "No CB:LMS reservations found",
          unitsChecked: listingIds.length,
          month: `${reportMonth} ${reportYear}`,
        })
      );
    }

    const unitMap: Record<
      string,
      { nickname: string; nights: number; count: number }
    > = {};
    for (const res of reservations) {
      const id = res.listing_id ?? "unknown";
      const nickname = nicknameById[id] ?? res.listing_title ?? id;
      // ⚠️ nights_count is NULL on every row in this table, so the fallback is
      // the real path, not a safety net. Kept in case it is ever populated.
      const nights =
        res.nights_count ??
        (res.check_in && res.check_out
          ? Math.round(
              (new Date(res.check_out).getTime() -
                new Date(res.check_in).getTime()) /
                86_400_000
            )
          : 0);

      if (!unitMap[id]) unitMap[id] = { nickname, nights: 0, count: 0 };
      unitMap[id].nights += nights;
      unitMap[id].count += 1;
    }

    const rows = Object.values(unitMap).sort((a, b) =>
      a.nickname.localeCompare(b.nickname)
    );
    const totalNights = rows.reduce((s, u) => s + u.nights, 0);
    const totalCount = rows.reduce((s, u) => s + u.count, 0);

    await sendEmail(
      `CB:LMS Booking Report — ${reportMonth} ${reportYear}`,
      buildReportHtml(
        rows,
        totalNights,
        totalCount,
        reportMonth,
        reportYear,
        startDate,
        endDate
      )
    );

    return new Response(
      JSON.stringify({
        success: true,
        units: rows.length,
        unitsChecked: listingIds.length,
        totalNights,
        totalReservations: totalCount,
        month: `${reportMonth} ${reportYear}`,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("monthly-owner-report error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY secret is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: REPORT_TO, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

function buildReportHtml(
  units: { nickname: string; nights: number; count: number }[],
  totalNights: number,
  totalCount: number,
  month: string,
  year: number,
  startDate: string,
  endDate: string
): string {
  const rows = units
    .map(
      (u) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-weight:500">${escHtml(u.nickname)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center">${u.count}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600">${u.nights}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>CB:LMS Report</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">

        <tr><td style="background:#1f2937;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px">CB:LMS Booking Report</h1>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:14px">${month} ${year} &nbsp;|&nbsp; Check-ins ${startDate} – ${endDate}</p>
        </td></tr>

        <tr><td style="padding:24px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px 16px;text-align:left;font-size:13px;color:#6b7280;border-bottom:2px solid #d1d5db">Unit / Listing</th>
                <th style="padding:10px 16px;text-align:center;font-size:13px;color:#6b7280;border-bottom:2px solid #d1d5db">Reservations</th>
                <th style="padding:10px 16px;text-align:center;font-size:13px;color:#6b7280;border-bottom:2px solid #d1d5db">Booked Nights</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#f3f4f6">
                <td style="padding:10px 16px;font-weight:700">Total</td>
                <td style="padding:10px 16px;text-align:center;font-weight:700">${totalCount}</td>
                <td style="padding:10px 16px;text-align:center;font-weight:700;color:#1f2937">${totalNights}</td>
              </tr>
            </tfoot>
          </table>
        </td></tr>

        <tr><td style="padding:20px 32px;color:#9ca3af;font-size:12px">
          Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
          Confirmed reservations only. Excludes cancelled bookings.
          Counts direct website bookings held in our reservations table.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildNoDataHtml(
  month: string,
  year: number,
  unitsChecked: number
): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:32px;color:#1f2937">
    <h2>CB:LMS Booking Report — ${month} ${year}</h2>
    <p>No confirmed CB:LMS reservations were found with check-in dates in ${month} ${year}.</p>
    <p style="color:#6b7280;font-size:13px">Checked ${unitsChecked} CB:LMS units. If that count looks wrong, the report is misconfigured rather than quiet.</p>
  </body></html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
