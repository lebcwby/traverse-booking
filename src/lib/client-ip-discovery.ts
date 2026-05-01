// Browser-side IP discovery so Meta CAPI can send the same IP the pixel
// sees when it talks to graph.facebook.com directly. booktraverse.com has
// no AAAA record (Vercel cluster `vercel-dns-017.com` is IPv4-only), so
// on dual-stack networks the browser hits Vercel over IPv4 but reaches
// graph.facebook.com over IPv6 (happy eyeballs). The server can therefore
// never produce a matching `client_ip_address` from `x-forwarded-for`.
// ipify.org has both A and AAAA, so happy eyeballs picks the same family
// the browser would use for Meta — making the discovered IP the right
// one to forward as `client_ip_address`.

import { hasMarketingConsent } from "./consent";

const SESSION_STORAGE_KEY = "_sp_client_ip";
const DISCOVERY_TIMEOUT_MS = 1500;

let cachedIp: string | undefined;
let inflight: Promise<string | undefined> | null = null;

function readSessionCache(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function writeSessionCache(ip: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, ip);
  } catch {
    /* sessionStorage unavailable */
  }
}

async function fetchIp(): Promise<string | undefined> {
  if (typeof fetch === "undefined") return undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const res = await fetch("https://api64.ipify.org?format=json", {
      signal: controller.signal,
      // No credentials, no referrer — keep this call as anonymous as possible
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { ip?: unknown };
    return typeof data.ip === "string" && data.ip.length > 0
      ? data.ip
      : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the user's outgoing IP as observed by an IPv6-capable third party,
 * cached for the session. Returns undefined on failure or without marketing
 * consent. Safe to call from multiple tracking events in parallel — the
 * underlying fetch is shared via an in-flight promise.
 */
export async function getDiscoveredClientIp(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  if (!hasMarketingConsent()) return undefined;

  if (cachedIp) return cachedIp;
  const fromSession = readSessionCache();
  if (fromSession) {
    cachedIp = fromSession;
    return cachedIp;
  }

  if (!inflight) {
    inflight = fetchIp().then((ip) => {
      if (ip) {
        cachedIp = ip;
        writeSessionCache(ip);
      }
      inflight = null;
      return ip;
    });
  }
  return inflight;
}

/** Test-only: clear the in-memory cache. */
export function _resetClientIpCacheForTests() {
  cachedIp = undefined;
  inflight = null;
}
