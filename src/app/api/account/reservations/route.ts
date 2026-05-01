import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";

export async function GET() {
  // 1. Get authenticated user
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    console.error(
      "[Portal] Auth failed:",
      authError?.message || "no email",
      user?.email
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Portal] Fetching reservations for:", user.email);

  try {
    // 2. Query directly via Postgres (bypasses broken PostgREST schema cache)
    const pool = getPool();
    const result = await pool.query(
      `SELECT
        r.guesty_id,
        r.confirmation_code,
        r.guest,
        r.listing_id,
        r.check_in,
        r.check_out,
        r.guests_count,
        r.status,
        r.money,
        r.key_code,
        r.canceled_at,
        r.refund_status,
        r.refund_amount,
        r.stripe_refund_id,
        l.title as listing_title,
        l.nickname as listing_nickname,
        l.picture as listing_picture
      FROM reservations r
      LEFT JOIN listings l ON l.guesty_id = r.listing_id
      WHERE lower(r.guest->>'email') = lower($1) OR r.user_id = $2
      ORDER BY r.check_in DESC`,
      [user.email, user.id]
    );

    // 3. Map to the shape the frontend expects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = result.rows.map((r: any) => ({
      id: r.guesty_id,
      reservation_id: r.guesty_id,
      confirmation_code: r.confirmation_code,
      guest_email: r.guest?.email || user.email,
      guest_name: r.guest?.fullName || null,
      listing_id: r.listing_id,
      listing_name:
        r.listing_title ||
        r.listing_nickname ||
        r.guest?.listing?.title ||
        null,
      listing_photo: r.listing_picture
        ? r.listing_picture.replace(
            "/t_default_thumb/",
            "/c_fill,w_800,h_600,f_auto,q_auto/"
          )
        : null,
      check_in: r.check_in,
      check_out: r.check_out,
      guests_count: r.guests_count,
      status: r.status,
      money: r.money
        ? (() => {
            const total = r.money.totalPaid || r.money.total_paid || 0;
            const cleaning = r.money.fareCleaning || r.money.fare_cleaning || 0;
            const taxes = r.money.totalTaxes || r.money.total_taxes || 0;
            // subTotalPrice is the guest-facing accommodation amount.
            // If unavailable, derive from total so line items reconcile.
            const subtotal =
              r.money.subTotalPrice ||
              r.money.sub_total_price ||
              Math.max(total - cleaning - taxes, 0);
            return {
              total,
              subtotal,
              cleaning,
              taxes,
              currency: r.money.currency || "USD",
              invoiceItems: (
                r.money.invoiceItems ||
                r.money.invoice_items ||
                []
              )
                .filter(
                  (item: {
                    amount?: number;
                    title?: string;
                    tags?: string[];
                  }) =>
                    item.amount &&
                    item.amount > 0 &&
                    !item.tags?.includes("part-of-af")
                )
                .map(
                  (item: {
                    title?: string;
                    amount?: number;
                    type?: string;
                    isTax?: boolean;
                  }) => ({
                    title: item.title,
                    amount: item.amount,
                    type: item.type,
                    isTax: item.isTax || false,
                  })
                ),
              payments: (r.money.payments || []).map(
                (p: {
                  amount?: number;
                  status?: string;
                  paidAt?: string;
                  currency?: string;
                }) => ({
                  amount: p.amount,
                  status: p.status,
                  paidAt: p.paidAt,
                  currency: p.currency,
                })
              ),
            };
          })()
        : null,
      date_changes: r.money?.dateChanges || null,
      key_code: r.key_code,
      canceled_at: r.canceled_at ? new Date(r.canceled_at).toISOString() : null,
      refund_status: r.refund_status || null,
      refund_amount:
        r.refund_amount !== null && r.refund_amount !== undefined
          ? Number(r.refund_amount)
          : null,
      stripe_refund_id: r.stripe_refund_id || null,
    }));

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("[Portal] Failed to fetch reservations:", err);
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}
