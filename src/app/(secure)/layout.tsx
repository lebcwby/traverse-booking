import { headers } from "next/headers";
import { SiteShell } from "@/components/layout/site-shell";

/**
 * Sensitive pages — /book, /login, /contact, /account, /auth/*.
 *
 * These are served the strict nonce-based CSP built in the proxy, which has
 * NO 'unsafe-inline'. Every inline script therefore needs the per-request
 * nonce or it is blocked — and a blocked script here means GTM and Google Ads
 * enhanced conversions silently stop firing on checkout. That has happened
 * before; see the note in src/lib/csp.ts.
 *
 * Reading headers() makes this subtree dynamic. That is correct and intended:
 * checkout and account pages must never be served from a shared cache.
 */
export default async function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <SiteShell nonce={nonce}>{children}</SiteShell>;
}
