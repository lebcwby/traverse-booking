import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getLeadAttribution } from "./attribution";

/**
 * Owner-lead attribution (the /property-management form).
 *
 * Context: this funnel shipped capturing NOTHING — the form posted a hardcoded
 * `source: "booktraverse.com"` and no UTMs, referrer, or landing page, so
 * "how did this owner find us" was unanswerable for every lead. These cover the
 * cases that actually occur in the wild, especially the organic one, where
 * middleware writes no attribution cookie at all and the referrer is the only
 * signal that exists.
 *
 * The suite runs in the default `node` environment (no jsdom dependency), so it
 * stubs only the four browser globals getLeadAttribution() touches.
 */

const ORIGIN = "https://www.booktraverse.com";

function browser({
  cookies = {},
  referrer = "",
  pathname = "/property-management",
  userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
}: {
  cookies?: Record<string, unknown>;
  referrer?: string;
  pathname?: string;
  userAgent?: string;
} = {}) {
  const cookie = Object.entries(cookies)
    .map(
      ([k, v]) =>
        `${k}=${encodeURIComponent(typeof v === "string" ? v : JSON.stringify(v))}`
    )
    .join("; ");

  vi.stubGlobal("document", { cookie, referrer });
  vi.stubGlobal("window", {
    location: { pathname, hostname: "www.booktraverse.com", origin: ORIGIN },
  });
  vi.stubGlobal("navigator", { userAgent });
}

describe("getLeadAttribution", () => {
  beforeEach(() => browser());
  afterEach(() => vi.unstubAllGlobals());

  it("captures last-touch campaign params", () => {
    browser({
      cookies: {
        _sp_attribution: {
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "owner-acquisition",
          gclid: "abc123",
          landingPage: "/property-management?utm_source=google",
        },
      },
    });

    const a = getLeadAttribution();

    expect(a.utmSource).toBe("google");
    expect(a.utmMedium).toBe("cpc");
    expect(a.utmCampaign).toBe("owner-acquisition");
    expect(a.gclid).toBe("abc123");
    expect(a.landingPage).toBe("/property-management?utm_source=google");
  });

  it("keeps first touch distinct from last touch", () => {
    // Owners research for weeks; the converting visit is rarely the one that
    // found us. Collapsing these would credit the wrong channel.
    browser({
      cookies: {
        _sp_first_touch: {
          utm_source: "facebook",
          utm_medium: "social",
          landingPage: "/blog/crested-butte-vacation-rental-income",
          capturedAt: "2026-07-01T10:00:00.000Z",
        },
        _sp_attribution: { utm_source: "google", utm_medium: "cpc" },
      },
    });

    const a = getLeadAttribution();

    expect(a.firstTouchSource).toBe("facebook");
    expect(a.firstTouchLandingPage).toBe(
      "/blog/crested-butte-vacation-rental-income"
    );
    expect(a.firstTouchAt).toBe("2026-07-01T10:00:00.000Z");
    expect(a.utmSource).toBe("google"); // last touch unchanged
  });

  it("falls back to the referrer when there is NO attribution cookie", () => {
    // The common owner path: organic Google search. Middleware only writes
    // _sp_attribution when a UTM/click param is present, so this visitor has
    // no cookie and the referrer is the only acquisition signal available.
    browser({ referrer: "https://www.google.com/" });

    const a = getLeadAttribution();

    expect(a.utmSource).toBeUndefined();
    expect(a.referrer).toBe("https://www.google.com/");
    expect(a.submittedFrom).toBe("/property-management");
  });

  it("ignores a same-origin referrer", () => {
    // Internal navigation says nothing about acquisition and would otherwise
    // make every lead look like it came from our own site.
    browser({ referrer: `${ORIGIN}/blog/some-post` });

    expect(getLeadAttribution().referrer).toBeUndefined();
  });

  it("omits empty keys entirely", () => {
    const a = getLeadAttribution();

    expect(Object.prototype.hasOwnProperty.call(a, "utmSource")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(a, "gclid")).toBe(false);
    // Always-present context still comes through.
    expect(a.deviceType).toBeDefined();
    expect(a.submittedFrom).toBe("/property-management");
  });

  it("survives a malformed cookie rather than throwing", () => {
    // A throw here would break form submission — losing the lead entirely,
    // which is far worse than losing its attribution.
    vi.stubGlobal("document", {
      cookie: "_sp_attribution=%7Bnot-json",
      referrer: "",
    });

    expect(() => getLeadAttribution()).not.toThrow();
    expect(getLeadAttribution().utmSource).toBeUndefined();
  });
});
