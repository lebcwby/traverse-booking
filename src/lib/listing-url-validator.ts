import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Edge validation for /properties/<slug>, so an unknown listing returns a real
 * 404 instead of a 200.
 *
 * Why this has to happen at the edge: `/properties/[id]` already calls
 * notFound() when the listing doesn't resolve, but Next 16 commits the
 * response status before the page component gets there, so the visitor — and
 * Googlebot — receive HTTP 200 with a noindex meta. That is the soft-404
 * accepted in CLAUDE.md known-issue #8, which names this file as the fix. It
 * is the same streaming behaviour that stops the canonical permanentRedirect()
 * from emitting its 308.
 *
 * Confirmed not to be a Suspense artefact: removing
 * src/app/properties/[id]/loading.tsx was measured and still returned 200.
 *
 * Three gates, cheapest first:
 *
 *  1. SHAPE. A canonical listing URL always ends in a 24-character hex Guesty
 *     id — getListingSlug builds `${slugify(title)}-${guestyId}`, and
 *     extractIdFromSlug only ever matches /([a-f0-9]{24})$/. A path without
 *     one cannot resolve to a listing, so it is a 404 with no lookup at all.
 *
 *  2. EXISTENCE. A well-formed id that no longer exists — a delisted
 *     property — is the case that actually matters for the index, and the one
 *     shape alone cannot catch. Checked against the live id set.
 *
 *  3. CANONICALISATION. A real listing reached by bare id, or by a stale
 *     slug, is a duplicate URL for a page that already has a canonical one.
 *     308 to the canonical slug, carrying the query string so dates, guests
 *     and utm_* survive. The canonical URL itself never redirects.
 *
 * FAILS OPEN, always. If the id set cannot be loaded we let the request
 * through to the page, which behaves exactly as it does today. 404ing a real
 * listing because a lookup blipped would be far worse than the soft-404 this
 * is fixing.
 */

/** Guesty ids are 24 lowercase hex characters. */
const GUESTY_ID_AT_END = /([a-f0-9]{24})$/;

/** How long an edge instance reuses a fetched id set. */
const ID_CACHE_TTL_MS = 10 * 60 * 1000;
/** Never let the lookup hold up a page render. */
const ID_FETCH_TIMEOUT_MS = 1500;

type IdCache = {
  ids: Set<string>;
  /** guesty id -> canonical slug, for the 308. */
  slugs: Map<string, string>;
  fetchedAt: number;
};
let idCache: IdCache | null = null;
let inFlight: Promise<IdCache | null> | null = null;

export function __resetListingIdCacheForTests() {
  idCache = null;
  inFlight = null;
}

async function fetchIdSet(origin: string): Promise<IdCache | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ID_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/api/listings/ids`, {
      signal: controller.signal,
      headers: { "user-agent": "traverse-listing-validator/1.0" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ids?: unknown;
      slugs?: Record<string, string>;
    };
    if (!Array.isArray(body.ids) || body.ids.length === 0) return null;
    const slugs = new Map<string, string>();
    if (body.slugs && typeof body.slugs === "object") {
      for (const [id, slug] of Object.entries(body.slugs)) {
        if (typeof slug === "string" && slug) slugs.set(id, slug);
      }
    }
    return {
      ids: new Set(body.ids.filter((x): x is string => typeof x === "string")),
      slugs,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The current id set, or null when it cannot be determined. A stale cache is
 * preferred over nothing: it can only let a dead URL through, never block a
 * live one.
 */
async function getIdSet(origin: string): Promise<IdCache | null> {
  const fresh = idCache && Date.now() - idCache.fetchedAt < ID_CACHE_TTL_MS;
  if (fresh) return idCache;

  // Collapse concurrent refreshes on the same instance into one fetch.
  if (!inFlight) {
    inFlight = fetchIdSet(origin).finally(() => {
      inFlight = null;
    });
  }
  const loaded = await inFlight;
  if (loaded) {
    idCache = loaded;
    return loaded;
  }
  // Refresh failed — keep serving the last good set rather than giving up.
  return idCache ?? null;
}

/**
 * Returns a 404 response when the path is a listing URL that cannot resolve,
 * or null to let the request continue.
 */
export async function validateListingUrl(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname, origin } = new URL(request.url);

  // Only single-segment listing paths: /properties/<slug>. The browse page
  // itself and anything deeper are not ours to judge.
  if (!pathname.startsWith("/properties/")) return null;
  const rest = pathname.slice("/properties/".length);
  if (!rest || rest.includes("/")) return null;

  const slug = decodeURIComponent(rest);

  // Gate 1 — shape.
  const match = slug.match(GUESTY_ID_AT_END);
  if (!match) return notFoundResponse("shape");

  // Gate 2 — existence. Unknown set → fail open.
  const cache = await getIdSet(origin);
  if (!cache) return null;
  const id = match[1];
  if (!cache.ids.has(id)) return notFoundResponse("unknown-id");

  // Gate 3 — canonicalisation. A bare id, or a stale/wrong slug, is a second
  // URL for a page that already has one. The page's own permanentRedirect()
  // cannot fix this: Next 16 commits the 200 before it runs, which is the same
  // race that made unknown ids return 200. Doing it here emits a real 308.
  //
  // The canonical URL itself must never redirect — that would loop — so this
  // only fires when the slug actually differs.
  const canonical = cache.slugs.get(id);
  if (canonical && canonical !== slug) {
    const target = new URL(request.url);
    target.pathname = `/properties/${canonical}`;
    // Query string is carried: dates, guests and utm_* must survive the hop,
    // or the redirect silently drops the guest's search and our attribution.
    return NextResponse.redirect(target, 308);
  }

  return null;
}

function notFoundResponse(reason: "shape" | "unknown-id"): NextResponse {
  // A body is served rather than a bare 404 so a person who lands here sees
  // something, but the status is the point: crawlers must get a real 404 so
  // the URL leaves the index instead of lingering as a soft 404.
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Listing not found</title>
<style>
  :root{color-scheme:light}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f5;
       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1d1d}
  main{text-align:center;padding:32px;max-width:32rem}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  p{color:#6b7280;margin:0 0 1.5rem;line-height:1.5}
  a{display:inline-block;background:#404f52;color:#fff;text-decoration:none;
    padding:.75rem 1.5rem;border-radius:999px;font-weight:600;font-size:.875rem}
</style></head>
<body><main>
  <h1>This listing isn't available</h1>
  <p>It may have been removed, or the link may be incorrect. Browse our current Colorado rentals instead.</p>
  <a href="/properties">See all properties</a>
</main></body></html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60",
      "x-robots-tag": "noindex",
      "x-listing-404": reason,
    },
  });
}
