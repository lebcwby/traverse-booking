import { NextResponse } from "next/server";

/**
 * Shared response helpers for /agent/v1.
 *
 * One shape for every error so an agent can branch on `code` rather than
 * parsing prose, and one place that decides caching — these responses are
 * built from a cache that refreshes on a ~5h cycle, so a short shared cache
 * costs nothing in freshness and absorbs repeated identical queries.
 */

export const AGENT_CACHE_SHORT =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=900";
export const AGENT_CACHE_LONG =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export type AgentErrorCode =
  | "INVALID_PARAMETER"
  | "MISSING_PARAMETER"
  | "NOT_FOUND"
  | "RANGE_TOO_LARGE"
  | "INTERNAL";

export function agentError(
  code: AgentErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: { code, message, ...(extra ?? {}) } },
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Never cache an error: a transient 500 pinned at the CDN for five
        // minutes would look like an outage to every agent behind it.
        "cache-control": "no-store",
      },
    }
  );
}

export function agentJson(body: unknown, cacheControl = AGENT_CACHE_SHORT) {
  return NextResponse.json(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheControl,
      // Public read-only data; let an agent call it from a browser context.
      "access-control-allow-origin": "*",
      "x-robots-tag": "noindex",
    },
  });
}

/**
 * Boilerplate every response carries, so an agent reading one payload knows
 * what the numbers mean without having read the spec.
 *
 * The pricing caveat is not decoration. We publish an accommodation-only
 * figure from a cache; the guest pays an all-in total computed live at
 * checkout. An agent that presents our number as "the price" would be
 * quoting something the guest will not be charged.
 */
export const AGENT_DISCLOSURE = {
  priceBasis: "accommodation-only",
  excludes: ["cleaning fee", "taxes", "pet fee", "optional extras"],
  authoritative: false,
  note: "Indicative pricing from a cache refreshed roughly every 5 hours. The all-in total, including cleaning and taxes, is computed live at checkout, which is authoritative. Availability is likewise cached and re-validated at checkout.",
} as const;
