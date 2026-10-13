import { SiteShell } from "@/components/layout/site-shell";

/**
 * Public pages — STATIC.
 *
 * No nonce, because these are served the base CSP, which allows
 * 'unsafe-inline' for scripts. That is the whole point: this layout reads
 * nothing request-scoped, so every page beneath it can be prerendered and
 * served from the CDN.
 *
 * ⚠️ Adding `headers()`, `cookies()` or any dynamic API here re-breaks
 * caching for the entire public site. If a page genuinely needs request
 * context, make that PAGE dynamic rather than this layout.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
