/**
 * First touch for visitors who arrive with no campaign tagging.
 *
 * `proxy.ts` has always written `_sp_attribution` (and seeded
 * `_sp_first_touch` from it) when a visit carried a utm or a click id. For
 * everyone else it wrote nothing, so an organic or direct arrival reached
 * checkout with no landing page and no referrer at all. Of the last 10
 * BE-API bookings, 8 were in exactly that state: no source, no entry page,
 * nothing to say how they found the site.
 *
 * This fills only the first-touch slot, only when it is empty. It must stay
 * a first-visit-only write: a `Set-Cookie` on a response makes that response
 * un-shared-cacheable, and the first visit is already setting `_sp_visitor_id`
 * on the same response, so nothing new becomes uncacheable. Writing on every
 * page view would undo PR #94's 429 fix.
 */

const MAX_REFERRER_LENGTH = 200;

export interface UntaggedFirstTouch {
  landingPage: string;
  capturedAt: string;
  referrer?: string;
}

/**
 * Is this request plausibly someone *arriving* on the site?
 *
 * The proxy matcher lets `/api/*` through, and an API call is never a landing
 * page. Recording one would be worse than recording nothing:
 * `/api/listings/abc` reads like a page the guest chose to visit.
 */
export function isLandingRequest(pathname: string): boolean {
  return !pathname.startsWith("/api/") && !pathname.startsWith("/_next/");
}

/**
 * The referring site, when it is not us.
 *
 * The query is dropped — a search-engine referrer can carry the typed query
 * and occasionally more, and all we need is which site sent them.
 * Same-origin referrers say nothing about acquisition.
 */
export function externalReferrer(
  rawReferer: string | null | undefined,
  selfHost: string
): string | undefined {
  if (!rawReferer) return undefined;
  try {
    const ref = new URL(rawReferer);
    // `new URL("javascript:void(0)")` parses happily and has origin "null".
    // Only a real web page is a referrer worth storing.
    if (ref.protocol !== "https:" && ref.protocol !== "http:") return undefined;
    if (ref.host === selfHost) return undefined;
    const trimmed = `${ref.origin}${ref.pathname === "/" ? "" : ref.pathname}`;
    return trimmed.slice(0, MAX_REFERRER_LENGTH);
  } catch {
    return undefined;
  }
}

/**
 * The `_sp_first_touch` payload for an untagged arrival, or null when this
 * request is not an arrival worth recording.
 */
export function buildUntaggedFirstTouch(args: {
  pathname: string;
  search: string;
  referer: string | null | undefined;
  selfHost: string;
  now?: Date;
}): UntaggedFirstTouch | null {
  if (!isLandingRequest(args.pathname)) return null;

  const referrer = externalReferrer(args.referer, args.selfHost);
  return {
    landingPage: args.pathname + args.search,
    capturedAt: (args.now ?? new Date()).toISOString(),
    ...(referrer ? { referrer } : {}),
  };
}
