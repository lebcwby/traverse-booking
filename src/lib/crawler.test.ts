import { describe, expect, it } from "vitest";
import { CRAWLER_CACHE_CONTROL, isCrawler } from "./crawler";

/** The exact UA strings the 2026-10-09 audit sent. */
const UAS = {
  gptbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  oaiSearch:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  claudeBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com",
  claudeUser:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-User/1.0; +Claude-User@anthropic.com",
  perplexity:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot",
  googlebot:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingbot:
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  applebot:
    "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
  ccbot: "CCBot/2.0 (https://commoncrawl.org/faq/)",
  smoke: "traverse-smoke-content/1.0",
  validator: "traverse-listing-validator/1.0",
  cron: "vercel-cron/1.0",
  // Real humans.
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
};

describe("isCrawler", () => {
  it("detects every AI crawler from the audit", () => {
    for (const key of [
      "gptbot",
      "oaiSearch",
      "claudeBot",
      "claudeUser",
      "perplexity",
      "ccbot",
    ] as const) {
      expect(isCrawler(UAS[key]), key).toBe(true);
    }
  });

  it("detects the search engines", () => {
    expect(isCrawler(UAS.googlebot)).toBe(true);
    expect(isCrawler(UAS.bingbot)).toBe(true);
    expect(isCrawler(UAS.applebot)).toBe(true);
  });

  it("detects our own internal fetchers", () => {
    // These should never mint a visitor id either.
    expect(isCrawler(UAS.smoke)).toBe(true);
    expect(isCrawler(UAS.validator)).toBe(true);
    expect(isCrawler(UAS.cron)).toBe(true);
  });

  // The expensive mistake would be classifying a guest as a bot: they would
  // lose attribution and Meta identifiers silently.
  it("does NOT match real browsers", () => {
    expect(isCrawler(UAS.chrome)).toBe(false);
    expect(isCrawler(UAS.safariIos)).toBe(false);
    expect(isCrawler(UAS.firefox)).toBe(false);
    expect(isCrawler(UAS.androidChrome)).toBe(false);
  });

  it("does not match on a bare 'bot' substring", () => {
    // "Chrome/131" contains no token; this guards against a future careless
    // addition like a bare "bot" entry, which would match e.g. "Cubot" phones.
    expect(isCrawler("Mozilla/5.0 (Linux; Android 13; CUBOT NOTE 30)")).toBe(
      false
    );
    expect(isCrawler("Mozilla/5.0 robot-vacuum-browser/1.0")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isCrawler("GPTBOT/1.2")).toBe(true);
    expect(isCrawler("gptbot/1.2")).toBe(true);
  });

  it("treats a missing or empty user agent as not-a-crawler", () => {
    // Fail toward normal visitor handling: a human with a stripped UA keeps
    // their attribution, and an anonymous scraper simply gets tracked.
    expect(isCrawler(null)).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
    expect(isCrawler("")).toBe(false);
  });
});

describe("CRAWLER_CACHE_CONTROL", () => {
  it("is shared-cache only and never private-cacheable for long", () => {
    expect(CRAWLER_CACHE_CONTROL).toContain("s-maxage=300");
    expect(CRAWLER_CACHE_CONTROL).toContain("max-age=0");
    expect(CRAWLER_CACHE_CONTROL).toContain("stale-while-revalidate");
    expect(CRAWLER_CACHE_CONTROL).not.toContain("private");
    expect(CRAWLER_CACHE_CONTROL).not.toContain("no-store");
  });
});

describe("WhatsApp in-app browser", () => {
  // Regression guard. "whatsapp" appears in BOTH the link unfurler and the
  // in-app browser a real guest uses after tapping a shared link. Matching it
  // would silently strip that guest's attribution.
  it("is treated as a human, not a crawler", () => {
    expect(
      isCrawler(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.25.78"
      )
    ).toBe(false);
  });
});
