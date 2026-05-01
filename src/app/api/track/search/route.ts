import { NextRequest, NextResponse } from "next/server";
import { trackSearchServerSide } from "@/lib/server-tracking";
import { getEffectiveServerConsent } from "@/lib/consent";
import { buildServerEventContext } from "@/lib/track-request";

const ATTRIBUTION_COOKIE = "_sp_attribution";

export async function POST(request: NextRequest) {
  try {
    const {
      checkIn,
      checkOut,
      guests,
      city,
      resultCount,
      resultIds,
      url,
      eventId,
      guest: rawGuest,
      fbp: bodyFbp,
      fbc: bodyFbc,
      clientIp: bodyClientIp,
    } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
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

    trackSearchServerSide(
      {
        checkIn,
        checkOut,
        guests,
        city,
        resultCount: resultCount || 0,
        resultIds: resultIds || [],
        url: url || "",
        eventId,
        attribution,
        guest,
        context,
      },
      { consent }
    ).catch((err) => console.error("[Server Tracking] search error:", err));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
