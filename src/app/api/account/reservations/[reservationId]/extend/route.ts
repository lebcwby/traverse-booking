import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { sendAlert, OPS_ALERT_INBOX } from "@/lib/alerts";
import { civilDate } from "@/lib/report-day";
import {
  CANCELLATION_TIMEZONE,
  resolveCheckInDate,
} from "@/lib/cancellation-policy";
import {
  buildDateChangeRequestAlert,
  guestDisplayName,
  parseDateChangeRequest,
} from "@/lib/date-change-requests";

/**
 * Date changes are requests.
 *
 * This route used to quote a new stay by writing the dates to Guesty, then
 * charge, refund, or finalize from the guest's browser. None of that runs
 * anymore. `action: "request"` stores a row in `date_change_requests` and
 * emails the team. Every other action — quote, payment-intent, finalize,
 * finalize-no-charge, finalize-refund, rollback — is refused before any
 * reservation, Stripe, or Guesty call.
 *
 * Approving the dates stays a manual step in Guesty.
 */

const SELF_SERVICE_REFUSAL = {
  error:
    "Guests can't change stay dates directly. Submit a date-change request instead. Nothing was charged, refunded, or changed.",
  code: "date_change_is_request_only",
};

interface ReservationRow {
  guesty_id: string;
  confirmation_code: string | null;
  listing_id: string | null;
  listing_title: string | null;
  check_in: string | null;
  check_out: string | null;
  check_in_date_localized: string | null;
  check_out_date_localized: string | null;
  status: string | null;
  guest: unknown;
  user_id: string | null;
}

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  return user;
}

async function getOwnedReservation(
  reservationId: string,
  userEmail: string,
  userId: string
): Promise<ReservationRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT
      guesty_id, confirmation_code, listing_id, listing_title,
      check_in, check_out, check_in_date_localized, check_out_date_localized,
      status, guest, user_id
    FROM reservations
    WHERE guesty_id = $1
      AND (lower(guest->>'email') = lower($2) OR user_id = $3)`,
    [reservationId, userEmail, userId]
  );
  return (result.rows[0] as ReservationRow | undefined) ?? null;
}

function stayDates(row: ReservationRow): {
  checkIn: string;
  checkOut: string;
} | null {
  const checkIn = resolveCheckInDate(
    row.check_in_date_localized?.trim() || row.check_in || ""
  );
  const checkOut = resolveCheckInDate(
    row.check_out_date_localized?.trim() || row.check_out || ""
  );
  if (!checkIn || !checkOut) return null;
  return { checkIn, checkOut };
}

function requestAllowed(row: ReservationRow, now: Date): string | null {
  const status = (row.status || "").toLowerCase();
  if (status !== "confirmed") {
    return "This reservation can't be changed.";
  }
  const stay = stayDates(row);
  if (!stay) return "This reservation doesn't have dates we can change.";
  const today = civilDate(now, CANCELLATION_TIMEZONE);
  if (stay.checkOut < today) {
    return "This stay has already ended.";
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const { reservationId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getOwnedReservation(reservationId, user.email!, user.id);
  if (!row) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  const pool = getPool();
  const pending = await pool.query(
    `SELECT id, requested_check_in, requested_check_out, note, created_at
     FROM date_change_requests
     WHERE reservation_id = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [reservationId]
  );
  const found = pending.rows[0] as
    | {
        id: string;
        requested_check_in: string;
        requested_check_out: string;
        note: string | null;
        created_at: string;
      }
    | undefined;

  return NextResponse.json({
    request: found
      ? {
          id: found.id,
          requestedCheckIn: found.requested_check_in,
          requestedCheckOut: found.requested_check_out,
          note: found.note,
          createdAt: found.created_at,
        }
      : null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const { reservationId } = await params;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Refuse the old self-service actions before touching the reservation.
  // A quote used to write the new dates to Guesty; finalize used to charge
  // or refund. Neither may run, even if a stale client calls them directly.
  if (body.action !== "request") {
    return NextResponse.json(SELF_SERVICE_REFUSAL, { status: 409 });
  }

  const row = await getOwnedReservation(reservationId, user.email!, user.id);
  if (!row) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 }
    );
  }

  const now = new Date();
  const blocked = requestAllowed(row, now);
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 400 });
  }
  const stay = stayDates(row)!;

  const parsed = parseDateChangeRequest(body, stay.checkIn, stay.checkOut);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const today = civilDate(now, CANCELLATION_TIMEZONE);
  if (parsed.value.requestedCheckOut < today) {
    return NextResponse.json(
      { error: "Choose dates that haven't already ended." },
      { status: 400 }
    );
  }

  const pool = getPool();
  const client = await pool.connect();
  let requestId: string;
  try {
    await client.query("BEGIN");
    // Supersede first, then insert. A unique index allows one pending row
    // per reservation, and Postgres does not let an INSERT in the same
    // statement see that update, so these are two statements in one
    // transaction.
    await client.query(
      `UPDATE date_change_requests
          SET status = 'superseded'
        WHERE reservation_id = $1
          AND status = 'pending'`,
      [reservationId]
    );
    const inserted = await client.query(
      `INSERT INTO date_change_requests (
         reservation_id, confirmation_code, guest_email, guest_name,
         listing_id, listing_title, current_check_in, current_check_out,
         requested_check_in, requested_check_out, note, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING id`,
      [
        reservationId,
        row.confirmation_code,
        user.email,
        guestDisplayName(row.guest),
        row.listing_id,
        row.listing_title,
        stay.checkIn,
        stay.checkOut,
        parsed.value.requestedCheckIn,
        parsed.value.requestedCheckOut,
        parsed.value.note,
      ]
    );
    requestId = inserted.rows[0]?.id as string;
    if (!requestId) {
      throw new Error("Insert returned no id");
    }
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be aborted.
    }
    console.error("[DateChangeRequest] Failed to store request:", err);
    return NextResponse.json(
      { error: "We couldn't save that request. Please try again." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  const alert = buildDateChangeRequestAlert({
    requestId,
    reservationId,
    confirmationCode: row.confirmation_code,
    guestName: guestDisplayName(row.guest),
    guestEmail: user.email!,
    currentCheckIn: stay.checkIn,
    currentCheckOut: stay.checkOut,
    requestedCheckIn: parsed.value.requestedCheckIn,
    requestedCheckOut: parsed.value.requestedCheckOut,
    note: parsed.value.note,
  });

  await sendAlert(alert.subject, alert.html, alert.alertKey, {
    to: OPS_ALERT_INBOX,
  });

  return NextResponse.json({
    ok: true,
    requestId,
    status: "pending",
    requestedCheckIn: parsed.value.requestedCheckIn,
    requestedCheckOut: parsed.value.requestedCheckOut,
    note: parsed.value.note,
  });
}
