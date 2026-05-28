export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  /**
   * Fail-closed mode. Default false (fail-open: when the shared limiter
   * RPC errors, fall back to the per-lambda in-memory limiter so the site
   * stays up). Set true for payment-amplification-risk routes like
   * /api/payment-intent — if the shared limiter is unavailable we'd
   * rather 503 the request than route to a fresh-on-cold-start in-memory
   * window that an attacker can exhaust at will. See Codex #11 in the
   * 2026-05-27 review for the threat model.
   */
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /**
   * True when the shared limiter RPC errored AND failClosed was set, so
   * `allowed=false` was returned defensively rather than because the
   * caller actually exceeded the quota. Lets callers surface a 503
   * "limiter unavailable" instead of a 429 "too many requests".
   */
  failure?: boolean;
}

const localRateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

function pruneExpiredLocalEntries(now: number) {
  localRateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) {
      localRateLimitStore.delete(key);
    }
  });
}

function localRateLimit(
  bucket: string,
  { limit, windowMs }: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  pruneExpiredLocalEntries(now);

  const existing = localRateLimitStore.get(bucket);
  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs;
    localRateLimitStore.set(bucket, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt,
    };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export async function rateLimit(
  bucket: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return localRateLimit(bucket, config);
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/check_rate_limit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          p_bucket: bucket,
          p_limit: config.limit,
          p_window_ms: config.windowMs,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase RPC failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as Partial<RateLimitResult> | null;
    if (
      !data ||
      typeof data.allowed !== "boolean" ||
      typeof data.remaining !== "number" ||
      typeof data.resetAt !== "number"
    ) {
      throw new Error(`Unexpected rate limit payload: ${JSON.stringify(data)}`);
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: data.resetAt,
    };
  } catch (error) {
    if (config.failClosed) {
      // Fail-closed: refuse the request rather than fall back to the
      // per-lambda in-memory limiter. Logged loudly so Sentry/Vercel
      // dashboards pick it up — repeated occurrences = real Supabase
      // outage worth paging.
      console.error(
        "[RateLimit] fail-closed: shared limiter unavailable, refusing request",
        {
          bucket,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        failure: true,
      };
    }
    console.error(
      "[RateLimit] Shared limiter unavailable, using local fallback:",
      error instanceof Error ? error.message : error
    );
    return localRateLimit(bucket, config);
  }
}
