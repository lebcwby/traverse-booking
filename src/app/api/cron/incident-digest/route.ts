// Incident digest — one email per day listing every unresolved alert_incident
// plus every pending_checkouts row stuck longer than 48h.
//
// Why this exists: per-incident alerts in alerts.ts fire at 0h / +1h / +5h /
// +29h (incident cadence) or 0h / +24h / +48h (per-PI cadence) and then go
// silent. Without this cron a drawn-out failure would fall off the inbox
// entirely after the cadence ran out. The digest is the "still not fixed"
// nudge after the loud phase ends.
//
// Schedule: 0 15 * * * (08:00 Mountain, roughly the start of the Traverse
// work day). Runs before the existing daily-booking-digest at 30 7 * * *…
// wait, 7 UTC is midnight Mountain. Align this to 15 UTC so it lands at
// 08:00 Mountain, well before the booking digest at 14:30 UTC. If anything
// ships ambiguous the digest mail still reads clearly.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { OPS_ALERT_INBOX, renderAlertDetails, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface OpenIncident {
  key: string;
  first_sent_at: Date;
  last_sent_at: Date;
  reminder_count: number;
}

interface StuckCheckout {
  payment_intent_id: string;
  status: string;
  created_at: Date;
  last_error: string | null;
  tracking: Record<string, unknown> | null;
  guest: Record<string, unknown> | null;
}

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function formatAgeHours(from: Date): string {
  const hours = (Date.now() - from.getTime()) / 3600_000;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();

  // Any incident whose per-key cadence has gone quiet but hasn't been
  // explicitly resolved. The idx_alert_incidents_unresolved partial index
  // keeps this cheap.
  const incidentsResult = await pool.query<OpenIncident>(
    `select key, first_sent_at, last_sent_at, reminder_count
       from public.alert_incidents
      where resolved_at is null
      order by first_sent_at asc
      limit 100`
  );
  const incidents = incidentsResult.rows;

  // pending_checkouts rows older than 48h where ops still hasn't stamped a
  // reservation. These are the per-PI alerts after their [24,24] cadence
  // has gone quiet. Paid rows (money captured, booking incomplete) are the
  // priority — unpaid 'pending' rows die naturally at 2 days anyway.
  const stuckResult = await pool.query<StuckCheckout>(
    `select payment_intent_id, status, created_at, last_error, tracking, guest
       from public.pending_checkouts
      where reservation_id is null
        and created_at < now() - interval '48 hours'
        and status = 'paid_pending_reservation'
      order by created_at asc
      limit 50`
  );
  const stuck = stuckResult.rows;

  if (incidents.length === 0 && stuck.length === 0) {
    return NextResponse.json({ ok: true, incidents: 0, stuck: 0, sent: false });
  }

  const incidentRows = incidents.map(
    (i) =>
      [
        i.key,
        `${i.reminder_count} email${i.reminder_count === 1 ? "" : "s"} · open ${formatAgeHours(i.first_sent_at)} · last ${formatAgeHours(i.last_sent_at)} ago`,
      ] as [string, string]
  );

  const stuckRows = stuck.map((s) => {
    const tracking = (s.tracking || {}) as {
      listingTitle?: string;
      checkIn?: string;
      checkOut?: string;
    };
    const guest = (s.guest || {}) as { email?: string };
    const label = [
      tracking.listingTitle || "unknown listing",
      tracking.checkIn && tracking.checkOut
        ? `${tracking.checkIn}→${tracking.checkOut}`
        : null,
      guest.email || null,
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      s.payment_intent_id,
      `${s.status} · ${formatAgeHours(s.created_at)} old · ${label}${
        s.last_error ? ` · ${s.last_error.slice(0, 160)}` : ""
      }`,
    ] as [string, string];
  });

  const body = [
    `<p>Daily digest of open ops incidents from the atomic claim table and the
      checkout recovery backlog.</p>`,
    incidents.length > 0
      ? `<h3 style="margin:16px 0 4px;">Open alert_incidents (${incidents.length})</h3>${renderAlertDetails(incidentRows)}`
      : "",
    stuck.length > 0
      ? `<h3 style="margin:16px 0 4px;">Stuck pending_checkouts > 48h (${stuck.length})</h3>${renderAlertDetails(stuckRows)}`
      : "",
    `<p style="color:#6b7280;font-size:12px;">An incident clears by calling
      <code>resolveAlertIncident(key)</code> from a healthy code path; a stuck
      checkout clears by stamping <code>reservation_id</code> on the row.</p>`,
  ]
    .filter(Boolean)
    .join("");

  // Digest itself is a daily alert — key it with a date suffix so each day's
  // digest is its own incident and doesn't dedup against yesterday's.
  const today = new Date().toISOString().slice(0, 10);
  await sendAlert(
    `Ops digest — ${incidents.length} open incident${incidents.length === 1 ? "" : "s"}, ${stuck.length} stuck checkout${stuck.length === 1 ? "" : "s"}`,
    body,
    `incident-digest-${today}`,
    // Single daily email, no reminders — an empty cadenceHours array means
    // the first send goes out and all later claims on this key stay silent.
    { to: OPS_ALERT_INBOX, cadenceHours: [] }
  );

  return NextResponse.json({
    ok: true,
    incidents: incidents.length,
    stuck: stuck.length,
    sent: true,
  });
}
