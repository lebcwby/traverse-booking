/**
 * The owner-acquisition surfaces: the pages whose job is capturing a property
 * owner rather than selling a stay.
 *
 * Two chat widgets key off this and they must agree exactly, or a page ends up
 * with both bubbles or neither — hence one shared predicate rather than a copy
 * in each component:
 *   · Vintory (LeadConnector) loads ONLY here — owner lead capture.
 *   · Conduit (guest support) loads everywhere EXCEPT here.
 *
 * Host is checked as well as path on purpose. `audit.` and `projection.` are
 * served by host-scoped rewrites in next.config.ts, so the client router never
 * sees `/audit` — usePathname() returns "/" on those subdomains (the same trap
 * that once leaked the mobile bottom bar onto them). Matching on path alone
 * would miss both hosts; matching on host alone would miss
 * www.booktraverse.com/audit, which is where the page is reachable today.
 */
const OWNER_HOST_PREFIXES = ["audit.", "projection."];
const OWNER_PATHS = ["/property-management", "/audit", "/projection"];

export function isOwnerSurface(pathname: string, host: string): boolean {
  // `host` comes from the request header during server render and from
  // window.location once hydrated. Without the header the subdomains would only
  // be recognised on the client — too late, the SSR HTML would already carry
  // the wrong widget.
  const h = (
    typeof window !== "undefined" ? window.location.hostname : host
  ).toLowerCase();
  if (OWNER_HOST_PREFIXES.some((p) => h.startsWith(p))) return true;
  return OWNER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
