// /api/health/beapi
//
// Token-freshness probe for the Guesty BEAPI surface (powers quotes, search,
// pricing). Separate from /api/health/openapi (reservations, listings admin,
// customFields) so monitoring can alert on each independently — see
// `src/lib/health.ts` header for the full rationale.
//
// Response shape mirrors the legacy /api/health: authorized callers get
// detailed status + hoursRemaining; unauthorized callers get just an
// overall status code (so monitors still work without exposing token
// timing to the public internet).

import { NextResponse } from "next/server";
import {
  applyHealthCacheHeaders,
  getTokenHealth,
  httpStatusForToken,
  isHealthRequestAuthorized,
} from "@/lib/health";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// Send a heads-up alert when the BEAPI token has less than this much life
// left. The cron is supposed to refresh at 2h-of-life remaining, so a token
// dropping under 1h means the cron has already missed at least one
// scheduled fire. Catching this gives us hours of warning before /properties
// breaks instead of finding out via "all searches show 0 results."
//
// Alert dedup is handled by src/lib/alerts.ts (1h cooldown per alert key),
// so this won't spam — at most one alert per hour while the token is in
// the warning window.
const LOW_WARNING_HOURS = 1;

export async function GET(request: Request) {
  const probe = await getTokenHealth(["beapi"]);
  if (!probe) {
    return applyHealthCacheHeaders(
      NextResponse.json({ status: "error" }, { status: 500 })
    );
  }

  const beapi = probe.beapi;

  // Heads-up alert when the cron is dragging. Fires for both "warning"
  // (within REFRESH_BUFFER_MS) and "expired" states. The sendAlert dedup
  // handles spam — one email per hour per alert key while we're in the
  // window. Don't await the alert send — we don't want a Resend hiccup
  // to delay the health probe response.
  if (
    beapi.status !== "healthy" ||
    (beapi.hoursRemaining > 0 && beapi.hoursRemaining < LOW_WARNING_HOURS)
  ) {
    void sendAlert(
      "BEAPI token life low — cron drag",
      `<p>BEAPI token has <strong>${beapi.hoursRemaining}h</strong> remaining and is in status <strong>${beapi.status}</strong>.</p>
       <p>The refresh-tokens cron is configured to fire every 4h and refresh
       when &lt; 2h life remains. This alert means the cron has dragged past
       at least one expected fire. Hit
       <code>/api/cron/refresh-tokens</code> with the CRON_SECRET to manually
       refresh, OR rely on the in-app self-heal in
       <code>src/lib/guesty-beapi.ts</code> which kicks in on the next /properties
       request when the token actually expires.</p>`,
      "beapi-token-life-low"
    ).catch((err) => {
      console.warn(
        "[health/beapi] sendAlert failed:",
        err instanceof Error ? err.message : err
      );
    });
  }

  const authorized = isHealthRequestAuthorized(request);
  return applyHealthCacheHeaders(
    NextResponse.json(
      authorized
        ? {
            surface: "beapi",
            status: beapi.status,
            hoursRemaining: beapi.hoursRemaining,
            checkedAt: new Date().toISOString(),
          }
        : {
            surface: "beapi",
            status: beapi.status,
            checkedAt: new Date().toISOString(),
          },
      { status: httpStatusForToken(beapi.status) }
    )
  );
}
