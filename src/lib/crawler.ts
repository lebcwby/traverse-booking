/**
 * Known-crawler detection, used to stop spending per-visitor work on bots.
 *
 * Phase 4 of docs/phase2-ai-agent-booking.md. Measured on 2026-10-09, every
 * listing page was served to GPTBot as:
 *
 *   cache-control: private, no-cache, no-store, max-age=0, must-revalidate
 *   x-vercel-cache: MISS
 *   set-cookie: _sp_visitor_id=…; _fbp=…
 *
 * `/properties/[id]` declares `revalidate = 300`, so it *should* be served
 * from the CDN. It isn't, because the proxy sets attribution cookies on every
 * response and a response carrying Set-Cookie cannot be shared-cached. So each
 * of the dozen AI crawlers now invited in by robots.txt triggers a full origin
 * render plus a live Guesty call, 208 pages at a time — and we hand each bot a
 * tracking cookie it will never send back, which also pollutes visitor counts.
 *
 * Nothing here changes what a crawler SEES. Same HTML, same JSON-LD, same
 * status codes. It only skips work that exists to track and personalise for a
 * human: attribution cookies, the Meta identifiers, the visitor UUID, and the
 * Supabase session lookup.
 *
 * ⚠️ This is NOT a security boundary and must never become one. A user agent
 * is self-declared and trivially spoofed. Gating anything that matters —
 * pricing, availability, access — on this would mean anyone could claim to be
 * Googlebot and get different treatment, which is cloaking. The only thing it
 * may ever decide is whether we bother to track the requester.
 */

/**
 * Substrings matched case-insensitively against the User-Agent.
 *
 * Deliberately specific tokens, not bare words: "bot" alone would match
 * plenty of real browsers' extensions and some genuine users.
 */
const CRAWLER_TOKENS = [
  // Search
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "applebot",
  // AI retrieval + training
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-user",
  "claude-searchbot",
  "anthropic-ai",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "ccbot",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  // Link unfurlers — same reasoning: no human to attribute.
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  // NOTE: deliberately NOT "whatsapp". WhatsApp's link unfurler and its
  // in-app browser both carry that token, and the in-app browser is a real
  // person who followed a shared link — a common way guests arrive. Matching
  // it would strip their attribution to save one cached render.
  // Our own internal fetchers, which should never mint a visitor either.
  "traverse-smoke-content",
  "traverse-listing-validator",
  "vercel-cron",
];

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_TOKENS.some((token) => ua.includes(token));
}

/**
 * How long a crawler may reuse a page.
 *
 * Only ever applied to GET/HEAD of a page a crawler asked for, and only on
 * top of what the route already allows — `/properties/[id]` is already
 * `revalidate = 300`. `s-maxage` is shared-cache only, so a human's browser
 * is unaffected either way.
 */
export const CRAWLER_CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";
