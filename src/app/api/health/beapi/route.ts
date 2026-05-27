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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const probe = await getTokenHealth(["beapi"]);
  if (!probe) {
    return applyHealthCacheHeaders(
      NextResponse.json({ status: "error" }, { status: 500 })
    );
  }

  const beapi = probe.beapi;
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
