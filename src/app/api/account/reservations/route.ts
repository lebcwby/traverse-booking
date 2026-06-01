import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-auth-server";
import { getPool } from "@/lib/db";
import { getListingDetail, getReservation } from "@/lib/guesty-beapi";

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
        r.listing_title,
        r.listing_photo,
        r.check_in,
        r.check_out,
        r.guests_count,
        r.status,
        r.money,
        r.key_code,
        r.canceled_at,
        r.refund_status,
        r.refund_amount,
        r.stripe_refund_id
      FROM reservations r
      WHERE lower(r.guest->>'email') = lower($1) OR r.user_id = $2
      ORDER BY r.check_in DESC`,
      [user.email, user.id]
    );

    const rows = result.rows;

    // 3. Backfill listing title/photo and sync status from Guesty BEAPI
    //    - Rows missing listing_title: fetch listing details from BEAPI
    //    - Rows with status='confirmed': check Guesty for cancellation
    const needsSync = rows.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => !r.listing_title || r.status?.toLowerCase() === "confirmed"
    );

    if (needsSync.length > 0) {
      // Fan-out: fetch listing + reservation data in parallel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.allSettled(needsSync.map(async (r: any) => {
        try {
          // Always try to get listing info if missing
          let freshTitle: string | null = r.listing_title || null;
          let freshPhoto: string | null = r.listing_photo || null;

          if (!freshTitle && r.listing_id) {
            const listing = await getListingDetail(r.listing_id);
            freshTitle = listing?.nickname || listing?.title || null;
            freshPhoto = listing?.picture || listing?.pictures?.[0] || null;
          }

          // Check Guesty for current status if "confirmed"
          let freshStatus: string | null = r.status;
          if (r.status?.toLowerCase() === "confirmed" && r.guesty_id) {
            const reservation = await getReservation(r.guesty_id);
            if (reservation?.status) {
              freshStatus = String(reservation.status);
            }
          }

          const statusChanged = freshStatus !== r.status;
          const titleBackfilled = !r.listing_title && freshTitle;

          // Update in-memory row so we return fresh data immediately
          r.listing_title = freshTitle;
          r.listing_photo = freshPhoto;
          r.status = freshStatus;

          // Persist to DB so next load is fast (only when something actually changed)
          if (statusChanged || titleBackfilled) {
            await pool.query(
              `UPDATE reservations
               SET listing_title = COALESCE($1, listing_title),
                   listing_photo = COALESCE($2, listing_photo),
                   status = $3,
                   last_synced_at = $4
               WHERE guesty_id = $5`,
              [freshTitle, freshPhoto, freshStatus, Date.now(), r.guesty_id]
            );
          }
        } catch (syncErr) {
          console.warn(
            `[Portal] BEAPI sync failed for ${r.guesty_id}:`,
            syncErr instanceof Error ? syncErr.message : syncErr
          );
          // Non-fatal: we still return the DB row as-is
        }
      }));
    }

    // 4. Map to the shape the frontend expects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = rows.map((r: any) => ({
      id: r.guesty_id,
      reservation_id: r.guesty_id,
      confirmation_code: r.confirmation_code,
      guest_email: r.guest?.email || user.email,
      guest_name: r.guest?.fullName || null,
      listing_id: r.listing_id,
      listing_name: r.listing_title || null,
      listing_photo: r.listing_photo
        ? r.listing_photo.replace(
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
