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
import type Stripe from "stripe";
import { getPool } from "@/lib/db";
import { getStripeServer } from "@/lib/stripe";
import {
  getOpenAPIReservation,
  getOpenAPIListing,
  recordPayment,
} from "@/lib/guesty-openapi";
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

  // ─── ORPHAN AUDIT (read-only, no id) — find paid-but-no-reservation ──
  // Scans succeeded LIVE PaymentIntents in a window and flags any with NO
  // confirmationCode AND no matching reservations row (i.e. the guest paid but
  // a reservation was never created — like GY-CvXxRDxw / Kyle Toth). Surfaces
  // the most urgent first (soonest/past check-in, unrefunded).
  if (action === "orphan-audit") {
    const stripe = getStripeServer();
    const sinceDays = Math.min(
      365,
      Math.max(1, parseInt(url.searchParams.get("sinceDays") || "90", 10) || 90)
    );
    const nowSec = Math.floor(Date.now() / 1000);
    const createdGte = nowSec - sinceDays * 86400;
    // Ignore very recent PIs — a just-succeeded payment may still be
    // mid-finalize (confirmationCode/reservation row not written yet).
    const tooRecent = nowSec - 600;

    type Candidate = {
      id: string;
      amount: number;
      created: number;
      guestEmail: string | null;
      listingId: string | null;
      checkIn: string | null;
      checkOut: string | null;
      refunded: boolean;
    };
    const candidates: Candidate[] = [];
    let scanned = 0;
    for await (const pi of stripe.paymentIntents.list({
      created: { gte: createdGte },
      limit: 100,
      expand: ["data.latest_charge"],
    })) {
      if (++scanned > 3000) break; // hard backstop
      if (pi.status !== "succeeded") continue;
      if (pi.created > tooRecent) continue;
      if (pi.metadata?.confirmationCode) continue;
      const charge = pi.latest_charge;
      const refunded =
        charge && typeof charge !== "string"
          ? charge.refunded ||
            (charge.amount_refunded ?? 0) >= (charge.amount ?? 0)
          : false;
      candidates.push({
        id: pi.id,
        amount: (pi.amount ?? 0) / 100,
        created: pi.created,
        guestEmail: pi.metadata?.guestEmail ?? null,
        listingId: pi.metadata?.listingId ?? null,
        checkIn: pi.metadata?.checkIn ?? null,
        checkOut: pi.metadata?.checkOut ?? null,
        refunded,
      });
    }

    // Keep only those with NO reservation row (true orphans).
    let orphans = candidates;
    if (candidates.length > 0) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT stripe_payment_intent_id FROM reservations
            WHERE stripe_payment_intent_id = ANY($1)`,
          [candidates.map((c) => c.id)]
        );
        const haveRes = new Set(
          res.rows.map((r) => r.stripe_payment_intent_id as string)
        );
        orphans = candidates.filter((c) => !haveRes.has(c.id));
      } catch (err) {
        return NextResponse.json(
          {
            action,
            error: `reservations cross-check failed: ${err instanceof Error ? err.message : String(err)}`,
            candidateCount: candidates.length,
          },
          { status: 500 }
        );
      }
    }

    const todayMs = Date.now();
    const enriched = orphans
      .map((o) => ({
        ...o,
        created_mt: new Date(o.created * 1000).toLocaleString("en-US", {
          timeZone: "America/Denver",
        }),
        daysUntilCheckIn: o.checkIn
          ? Math.round(
              (new Date(`${o.checkIn}T12:00:00`).getTime() - todayMs) /
                86_400_000
            )
          : null,
      }))
      .sort((a, b) => {
        if (a.refunded !== b.refunded) return a.refunded ? 1 : -1;
        return (a.daysUntilCheckIn ?? 99999) - (b.daysUntilCheckIn ?? 99999);
      });

    return NextResponse.json({
      action,
      sinceDays,
      scannedPaymentIntents: scanned,
      orphanCount: enriched.length,
      unrefundedOrphanCount: enriched.filter((o) => !o.refunded).length,
      orphans: enriched,
    });
  }

  // ─── WALLET MIX (read-only, no id) — Apple/Google Pay share ─────
  // Scans succeeded BOOKING PaymentIntents and tallies how guests paid
  // (plain card vs apple_pay / google_pay / link). Informs the Guesty Pay
  // go/no-go: GuestyPay tokenization is card-only, so this is what we'd lose.
  if (action === "wallet-mix") {
    const stripe = getStripeServer();
    const sinceDays = Math.min(
      365,
      Math.max(1, parseInt(url.searchParams.get("sinceDays") || "120", 10) || 120)
    );
    const createdGte = Math.floor(Date.now() / 1000) - sinceDays * 86400;
    const tally: Record<string, { count: number; amount: number }> = {};
    let scanned = 0;
    let bookings = 0;
    for await (const pi of stripe.paymentIntents.list({
      created: { gte: createdGte },
      limit: 100,
      expand: ["data.latest_charge"],
    })) {
      if (++scanned > 3000) break;
      if (pi.status !== "succeeded") continue;
      // Booking payments only (have stay metadata) — excludes deposits/add-ons.
      if (
        !pi.metadata?.listingId ||
        !pi.metadata?.checkIn ||
        !pi.metadata?.checkOut
      )
        continue;
      bookings++;
      let type = "card";
      const ch = pi.latest_charge;
      if (ch && typeof ch !== "string") {
        const wallet = ch.payment_method_details?.card?.wallet?.type;
        const pmType = ch.payment_method_details?.type;
        if (wallet) type = wallet; // apple_pay | google_pay | samsung_pay | ...
        else if (pmType && pmType !== "card") type = pmType; // link, etc.
      }
      const t = tally[type] || { count: 0, amount: 0 };
      t.count++;
      t.amount += (pi.amount ?? 0) / 100;
      tally[type] = t;
    }

    const byType = Object.entries(tally)
      .map(([type, v]) => ({
        type,
        count: v.count,
        pctOfBookings: bookings
          ? Math.round((v.count / bookings) * 1000) / 10
          : 0,
        amount: Math.round(v.amount * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);
    const walletTypes = new Set([
      "apple_pay",
      "google_pay",
      "samsung_pay",
      "link",
    ]);
    const walletCount = byType
      .filter((r) => walletTypes.has(r.type))
      .reduce((s, r) => s + r.count, 0);
    const applePay =
      byType.find((r) => r.type === "apple_pay")?.count ?? 0;
    const googlePay =
      byType.find((r) => r.type === "google_pay")?.count ?? 0;

    return NextResponse.json({
      action,
      sinceDays,
      scannedPaymentIntents: scanned,
      bookingPayments: bookings,
      applePayGooglePayCount: applePay + googlePay,
      applePayGooglePaySharePct: bookings
        ? Math.round(((applePay + googlePay) / bookings) * 1000) / 10
        : 0,
      anyOneClickSharePct: bookings
        ? Math.round((walletCount / bookings) * 1000) / 10
        : 0,
      byType,
    });
  }

  // ─── LISTING CHANNELS (read-only) — find OTA deep-link URLs ──────
  // Dumps the OpenAPI listing's channel/integration data so we can see the
  // exact field that holds the Airbnb/VRBO/Booking.com listing URLs (for the
  // "verify on the OTA" deep-links feature).
  if (action === "listing-channels") {
    const listingId = url.searchParams.get("listingId");
    if (!listingId) {
      return NextResponse.json(
        { error: "?listingId=<guesty_listing_id> required" },
        { status: 400 }
      );
    }
    try {
      const listing = (await getOpenAPIListing(listingId)) as Record<
        string,
        unknown
      >;
      const hits: Record<string, unknown> = {};
      const KEYS = [
        "airbnb",
        "vrbo",
        "homeaway",
        "booking",
        "channel",
        "integration",
        "url",
        "platform",
        "listingid",
        "externalid",
        "published",
        "expedia",
      ];
      const walk = (o: unknown, path: string, depth: number) => {
        if (depth > 6 || o === null || typeof o !== "object") return;
        if (Array.isArray(o)) {
          o.slice(0, 10).forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
          return;
        }
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          const kl = k.toLowerCase();
          if (
            KEYS.some((s) => kl.includes(s)) &&
            (typeof v !== "object" || v === null)
          ) {
            hits[`${path}.${k}`] = v;
          }
          walk(v, `${path}.${k}`, depth + 1);
        }
      };
      walk(listing, "listing", 0);
      return NextResponse.json({
        action,
        listingId,
        integrations: listing.integrations ?? null,
        channelFieldHits: hits,
        topLevelKeys: Object.keys(listing),
      });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 502 }
      );
    }
  }

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

  // ─── STRIPE CHARGES (read-only) — double-charge investigation ────
  // Lists every PaymentIntent + Charge for the reservation's Stripe customer
  // so we can spot a SECOND charge that never produced a 2nd reservation row
  // (the orphan-PI double-charge case). Read-only; creates/modifies nothing.
  if (action === "stripe-charges") {
    const stripe = getStripeServer();
    const piId =
      url.searchParams.get("pi") ||
      (localRow?.stripe_payment_intent_id as string | undefined) ||
      "";
    if (!piId) {
      return NextResponse.json(
        { error: "No Stripe PI on the reservation (provide ?pi=pi_xxx)" },
        { status: 400 }
      );
    }
    try {
      const basePi = await stripe.paymentIntents.retrieve(piId, {
        expand: ["customer"],
      });
      const customerId =
        typeof basePi.customer === "string"
          ? basePi.customer
          : (basePi.customer?.id ?? null);

      const summarizePi = (pi: Stripe.PaymentIntent) => ({
        id: pi.id,
        livemode: pi.livemode,
        status: pi.status,
        amount: (pi.amount ?? 0) / 100,
        amountReceived: (pi.amount_received ?? 0) / 100,
        currency: pi.currency,
        created_mt: new Date(pi.created * 1000).toLocaleString("en-US", {
          timeZone: "America/Denver",
        }),
        quoteId: pi.metadata?.quoteId ?? null,
        checkIn: pi.metadata?.checkIn ?? null,
        checkOut: pi.metadata?.checkOut ?? null,
        listingId: pi.metadata?.listingId ?? null,
        confirmationCode: pi.metadata?.confirmationCode ?? null,
      });

      const recorded = summarizePi(basePi);
      let customerPis: ReturnType<typeof summarizePi>[] = [];
      let customerCharges: Record<string, unknown>[] = [];
      if (customerId) {
        const piList = await stripe.paymentIntents.list({
          customer: customerId,
          limit: 50,
        });
        customerPis = piList.data.map(summarizePi);
        const chList = await stripe.charges.list({
          customer: customerId,
          limit: 50,
        });
        customerCharges = chList.data.map((c) => ({
          id: c.id,
          paymentIntent:
            typeof c.payment_intent === "string"
              ? c.payment_intent
              : (c.payment_intent?.id ?? null),
          amount: (c.amount ?? 0) / 100,
          amountRefunded: (c.amount_refunded ?? 0) / 100,
          status: c.status,
          paid: c.paid,
          refunded: c.refunded,
          created_mt: new Date(c.created * 1000).toLocaleString("en-US", {
            timeZone: "America/Denver",
          }),
          paymentMethod: c.payment_method_details?.type ?? null,
          receiptUrl: c.receipt_url,
        }));
      }

      // A real double-charge = >1 SUCCEEDED PI for the same stay (checkIn+out).
      const succeededForStay = customerPis.filter(
        (p) =>
          p.status === "succeeded" &&
          p.checkIn === recorded.checkIn &&
          p.checkOut === recorded.checkOut
      );

      return NextResponse.json({
        action,
        livemode: basePi.livemode,
        recordedPaymentIntent: piId,
        customerId,
        recorded,
        possibleDoubleCharge: succeededForStay.length > 1,
        succeededPaymentIntentsForStay: succeededForStay,
        allCustomerPaymentIntents: customerPis,
        allCustomerCharges: customerCharges,
      });
    } catch (err) {
      return NextResponse.json(
        { action, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
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
      validActions: [
        "diagnose",
        "stripe-charges",
        "orphan-audit",
        "wallet-mix",
        "listing-channels",
        "force-record-payment",
        "update-guest",
      ],
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
