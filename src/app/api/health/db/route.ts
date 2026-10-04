// /api/health/db
//
// Reports whether advisory locking actually works. This exists because
// withAdvisoryLock() silently did nothing in production for months — it needs
// a session-mode connection, and with no SHARED_DATABASE_URL_DIRECT set it
// fell back to DATABASE_URL on Supabase's transaction pooler (:6543). That is
// what allowed GY-ty5Dgqzs / GY-8RHBqLsm: one payment, two confirmed
// reservations for the same stay, created 117ms apart.
//
// A lock that quietly no-ops is invisible, so make it observable. Authorized
// callers get the probe detail; everyone else gets ok/degraded only.

import { NextResponse } from "next/server";
import {
  applyHealthCacheHeaders,
  isHealthRequestAuthorized,
} from "@/lib/health";
import { advisoryLocksEffective, probeAdvisoryLock } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const probe = await probeAdvisoryLock();
  const authorized = isHealthRequestAuthorized(request);
  const status = probe.effective ? "ok" : "degraded";

  const body = authorized
    ? {
        status,
        advisoryLocks: {
          effective: probe.effective,
          detail: probe.detail,
          target: probe.target,
          connectionLooksSessionMode: advisoryLocksEffective(),
        },
        checkedAt: new Date().toISOString(),
      }
    : { status, checkedAt: new Date().toISOString() };

  return applyHealthCacheHeaders(
    NextResponse.json(body, { status: probe.effective ? 200 : 503 })
  );
}
