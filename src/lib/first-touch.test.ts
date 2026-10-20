import { describe, expect, it } from "vitest";
import {
  buildUntaggedFirstTouch,
  externalReferrer,
  isLandingRequest,
} from "./first-touch";

const now = new Date("2026-10-19T10:00:00.000Z");

describe("isLandingRequest", () => {
  it("accepts pages", () => {
    expect(isLandingRequest("/")).toBe(true);
    expect(isLandingRequest("/crested-butte/grand-lodge")).toBe(true);
  });

  // The proxy matcher lets API routes through; an API call is not an arrival,
  // and recording one would put "/api/listings/abc" in the digest as if the
  // guest had chosen to visit it.
  it("rejects API and internal requests", () => {
    expect(isLandingRequest("/api/listings/abc")).toBe(false);
    expect(isLandingRequest("/_next/data/x.json")).toBe(false);
  });
});

describe("externalReferrer", () => {
  it("keeps the site that sent them", () => {
    expect(
      externalReferrer("https://www.google.com/", "www.booktraverse.com")
    ).toBe("https://www.google.com");
  });

  // A search-engine referrer can carry the typed query, and sometimes more.
  it("drops the query string", () => {
    expect(
      externalReferrer(
        "https://duckduckgo.com/?q=crested+butte+condo+jane%40example.com",
        "www.booktraverse.com"
      )
    ).toBe("https://duckduckgo.com");
  });

  it("ignores our own pages — that is navigation, not acquisition", () => {
    expect(
      externalReferrer(
        "https://www.booktraverse.com/properties/abc",
        "www.booktraverse.com"
      )
    ).toBeUndefined();
  });

  it("returns nothing for a missing or malformed referrer", () => {
    expect(externalReferrer(null, "www.booktraverse.com")).toBeUndefined();
    expect(externalReferrer("", "www.booktraverse.com")).toBeUndefined();
    expect(externalReferrer("javascript:void(0)", "x")).toBeUndefined();
  });

  it("caps a hostile referrer length", () => {
    const long = `https://evil.example/${"a".repeat(5000)}`;
    expect(externalReferrer(long, "www.booktraverse.com")!.length).toBe(200);
  });
});

describe("buildUntaggedFirstTouch", () => {
  it("records the entry page and where they came from", () => {
    expect(
      buildUntaggedFirstTouch({
        pathname: "/crested-butte/grand-lodge",
        search: "?checkIn=2026-12-01",
        referer: "https://www.google.com/",
        selfHost: "www.booktraverse.com",
        now,
      })
    ).toEqual({
      landingPage: "/crested-butte/grand-lodge?checkIn=2026-12-01",
      capturedAt: "2026-10-19T10:00:00.000Z",
      referrer: "https://www.google.com",
    });
  });

  // A truly direct visit still gets a landing page — that alone answers most
  // of what the digest could not say before.
  it("omits the referrer key rather than writing an empty one", () => {
    const touch = buildUntaggedFirstTouch({
      pathname: "/",
      search: "",
      referer: null,
      selfHost: "www.booktraverse.com",
      now,
    });
    expect(touch).toEqual({
      landingPage: "/",
      capturedAt: "2026-10-19T10:00:00.000Z",
    });
    expect("referrer" in touch!).toBe(false);
  });

  it("records nothing for a request that is not an arrival", () => {
    expect(
      buildUntaggedFirstTouch({
        pathname: "/api/payment-intent",
        search: "",
        referer: "https://www.google.com/",
        selfHost: "www.booktraverse.com",
        now,
      })
    ).toBeNull();
  });
});
