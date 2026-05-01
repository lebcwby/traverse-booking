import { NextResponse } from "next/server";

/**
 * CAPI Health Check — verifies Meta CAPI token is valid by sending a test event.
 * Returns clear pass/fail so external monitors can alert on failure.
 * Does NOT use test_event_code so the event counts toward audience building.
 */
export async function GET() {
  const pixelId = (process.env.META_PIXEL_ID || "").trim();
  const token = (process.env.META_CAPI_TOKEN || "").trim();

  if (!pixelId || !token) {
    return NextResponse.json(
      {
        status: "FAIL",
        error: "META_PIXEL_ID or META_CAPI_TOKEN env var is missing",
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v24.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "PageView",
              event_time: Math.floor(Date.now() / 1000),
              event_id: `health_${Date.now()}`,
              action_source: "website",
              event_source_url: "https://www.booktraverse.com/",
              user_data: {
                client_ip_address: "127.0.0.1",
                client_user_agent: "CAPI-HealthCheck/1.0",
              },
            },
          ],
          access_token: token,
        }),
      }
    );

    const body = await res.json();

    if (body.events_received === 1) {
      return NextResponse.json({ status: "PASS", events_received: 1 });
    }

    return NextResponse.json(
      {
        status: "FAIL",
        error: body.error?.message || "events_received !== 1",
        meta_response: body,
      },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "FAIL",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
