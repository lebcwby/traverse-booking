/**
 * Admin endpoint to validate the GA4 Measurement Protocol setup.
 *
 * Built 2026-05-24 to diagnose why server-side purchase events from BE-API
 * bookings (e.g. GY-zBMnaYA8, GY-dmwm6uVF) aren't landing in GA4 under
 * the canonical property G-8NK72KVMJJ.
 *
 * The production endpoint (mp/collect) ALWAYS returns 204 even for invalid
 * measurement_id + api_secret pairs. So we hit the debug-mode endpoint
 * (debug/mp/collect) which returns validation errors. Tells us in one
 * round-trip whether the secret in Vercel pairs with the measurement ID
 * we're sending events under.
 *
 * USAGE (browser, signed in as admin):
 *   /api/admin/inspect-ga4
 *     dry-run validation only.
 *   /api/admin/inspect-ga4?fire=true
 *     ALSO sends a real test purchase event to the production endpoint
 *     so we can confirm it shows up in GA4 Realtime DebugView.
 *
 * Auth: same admin allowlist as inspect-quote.
 */

import { NextResponse } from "next/server";
import {
  authorizeAdminRequest,
  unauthorizedAdminResponse,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizeAdminRequest(request))) {
    return unauthorizedAdminResponse();
  }

  const url = new URL(request.url);
  const fire = url.searchParams.get("fire") === "true";

  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";
  const apiSecret = (process.env.GA4_MP_API_SECRET || "").trim();

  if (!measurementId || !apiSecret) {
    return NextResponse.json(
      {
        error: "Missing env vars",
        measurementId: measurementId || "(empty)",
        apiSecretSet: !!apiSecret,
      },
      { status: 400 }
    );
  }

  // Build a representative purchase payload mirroring what
  // trackBookingServerSide actually sends, so a validation pass here means
  // production events of the same shape would also pass.
  // A unique id per run, so a live fire can be found and excluded in GA4
  // rather than being indistinguishable from the last one.
  const testTransactionId = `TEST-GA4-INSPECT-${Date.now()}`;
  const samplePayload = {
    client_id: "ga4-inspect.test.1",
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: testTransactionId,
          // ⚠️ Zero, not 100. A live fire posts REAL revenue to the property.
          // This endpoint existed to diagnose attribution and was quietly
          // adding $100 of phantom revenue — attributed to "(not set)",
          // because client_id is synthetic and carries no session. It was
          // polluting the exact metric it is used to investigate.
          value: 0,
          currency: "USD",
          engagement_time_msec: 1,
          // Mirror the real shape so a validation pass here means a
          // production purchase of the same shape also passes. Added
          // 2026-10-19 with session_id + booking_channel.
          session_id: "1700000000",
          booking_channel: "web_direct",
          items: [
            {
              item_id: "test-listing",
              item_name: "GA4 inspect test listing",
              item_variant: "INSPECT",
              price: 100,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };

  // 1) Validate via debug endpoint — surfaces silent id/secret mismatch.
  let validation: unknown = null;
  let validationStatus = 0;
  try {
    const res = await fetch(
      `https://www.google-analytics.com/debug/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplePayload),
      }
    );
    validationStatus = res.status;
    validation = await res.json();
  } catch (err) {
    validation = { error: err instanceof Error ? err.message : String(err) };
  }

  // 2) Optionally fire a real event so the user can confirm it lands in
  //    Realtime view. Helpful when validation passes but we still want
  //    end-to-end proof.
  let liveFireStatus: number | string = "not-fired";
  if (fire) {
    try {
      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(samplePayload),
        }
      );
      liveFireStatus = res.status;
      console.warn(
        `[inspect-ga4] LIVE purchase fired to ${measurementId} as ` +
          `${testTransactionId} (value 0). It will appear in reports.`
      );
    } catch (err) {
      liveFireStatus = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    measurementId,
    testTransactionId,
    liveFireWarning:
      "?fire=1 posts a REAL purchase event to the live property. Value is 0 so it cannot inflate revenue, but it still counts as a purchase event and lands under (not set). Exclude it by transaction_id.",
    // Don't echo the secret — only its first/last 2 chars + length so we can
    // visually compare against the one stored in GA4 Admin without exposure.
    apiSecretFingerprint:
      apiSecret.length > 4
        ? `${apiSecret.slice(0, 2)}…${apiSecret.slice(-2)} (len=${apiSecret.length})`
        : `(short, len=${apiSecret.length})`,
    validation: {
      status: validationStatus,
      response: validation,
    },
    liveFireStatus,
    nextSteps: [
      "If validation.response.validationMessages contains anything, the payload shape is wrong.",
      "If validation.response.validationMessages is empty AND status is 200, the id/secret pair is valid.",
      "If liveFireStatus is 204, the event was accepted by GA4. Check GA4 → Reports → Realtime for `TEST-GA4-INSPECT` purchase to confirm it landed in the right property.",
    ],
  });
}
