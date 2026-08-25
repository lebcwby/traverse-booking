import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Host-aware robots.
 *
 * Vercel answers every attached domain with the whole app, so
 * audit.booktraverse.com serves all of booktraverse.com too. Canonicals stop
 * those duplicates being INDEXED — Search Console duly files them under
 * "Alternate page with proper canonical" — but canonicals do nothing to stop
 * them being CRAWLED. By 2026-08-24 Google had crawled 56 such URLs on the
 * audit host, plus junk like /& and /$ landing in the 404 report.
 *
 * A catch-all redirect was tried first and was worse: its negative lookahead
 * did not exclude what it looked like it excluded, so /public assets and
 * /_next/image 308'd away and the page lost its images. robots is the right
 * tool — it stops the crawl without touching how the page is served.
 *
 * Note we deliberately do NOT disallow /_next/ on the main host. Google needs
 * the JS and CSS to render pages; blocking it would hurt indexing far more
 * than the handful of 404s from stale hashed chunks (those are old build
 * assets Google will drop on its own).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";

  if (host.startsWith("audit.")) {
    return {
      rules: [
        {
          userAgent: "*",
          // The landing page itself should still be indexable — it's a real
          // lead magnet with its own canonical. Everything else on this host
          // is an accidental mirror of www.
          allow: "/$",
          disallow: "/",
        },
      ],
      host: "https://audit.booktraverse.com",
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://www.booktraverse.com/sitemap.xml",
  };
}
