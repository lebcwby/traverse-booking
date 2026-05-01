import {
  getSupabaseClient,
  guestyFetch,
  transformReservation,
  jsonResponse,
  GUESTY_API_BASE,
  PAGE_DELAY_MS,
} from "../_shared/guesty-api.ts";

const PAGE_SIZE = 100;

// ─── NEW BOOKING ALERT (Resend) ─────────────────────────────────
// Sends an email when the sync detects a new website booking that
// did NOT go through the booktraverse.com checkout (i.e. came via
// Guesty's booking engine widget). Checkout-flow bookings already
// write to the reservations table with stripe_payment_intent_id,
// so they appear in existingMap and are skipped here.

const ALERT_RECIPIENTS = [
  "hayden.laverty@gmail.com",
  "wyatt@mossdigitalstrategies.com",
];

async function sendNewBookingAlert(row: Record<string, unknown>) {
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
    host_payout?: number;
    fare_accommodation?: number;
    fare_cleaning?: number;
    total_taxes?: number;
    balance_due?: number;
  } | null;

  const displayName = listing?.nickname || listing?.title || "Unknown Property";
  const guestName = guest?.fullName || "Unknown Guest";
  const guestyUrl = `https://app.guesty.com/reservations/${encodeURIComponent(row.guesty_id as string)}/summary`;

  const checkInLocal =
    (row.check_in_date_localized as string) ||
    ((row.check_in as string) || "").slice(0, 10);
  const checkOutLocal =
    (row.check_out_date_localized as string) ||
    ((row.check_out as string) || "").slice(0, 10);
  const nights = row.nights_count || "—";
  const payout =
    money?.host_payout != null ? `$${money.host_payout.toFixed(2)}` : "—";
  const balanceDue =
    money?.balance_due != null ? `$${money.balance_due.toFixed(2)}` : "—";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #404f52; color: #fff; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">New Direct Booking (Sync)</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">
          Booked outside booktraverse.com checkout — verify payment
        </p>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #666;">Property</td><td style="padding: 6px 0; font-weight: 600;">${displayName}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Guest</td><td style="padding: 6px 0;">${guestName}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;">${guest?.email || "—"}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${guest?.phone || "—"}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Dates</td><td style="padding: 6px 0;">${checkInLocal} → ${checkOutLocal} (${nights} nights)</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Host Payout</td><td style="padding: 6px 0; font-weight: 600;">${payout}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Balance Due</td><td style="padding: 6px 0; font-weight: 600; color: ${money?.balance_due && money.balance_due > 0 ? "#c0392b" : "#27ae60"};">${balanceDue}</td></tr>
        </table>
        <div style="margin-top: 16px;">
          <a href="${guestyUrl}" style="display: inline-block; background: #404f52; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            View in Guesty
          </a>
        </div>
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
        `[BookingAlert] Sent alert for ${row.confirmation_code} — ${guestName} at ${displayName}`
      );
    }
  } catch (err) {
    console.error("[BookingAlert] Failed to send:", err);
  }
}

// Request all fields we need — Guesty list endpoint returns minimal data by default
const FIELDS = [
  "status",
  "source",
  "secondarySource",
  "money",
  "guestsCount",
  "nightsCount",
  "guest",
  "confirmationCode",
  "listing",
  "listingId",
  "guestId",
  "checkIn",
  "checkOut",
  "checkInDateLocalized",
  "checkOutDateLocalized",
  "keyCode",
  "isReturningGuest",
  "notes",
  "specialRequests",
  "plannedArrival",
  "plannedDeparture",
  "numberOfGuests",
  "integration",
  "review",
  "confirmedAt",
  "createdAt",
  "updatedAt",
].join(" ");

// ─── GA4 REFUND (Measurement Protocol) ──────────────────────────
// Fires a GA4 refund event to offset a purchase when a booking is
// canceled outside the self-service flow (e.g., canceled in Guesty admin).

