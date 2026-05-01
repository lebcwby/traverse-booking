import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EXPIRED_THRESHOLD_MS = 0; // actually expired = problem
const WARNING_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours = warning (token refresh runs every 2h)

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  const explicitHeader = request.headers.get("x-cron-secret");

  return authHeader === `Bearer ${cronSecret}` || explicitHeader === cronSecret;
}

export async function GET(request: Request) {
  const url = process.env.SHARED_SUPABASE_URL;
  const key = process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const now = Date.now();

  const { data: tokens, error } = await supabase
    .from("guesty_tokens")
    .select("token_type, expires_at");

  if (error) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const tokenHealth = (type: string) => {
    const row = tokens?.find((t) => t.token_type === type);
    if (!row) return { status: "missing" as const, hoursRemaining: 0 };
    const remaining = row.expires_at - now;
    const hoursRemaining = Math.round((remaining / 3600000) * 10) / 10;
    const status =
      remaining <= EXPIRED_THRESHOLD_MS
        ? ("expired" as const) // actually dead — 503
        : remaining <= WARNING_THRESHOLD_MS
          ? ("warning" as const) // expiring soon — 200 but flagged
          : ("healthy" as const); // all good
    return { status, hoursRemaining };
  };

  const beapi = tokenHealth("beapi");
  const openapi = tokenHealth("openapi");

  // Only 503 if a token is actually expired or missing — not just low
  const hasExpired =
    beapi.status === "expired" ||
    beapi.status === "missing" ||
    openapi.status === "expired" ||
    openapi.status === "missing";
  const hasWarning = beapi.status === "warning" || openapi.status === "warning";
  const overallStatus = hasExpired
    ? "unhealthy"
    : hasWarning
      ? "warning"
      : "healthy";
  const httpStatus = hasExpired ? 503 : 200;

  const authorized = isAuthorized(request);

  const response = NextResponse.json(
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
  );
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0"
  );
  return response;
}
