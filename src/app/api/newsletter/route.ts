import { NextRequest, NextResponse } from "next/server";
import {
  subscribeToKlaviyoList,
  sendKlaviyoEvent,
} from "@/lib/server-tracking";
import { persistVisitorAttribution } from "@/lib/visitor-attribution";

export async function POST(request: NextRequest) {
  try {
    const { email, attribution } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    await subscribeToKlaviyoList({ email });

    // Persist attribution for cross-device bridging (fire-and-forget)
    persistVisitorAttribution(email, {
      attribution: request.cookies.get("_sp_attribution")?.value,
      firstTouch: request.cookies.get("_sp_first_touch")?.value,
    }).catch(() => {});

    const eventProperties: Record<string, unknown> = {
      "Signup Location": attribution?.form_type || "Footer",
    };
    if (attribution) {
      if (attribution.landing_page)
        eventProperties["Landing Page"] = attribution.landing_page;
      if (attribution.page_type)
        eventProperties["Page Type"] = attribution.page_type;
      if (attribution.form_type)
        eventProperties["Form Type"] = attribution.form_type;
      if (attribution.offer_type)
        eventProperties["Offer Type"] = attribution.offer_type;
      if (attribution.listing_id)
        eventProperties["Listing ID"] = attribution.listing_id;
      if (attribution.device_type)
        eventProperties["Device Type"] = attribution.device_type;
    }

    sendKlaviyoEvent("Newsletter Signup", eventProperties, {
      email,
      attribution: attribution
        ? {
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
          }
        : undefined,
    }).catch((err) =>
      console.error("[Klaviyo] Newsletter signup event error:", err)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Newsletter] Subscribe error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