async function sendGA4Refund(
  reservationId: string,
  amount: number,
  listingId?: string | null,
  listingTitle?: string | null
) {
  const measurementId = Deno.env.get("GA4_MEASUREMENT_ID") || "G-PPWFFFPC42";
  const apiSecret =
    Deno.env.get("GA4_MP_API_SECRET") || "wWj4drLDRbSDNtCnKlU5DA";
  if (!apiSecret || amount <= 0) return;

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: `server.sync.${Date.now()}`,
          events: [
            {
              name: "refund",
              params: {
                transaction_id: reservationId,
                value: amount,
                currency: "USD",
                ...(listingId
                  ? {
                      items: [
                        {
                          item_id: listingId,
                          item_name: listingTitle || listingId,
                          price: amount,
                          quantity: 1,
                        },
                      ],
                    }
                  : {}),
              },
            },
          ],
        }),
      }
    );
    if (!res.ok && res.status !== 204) {
      console.error(`[GA4 Refund] Failed for ${reservationId}: ${res.status}`);
    } else {
      console.log(`[GA4 Refund] Sent refund for ${reservationId}: $${amount}`);
    }
  } catch (err) {
    console.error(`[GA4 Refund] Error for ${reservationId}:`, err);
  }
}

/**
 * Syncs only website (booking engine) reservations from Guesty into the
 * reservations table. The dataset is small (~400 total), so we always
 * do a full paginated fetch filtered by source.
 *
 * Also detects cancellations (confirmed → canceled) and fires GA4 refund
 * events to offset the original purchase event in conversion reports.
 *
 * Runs every 5 minutes via pg_cron.
 */
