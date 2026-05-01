import { NextRequest, NextResponse } from "next/server";
import {
  subscribeToKlaviyoList,
  sendKlaviyoEvent,
} from "@/lib/server-tracking";
import { persistVisitorAttribution } from "@/lib/visitor-attribution";

const VALID_EVENTS = [
  "Requested Quote Email",
  "Requested Availability Notification",
] as const;

export async function POST(request: NextRequest) {
  try {
    const { email, event, properties, attribution } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!event || !VALID_EVENTS.includes(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const enrichedProperties: Record<string, unknown> = { ...properties };
    if (attribution) {
      if (attribution.landing_page)
        enrichedProperties["Landing Page"] = attribution.landing_page;
      if (attribution.page_type)
        enrichedProperties["Page Type"] = attribution.page_type;
      if (attribution.form_type)
        enrichedProperties["Form Type"] = attribution.form_type;
      if (attribution.offer_type)
        enrichedProperties["Offer Type"] = attribution.offer_type;
      if (attribution.device_type)
        enrichedProperties["Device Type"] = attribution.device_type;
    }

    // Persist attribution for cross-device bridging (fire-and-forget)
    persistVisitorAttribution(email, {
      attribution: request.cookies.get("_sp_attribution")?.value,
      firstTouch: request.cookies.get("_sp_first_touch")?.value,
    }).catch(() => {});

    // Subscribe to Klaviyo list + fire event in parallel
    await Promise.all([
      subscribeToKlaviyoList({ email }),
      sendKlaviyoEvent(event, enrichedProperties, {
        email,
        attribution: attribution
          ? {
              utm_source: attribution.utm_source,
              utm_medium: attribution.utm_medium,
              utm_campaign: attribution.utm_campaign,
            }
          : undefined,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Listing Email Capture] Error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
