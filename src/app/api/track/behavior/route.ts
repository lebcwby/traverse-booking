import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const VALID_EVENTS = [
  "search",
  "listing_view",
  "listing_click",
  "checkout_started",
  "checkout_error",
  "booking_completed",
  "landing_page_view",
  "guide_page_view",
  "quote_created",
] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_type, session_id, properties, page_url, referrer } = body;

    if (!event_type || !VALID_EVENTS.includes(event_type)) {
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 }
      );
    }

    const user_agent = request.headers.get("user-agent") || undefined;

    // Fire and forget — don't await in production
    getSupabaseAdmin()
      .from("user_events")
      .insert({
        event_type,
        session_id: session_id || null,
        properties: properties || {},
        page_url: page_url || null,
        referrer: referrer || null,
        user_agent: user_agent || null,
      })
      .then(({ error }) => {
        if (error) console.error("[behavior] insert error:", error.message);
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