Deno.serve(async (_req: Request) => {
  try {
    const supabase = getSupabaseClient();
    const runStartedAt = Date.now();

    console.log("Starting website reservations sync");

    // Source filter — include both "website" (Guesty OpenAPI label) and "manual"
    // which may include booking engine reservations depending on Guesty version.
    // Guesty BEAPI-created reservations appear as source=website in OpenAPI.
    const sourceFilter = JSON.stringify([
      { field: "source", operator: "$in", value: ["website", "BE-API"] },
    ]);

    let skip = 0;
    let totalSynced = 0;
    let totalRefundsFired = 0;
    let totalAlertsSent = 0;
    let hasMore = true;
    const startTime = Date.now();

    while (hasMore) {
      // Safety: stop before Edge Function timeout (150s limit)
      if (Date.now() - startTime > 130_000) {
        console.log("Approaching timeout — stopping batch");
        break;
      }

      const path =
        `/reservations?limit=${PAGE_SIZE}&skip=${skip}&sort=_id` +
        `&fields=${encodeURIComponent(FIELDS)}` +
        `&filters=${encodeURIComponent(sourceFilter)}`;

      console.log(`Fetching website reservations: skip=${skip}`);

      // guestyFetch handles token caching + auto-retry on 401/403
      const response = await guestyFetch(supabase, path);

      if (response.status === 429) {
        console.log("Rate limited (429) — stopping batch.");
        break;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch reservations: ${response.status} ${await response.text()}`
        );
      }

      const data = await response.json();
      const reservations = data.results || [];

      if (reservations.length > 0) {
        const EXCLUDED_EMAILS = [
          "trevor.stout164@gmail.com",
          "test@booktraverse.com",
          "testing1@booktraverse.com",
          "testing2@booktraverse.com",
          "trevor@164investments.com",
          "bolton.osaz@gmail.com",
        ];
        const filtered = reservations.filter(
          (res: any) =>
            !EXCLUDED_EMAILS.includes(res.guest?.email?.toLowerCase())
        );
        if (filtered.length < reservations.length) {
          console.log(
            `Filtered out ${reservations.length - filtered.length} test reservations`
          );
        }
        const rows = filtered.map((res: any) => transformReservation(res));
        const guestyIds = rows.map((r: any) => r.guesty_id);

        // Check existing records for status transitions before upserting
        const { data: existingRecords } = await supabase
          .from("reservations")
          .select("guesty_id, status, stripe_payment_intent_id, money")
          .in("guesty_id", guestyIds);

        // Build map of existing DB records for transition detection
        const existingMap = new Map(
          (existingRecords || []).map((r: any) => [r.guesty_id, r])
        );

        // Detect confirmed → canceled transitions on paid bookings
        for (const row of rows) {
          const existing = existingMap.get(row.guesty_id as string);
          if (
            existing &&
            existing.status !== "canceled" &&
            row.status === "canceled" &&
            existing.stripe_payment_intent_id
          ) {
            const refundAmount =
              existing.money?.total_paid || existing.money?.host_payout || 0;

            if (refundAmount > 0) {
              const listing = row.listing as { title?: string } | null;
              await sendGA4Refund(
                row.guesty_id as string,
                refundAmount,
                row.listing_id as string | null,
                listing?.title || null
              );
              totalRefundsFired++;
            }
          }
        }

        // Upsert BEFORE alerting — ensures the row is persisted so the next
        // sync run won't re-send the same alert if the function exits early.
        const { error: upsertError } = await supabase
          .from("reservations")
          .upsert(rows, { onConflict: "guesty_id" });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        // Alert on new confirmed bookings that bypassed the checkout flow.
        // Guards against false positives:
        //   1. Only rows absent from existingMap (truly new to DB)
        //   2. createdAt within 15 min — prevents floods on backfill/empty table
        //   3. Re-check DB for stripe_payment_intent_id — checkout-flow
        //      bookings set this field, and upsert preserves it
        const newConfirmedIds = rows
          .filter((row: Record<string, unknown>) => {
            if (existingMap.has(row.guesty_id as string)) return false;
            if (row.status !== "confirmed") return false;
            const createdAt = row.guesty_created_at as string | undefined;
            if (!createdAt) return false;
            const ageMs = Date.now() - new Date(createdAt).getTime();
            return ageMs < 15 * 60 * 1000; // created in last 15 minutes
          })
          .map((row: Record<string, unknown>) => row.guesty_id as string);

        if (newConfirmedIds.length > 0) {
          // Re-read from DB to check if checkout-finalizer already set
          // stripe_payment_intent_id (survives upsert since we don't overwrite it)
          const { data: persisted } = await supabase
            .from("reservations")
            .select("guesty_id, stripe_payment_intent_id")
            .in("guesty_id", newConfirmedIds);

          const checkoutFlowIds = new Set(
            (persisted || [])
              .filter((r: any) => r.stripe_payment_intent_id)
              .map((r: any) => r.guesty_id)
          );

          for (const row of rows) {
            if (
              newConfirmedIds.includes(row.guesty_id as string) &&
              !checkoutFlowIds.has(row.guesty_id as string)
            ) {
              await sendNewBookingAlert(row);
              totalAlertsSent++;
            }
          }
        }

        totalSynced += reservations.length;
      }

      hasMore = reservations.length === PAGE_SIZE;
      skip += PAGE_SIZE;

      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
      }
    }

    const isComplete = !hasMore;

    console.log(
      `Website reservations sync done: ${totalSynced} synced, ${totalRefundsFired} refunds fired, ${totalAlertsSent} alerts sent, complete=${isComplete}`
    );

    // Update sync metadata
    await supabase.from("sync_metadata").upsert(
      {
        sync_type: "website_reservations",
        last_sync_at: runStartedAt,
        last_sync_status: isComplete ? "success" : "partial",
        items_synced: totalSynced,
        error_message: null,
        initial_sync_complete: true,
      },
      { onConflict: "sync_type" }
    );

    return jsonResponse({
      success: true,
      itemsSynced: totalSynced,
      refundsFired: totalRefundsFired,
      alertsSent: totalAlertsSent,
      isComplete,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-website-reservations failed:", message);

    try {
      const supabase = getSupabaseClient();
      await supabase.from("sync_metadata").upsert(
        {
          sync_type: "website_reservations",
          last_sync_at: Date.now(),
          last_sync_status: "error",
          items_synced: 0,
          error_message: message,
        },
        { onConflict: "sync_type" }
      );
    } catch {
      // Best-effort
    }

    return jsonResponse({ success: false, error: message }, 500);
  }
});
