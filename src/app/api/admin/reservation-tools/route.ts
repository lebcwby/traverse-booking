/**
 * Admin diagnostic + repair endpoint for reservations.
 *
 * Built 2026-05-16 to investigate reservation GY-rNZRDKkN where:
 *   - Stripe payment succeeded
 *   - local Postgres row exists with payment_recorded_at populated
 *   - Guesty UI shows no manual payment
 *
 * Keep for ongoing ops use. Auth: Bearer ${CRON_SECRET}.
 *
 * USAGE:
 *   GET /api/admin/reservation-tools?id=<guesty_id>&action=diagnose
 *   GET /api/admin/reservation-tools?id=<guesty_id>&action=force-record-payment&amount=<usd>&pi=<stripe_pi>
 *   GET /api/admin/reservation-tools?id=<guesty_id>&action=update-guest&phone=<E164>
 *
 * Auth header: `Authorization: Bearer ${CRON_SECRET}`
 */

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getOpenAPIReservation, recordPayment } from "@/lib/guesty-openapi";
import {
  authorizeAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizeAdminRequest(request)))
    return unauthorizedAdminResponse();

  const url = new URL(request.url);
  const reservationId = url.searchParams.get("id");
  const action = url.searchParams.get("action") || "diagnose";

  if (!reservationId) {
    return NextResponse.json(
      { error: "Missing required ?id=<guesty_id-or-confirmation_code>" },
      { status: 400 }
    );
  }

  // ─── Always fetch both local DB row + Guesty's view ─────────────
  let localRow: Record<string, unknown> | null = null;
  let localError: string | null = null;
  try {
    const pool = getPool();
    const res = await pool.query(
      `SELECT guesty_id, confirmation_code, source, status, stripe_payment_intent_id,
              payment_recorded_at, last_synced_at, guest, money
         FROM reservations
        WHERE guesty_id = $1 OR confirmation_code = $1
        ORDER BY last_synced_at DESC
        LIMIT 1`,
      [reservationId]
    );
    localRow = res.rows[0] ?? null;
  } catch (err) {
    localError = err instanceof Error ? err.message : String(err);
  }

  // Prefer the resolved guesty_id from the DB for Guesty API calls
  const guestyId = (localRow?.guesty_id as string | undefined) ?? reservationId;

  let guestyReservation: Record<string, unknown> | null = null;
  let guestyError: string | null = null;
  try {
    guestyReservation = (await getOpenAPIReservation(guestyId)) as Record<
      string,
      unknown
    >;
  } catch (err) {
    guestyError = err instanceof Error ? err.message : String(err);
  }

  // ─── DIAGNOSE ───────────────────────────────────────────────────
  if (action === "diagnose") {
    return NextResponse.json({
      requestedId: reservationId,
      resolvedGuestyId: guestyId,
      localDb: localRow
        ? {
            guesty_id: localRow.guesty_id,
            confirmation_code: localRow.confirmation_code,
            source: localRow.source,
            status: localRow.status,
            stripe_payment_intent_id: localRow.stripe_payment_intent_id,
            payment_recorded_at: localRow.payment_recorded_at,
            last_synced_mt: localRow.last_synced_at
              ? new Date(Number(localRow.last_synced_at)).toLocaleString(
                  "en-US",
                  { timeZone: "America/Denver" }
                )
              : null,
            guest: localRow.guest,
            money: localRow.money,
          }
        : null,
      localError,
      // Return the FULL Guesty reservation so we can inspect invoice items,
      // fare breakdowns, fees, taxes, etc. — useful for the $3.71-style
      // amount-mismatch investigations.
      guestyOpenApi: guestyReservation
        ? {
            _id: guestyReservation._id,
            confirmationCode: guestyReservation.confirmationCode,
            status: guestyReservation.status,
            guest: guestyReservation.guest,
            money: guestyReservation.money,
          }
        : null,
      guestyError,
    });
  }

  // ─── FORCE RECORD PAYMENT ───────────────────────────────────────
  if (action === "force-record-payment") {
    const amount = parseFloat(url.searchParams.get("amount") || "");
    const pi =
      url.searchParams.get("pi") ||
      (localRow?.stripe_payment_intent_id as string | undefined) ||
      "";

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid ?amount=<usd-decimal>" },
        { status: 400 }
      );
    }
    if (!pi) {
      return NextResponse.json(
        { error: "No Stripe PI found (provide ?pi=pi_xxx)" },
        { status: 400 }
      );
    }

    try {
      const result = await recordPayment(guestyId, amount, pi, {
        retries: 1,
        timeoutMs: 10000,
      });
      return NextResponse.json({
        action,
        success: true,
        amount,
        paymentIntentId: pi,
        guestyResponse: result,
      });
    } catch (err) {
      return NextResponse.json(
        {
          action,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  // ─── UPDATE GUEST (phone) ───────────────────────────────────────
  if (action === "update-guest") {
    const phone = url.searchParams.get("phone");
    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Missing ?phone=<E.164>" },
        { status: 400 }
      );
    }

    const guest = guestyReservation?.guest as { _id?: string } | undefined;
    const guestId = guest?._id;
    if (!guestId) {
      return NextResponse.json(
        {
          error: "Couldn't find guest._id on the reservation",
          guestyReservationGuest: guest,
        },
        { status: 404 }
      );
    }

    // openapiFetch is private — call via fetch directly, leveraging the same
    // token machinery indirectly by reusing getOpenAPIReservation pattern.
    // Easier: just use a dedicated guest-update endpoint via openapiFetch.
    // Since openapiFetch isn't exported, we delegate to a focused helper.
    try {
      const updated = await updateGuestPhone(guestId, phone.trim());
      return NextResponse.json({
        action,
        success: true,
        guestId,
        phone,
        updated,
      });
    } catch (err) {
      return NextResponse.json(
        {
          action,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      error: `Unknown action: ${action}`,
      validActions: ["diagnose", "force-record-payment", "update-guest"],
    },
    { status: 400 }
  );
}

// ─── Local helper: PATCH guest phone via Guesty OpenAPI ───────────
// We can't import openapiFetch (it's private), so reach into the same
// token source the rest of the file uses.
async function updateGuestPhone(guestId: string, phoneE164: string) {
  const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("guesty_tokens")
    .select("access_token")
    .eq("token_type", "openapi")
    .single();
  if (error || !data?.access_token) {
    throw new Error("OpenAPI token lookup failed");
  }
  const res = await fetch(`https://open-api.guesty.com/v1/guests/${guestId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: phoneE164 }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Guesty guest update failed: ${res.status} ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}
