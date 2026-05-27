// /api/health
//
// Summary health endpoint. Fans out to each surface and returns a single
// overall status — `unhealthy` if any surface is expired/missing,
// `warning` if any is in the warning window, `healthy` otherwise.
//
// Sub-routes (introduced 2026-05-27 via Codex #9) so monitoring can target
// each Guesty surface independently:
//   - /api/health/beapi    — quotes / search / pricing
//   - /api/health/openapi  — reservations / listings admin / customFields
//
// Auth model: anyone gets back the overall status code (200 / 503); only
// CRON_SECRET-bearing requests get the per-surface detail in the body.
// Same gate used by the sub-routes, defined in src/lib/health.ts.

import { NextResponse } from "next/server";
import {
  applyHealthCacheHeaders,
  getTokenHealth,
  isFailingStatus,
  isHealthRequestAuthorized,
} from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const probe = await getTokenHealth(["beapi", "openapi"]);
  if (!probe) {
    return applyHealthCacheHeaders(
      NextResponse.json({ status: "error" }, { status: 500 })
    );
  }

  const { beapi, openapi } = probe;
  const hasFailing =
    isFailingStatus(beapi.status) || isFailingStatus(openapi.status);
  const hasWarning =
    beapi.status === "warning" || openapi.status === "warning";

  const overallStatus = hasFailing
    ? "unhealthy"
    : hasWarning
      ? "warning"
      : "healthy";
  const httpStatus = hasFailing ? 503 : 200;

  const authorized = isHealthRequestAuthorized(request);

  return applyHealthCacheHeaders(
    NextResponse.json(
      authorized
        ? {
            status: overallStatus,
            beapi: { status: beapi.status, hoursRemaining: beapi.hoursRemaining },
            openapi: {
              status: openapi.status,
              hoursRemaining: openapi.hoursRemaining,
            },
            checkedAt: new Date().toISOString(),
          }
        : {
            status: overallStatus,
            checkedAt: new Date().toISOString(),
          },
      { status: httpStatus }
    )
  );
}
