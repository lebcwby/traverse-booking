// /api/health/openapi
//
// Token-freshness probe for the Guesty OpenAPI surface (reservations,
// listings admin endpoints, customFields). Separate from /api/health/beapi
// so monitoring can alert on each independently — see `src/lib/health.ts`
// header for the full rationale.
//
// Response shape mirrors the legacy /api/health: authorized callers get
// detailed status + hoursRemaining; unauthorized callers get just an
// overall status code.

import { NextResponse } from "next/server";
import {
  applyHealthCacheHeaders,
  getTokenHealth,
  httpStatusForToken,
  isHealthRequestAuthorized,
} from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const probe = await getTokenHealth(["openapi"]);
  if (!probe) {
    return applyHealthCacheHeaders(
      NextResponse.json({ status: "error" }, { status: 500 })
    );
  }

  const openapi = probe.openapi;
  const authorized = isHealthRequestAuthorized(request);
  return applyHealthCacheHeaders(
    NextResponse.json(
      authorized
        ? {
            surface: "openapi",
            status: openapi.status,
            hoursRemaining: openapi.hoursRemaining,
            checkedAt: new Date().toISOString(),
          }
        : {
            surface: "openapi",
            status: openapi.status,
            checkedAt: new Date().toISOString(),
          },
      { status: httpStatusForToken(openapi.status) }
    )
  );
}
