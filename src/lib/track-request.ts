// Shared request helpers for /api/track/* route handlers.

import type { NextRequest } from "next/server";
import { lookupMetaVisitor } from "@/lib/meta-visitor-store";
import { nearestZip } from "@/lib/zip-lookup";

// IPv4: dotted-quad 0-255 each octet
const IPV4_RE =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;
// IPv6: permissive — at least one colon, only hex/colons, length-bounded
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function isValidClientIp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 45) return false;
  if (IPV4_RE.test(value)) return true;
  return value.includes(":") && IPV6_RE.test(value);
}

/**
 * Pick the IP to forward to Meta CAPI. Prefers the browser-discovered IP
 * (passed in the request body via `client-ip-discovery.ts`) because Vercel
 * serves booktraverse.com IPv4-only, so `x-forwarded-for` cannot match the
 * pixel's view for dual-stack visitors. Falls back to the proxy header
 * when no body IP is provided or when it fails validation.
 */
export function resolveClientIp(
  request: NextRequest,
  bodyIp: unknown
): string | undefined {
  if (isValidClientIp(bodyIp)) return bodyIp;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  );
}

function safeDecode(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return value.length > 0 ? value : undefined;
  }
}

/**
 * Build the full ServerEventContext for Meta CAPI calls from a NextRequest.
 * Extracts:
 *   - clientIp / clientUserAgent — probabilistic identity
 *   - fbp / fbc — Meta browser ID and click ID (cookie fall back to body)
 *   - externalId — stable visitor UUID from `_sp_visitor_id` cookie, feeds
 *     Meta's longitudinal identity matching when no email is available
 *   - city / state / zip / country — Vercel edge geo headers (MaxMind-grade),
 *     hashed and sent as real user_data for Meta probabilistic matching
 *
 * The route handlers used to do all of this inline; centralizing here keeps
 * the 4 CAPI-firing tracking routes consistent and makes future identity
 * signals (X-Vercel-IP-Latitude, etc) trivial to add in one place.
 */
export interface TrackContext {
  clientIp?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  externalId?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export async function buildServerEventContext(
  request: NextRequest,
  bodyFbp?: unknown,
  bodyFbc?: unknown,
  bodyIp?: unknown
): Promise<TrackContext> {
  const clientIp = resolveClientIp(request, bodyIp);
  const clientUserAgent = request.headers.get("user-agent") || undefined;
  let fbp =
    request.cookies.get("_fbp")?.value ||
    (typeof bodyFbp === "string" ? bodyFbp : undefined) ||
    undefined;
  let fbc =
    request.cookies.get("_fbc")?.value ||
    (typeof bodyFbc === "string" ? bodyFbc : undefined) ||
    undefined;
  const externalId = request.cookies.get("_sp_visitor_id")?.value || undefined;

  // Cross-session fallback: if the visitor has a stable _sp_visitor_id but
  // _fbp/_fbc cookies are missing (cleared, or the browser never stored
  // them on a non-landing request), rehydrate from sp_meta_visitors. This
  // bridges the per-session cookie layer and the long-lived identity
  // anchor. Skipped when cookies already carry the IDs so the happy path
  // stays latency-free.
  if (externalId && (!fbp || !fbc)) {
    const stored = await lookupMetaVisitor(externalId);
    if (stored) {
      if (!fbp && stored.fbp) fbp = stored.fbp;
      if (!fbc && stored.fbc) fbc = stored.fbc;
    }
  }

  // Vercel edge sends geo headers on every request routed through the
  // edge network. x-vercel-ip-city is URL-encoded to handle unicode names.
  // Region is 2-letter state code, country is 2-letter ISO, postal is raw.
  // Normalization happens downstream in sendMetaEvent before SHA-256.
  const city = safeDecode(request.headers.get("x-vercel-ip-city"));
  const state = request.headers.get("x-vercel-ip-country-region") || undefined;
  const country = request.headers.get("x-vercel-ip-country") || undefined;

  // Vercel's MaxMind DB has spotty postal-code coverage for US ISPs (observed
  // 0% on SP traffic 2026-04-14 even when city/state hit ~98%). Fall back to
  // lat/lon → nearest US ZIP centroid lookup, which is the same MaxMind data
  // hydrated through a local centroid file.
  let zip = request.headers.get("x-vercel-ip-postal-code") || undefined;
  if (!zip) {
    const latStr = request.headers.get("x-vercel-ip-latitude");
    const lngStr = request.headers.get("x-vercel-ip-longitude");
    if (latStr && lngStr) {
      const lat = Number(latStr);
      const lng = Number(lngStr);
      zip = nearestZip(lat, lng) || undefined;
    }
  }

  return {
    clientIp,
    clientUserAgent,
    fbp,
    fbc,
    externalId,
    city,
    state,
    zip,
    country,
  };
}
