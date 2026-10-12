import type { MetadataRoute } from "next";

/**
 * Crawler policy for www.booktraverse.com.
 *
 * ⚠️ This file serves the MAIN host only. `audit.booktraverse.com` and
 * `projection.booktraverse.com` get their own restrictive robots via
 * host-scoped rewrites to public/*-robots.txt in next.config.ts — a
 * host-varying robots.ts 404'd on BOTH hosts in production once already
 * (memory: feedback_dynamic_robots_ts_404s_in_prod). Do not reintroduce host
 * logic here. Curl both hosts after any change to this file.
 *
 * ── Why the AI crawlers are named explicitly ────────────────────────────
 *
 * They were already allowed, but only by omission: a lone `User-agent: *`
 * rule, with nobody having decided anything. Verified 2026-10-09 that all
 * twelve crawlers below already receive HTTP 200 on the homepage, /properties,
 * a listing page, /llms.txt and /sitemap.xml — 60 of 60 requests, no firewall
 * interception. Naming them makes the permission deliberate and reviewable
 * rather than accidental.
 *
 * The decision (Nadim, 2026-10-11) is to allow all of them, retrieval and
 * training alike. For a 208-property regional operator the problem is
 * obscurity, not content theft: being absent from a model's answer costs more
 * than being present in its training data. Reversible at any time by moving a
 * name into a `disallow` rule.
 */

/** Assistants that fetch a page to answer a question, and cite or link it. */
const RETRIEVAL_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
];

/** Crawlers that collect pages as model training data. */
const TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

/**
 * Paths no crawler should spend budget on.
 *
 * `/api/` stays disallowed — but note that this is why a future public agent
 * API must live OUTSIDE that namespace (see docs/phase2-ai-agent-booking.md).
 * The rest are funnel and account pages: they are noindexed, several redirect
 * or 404 for an anonymous visitor, and crawling them wastes budget that should
 * go to listings.
 */
const DISALLOWED = ["/api/", "/book/", "/account/", "/cart/", "/login"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: RETRIEVAL_BOTS, allow: "/", disallow: DISALLOWED },
      { userAgent: TRAINING_BOTS, allow: "/", disallow: DISALLOWED },
      { userAgent: "*", allow: "/", disallow: DISALLOWED },
    ],
    sitemap: "https://www.booktraverse.com/sitemap.xml",
    host: "https://www.booktraverse.com",
  };
}
