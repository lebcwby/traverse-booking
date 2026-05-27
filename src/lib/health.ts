// src/lib/health.ts
//
// Shared health-check primitives for /api/health and its subroutes.
// Currently the only check we do is token-freshness (read from the
// `guesty_tokens` Supabase table that the refresh-tokens cron populates
// every 2h). We expose this as a primitive so /api/health/beapi and
// /api/health/openapi can each report on their own surface, while the
// top-level /api/health fans out to both.
//
// Why split this out (Codex #9, flagged 2026-05-27): before the split,
// /api/health returned a single overall status that conflated BEAPI
// (quotes / search-listings / pricing) and OpenAPI (reservations /
// listings admin / customFields). A Vercel monitor alerting on the
// combined endpoint couldn't tell us which surface broke. Now the
// monitor can target `/api/health/beapi` independently.

import { createClient } from "@supabase/supabase-js";

/** Surfaces we currently probe. Add new ones (e.g. `stripe`) here. */
export type TokenSurface = "beapi" | "openapi";

export type TokenStatus = "healthy" | "warning" | "expired" | "missing";

export interface SurfaceHealth {
  status: TokenStatus;
  hoursRemaining: number;
}

// Actually expired = 503 (cron refresh failed for >2h).
const EXPIRED_THRESHOLD_MS = 0;
// Token expires within this window = "warning" (200 but flagged) so we get
// a heads-up before the cron's next refresh window misses.
const WARNING_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// Lazy supabase client — see Codex #8 / src/lib/plan/events.ts for the
// rationale. Health endpoints get called during deploy preview boots when
// service-role env may not be present.
let _supabase: ReturnType<typeof createClient> | null = null;
function getHealthSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return _supabase;
}

/**
 * Fetch token-expiry rows once and classify each requested surface.
 * Returns null if Supabase is unreachable / unconfigured — callers should
 * 500 in that case.
 */
export async function getTokenHealth(
  surfaces: TokenSurface[]
): Promise<Record<TokenSurface, SurfaceHealth> | null> {
  const supabase = getHealthSupabase();
  if (!supabase) return null;

  const { data: tokens, error } = await supabase
    .from("guesty_tokens")
    .select("token_type, expires_at");
  if (error) return null;

  const now = Date.now();
  const out = {} as Record<TokenSurface, SurfaceHealth>;
  for (const surface of surfaces) {
    const row = (tokens as { token_type: string; expires_at: number }[]).find(
      (t) => t.token_type === surface
    );
    if (!row) {
      out[surface] = { status: "missing", hoursRemaining: 0 };
      continue;
    }
    const remaining = row.expires_at - now;
    const hoursRemaining = Math.round((remaining / 3600000) * 10) / 10;
    const status: TokenStatus =
      remaining <= EXPIRED_THRESHOLD_MS
        ? "expired"
        : remaining <= WARNING_THRESHOLD_MS
          ? "warning"
          : "healthy";
    out[surface] = { status, hoursRemaining };
  }
  return out;
}

/** True when the surface is in a state that should 503 a monitor probe. */
export function isFailingStatus(status: TokenStatus): boolean {
  return status === "expired" || status === "missing";
}

/** Pick an HTTP status from a TokenStatus. */
export function httpStatusForToken(status: TokenStatus): number {
  return isFailingStatus(status) ? 503 : 200;
}

/**
 * Single auth gate used by every /api/health* route. Same shape as the
 * original endpoint: Bearer CRON_SECRET, or x-cron-secret header. Unauth
 * requests still get a HEALTH-OK / 503 status code but no body detail —
 * monitors get useful signal without leaking token-expiry timing to the
 * internet.
 */
export function isHealthRequestAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  const explicitHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${cronSecret}` || explicitHeader === cronSecret;
}

/** Standard no-cache headers for health responses. */
export function applyHealthCacheHeaders(response: Response): Response {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0"
  );
  return response;
}
