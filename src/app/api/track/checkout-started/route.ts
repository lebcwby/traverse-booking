import { NextRequest, NextResponse } from "next/server";
import { trackCheckoutServerSide } from "@/lib/server-tracking";
import { getEffectiveServerConsent } from "@/lib/consent";
import { buildServerEventContext } from "@/lib/track-request";

const ATTRIBUTION_COOKIE = "_sp_attribution";

export async function POST(request: NextRequest) {
  try {
    const {
      listingId,
      listingTitle,
      checkIn,
      checkOut,
      guests,
      total,
      url,
      eventId,
      guest: rawGuest,
      fbp: bodyFbp,
      fbc: bodyFbc,
      clientIp: bodyClientIp,
    } = await request.json();

    if (!listingId || !eventId) {
      return NextResponse.json(
        { error: "listingId and eventId required" },
        { status: 400 }
      );
    }

    const guest =
      rawGuest &&
      typeof rawGuest === "object" &&
      Object.keys(rawGuest).length > 0
        ? rawGuest
        : undefined;

    let attribution: Record<string, string> | undefined;
    const cookie = request.cookies.get(ATTRIBUTION_COOKIE)?.value;
    if (cookie) {
      try {
        attribution = JSON.parse(cookie);
      } catch {
        /* ignore */
      }
    }

    const context = await buildServerEventContext(
      request,
      bodyFbp,
      bodyFbc,
      bodyClientIp
    );
    const consent = getEffectiveServerConsent({
      consentCookieValue: request.cookies.get("_sp_consent")?.value,
      legacyOptOutValue: request.cookies.get("_sp_ccpa_optout")?.value,
    });

    // Only Meta CAPI runs server-side; GA4 begin_checkout is client-side only
    trackCheckoutServerSide(
      {
        listingId,
        listingTitle: listingTitle || "",
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        guests: guests || 1,
        total: total || 0,
        url: url || "",
        eventId,
        attribution,
        guest,
        context,
      },
      { consent }
    ).catch((err) =>
      console.error("[Server Tracking] checkout-started error:", err)
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
