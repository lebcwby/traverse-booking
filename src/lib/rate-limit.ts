export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
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
  const supabaseUrl = process.env.SHARED_SUPABASE_URL;
  const serviceRoleKey = process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY;

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
    console.error(
      "[RateLimit] Shared limiter unavailable, using local fallback:",
      error instanceof Error ? error.message : error
    );
    return localRateLimit(bucket, config);
  }
}
