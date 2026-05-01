import { NextResponse } from "next/server";
import { rateLimit, type RateLimitConfig } from "@/lib/rate-limit";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function enforceRateLimit(
  req: Request,
  scope: string,
  config: RateLimitConfig,
  key = clientIp(req)
): Promise<NextResponse | null> {
  const result = await rateLimit(`${scope}:${key}`, config);
  if (result.allowed) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000)
  );
  return NextResponse.json(
    { error: "rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  );
}

export function rejectOversizedRequest(
  req: Request,
  maxBytes: number
): NextResponse | null {
  const len = req.headers.get("content-length");
  if (!len) return null;
  const size = Number(len);
  if (!Number.isFinite(size) || size <= maxBytes) return null;
  return NextResponse.json(
    { error: `request too large (max ${maxBytes} bytes)` },
    { status: 413 }
  );
}
