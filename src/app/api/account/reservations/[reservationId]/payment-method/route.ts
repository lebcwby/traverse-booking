import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { lookupReservationPaymentMethod } from "@/lib/payment-method-lookup";

/**
 * GET /api/account/reservations/[id]/payment-method
 *
 * Returns the card brand, last 4, paid-on date, and Stripe-hosted
 * receipt URL for a reservation the caller owns. Separated from the
 * main /api/account/reservations endpoint so the list view stays fast
 * (no Stripe roundtrip per reservation) and only the detail page
 * incurs the extra API call when you actually look at one trip.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  const { reservationId } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         guesty_id,
         user_id,
         guest,
         money,
         stripe_payment_intent_id
       FROM reservations
       WHERE guesty_id = $1
       LIMIT 1`,
      [reservationId]
    );

    const row = result.rows[0] as
      | {
          guesty_id: string;
          user_id: string | null;
          guest: { email?: string | null } | null;
          money: Record<string, unknown> | null;
          stripe_payment_intent_id: string | null;
        }
      | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Ownership check: match by user_id OR by the guest email on the row.
    const ownsByUserId = row.user_id === user.id;
    const ownsByEmail =
      row.guest?.email &&
      row.guest.email.toLowerCase() === user.email.toLowerCase();
    if (!ownsByUserId && !ownsByEmail) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    const payment = await lookupReservationPaymentMethod({
      stripePaymentIntentId: row.stripe_payment_intent_id,
      money: row.money,
    });

    return NextResponse.json({ payment });
  } catch (err) {
    console.error("[account/reservations payment-method] error:", err);
    return NextResponse.json(
      { error: "Failed to load payment method" },
      { status: 500 }
    );
  }
}
