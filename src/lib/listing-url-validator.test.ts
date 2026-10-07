import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  __resetListingIdCacheForTests,
  validateListingUrl,
} from "./listing-url-validator";

const REAL_ID = "63b72b72057301004df33bf4";
const DEAD_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

function req(path: string) {
  return new NextRequest(`https://www.booktraverse.com${path}`);
}

function mockIdsEndpoint(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
) {
  return vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("validateListingUrl", () => {
  beforeEach(() => {
    __resetListingIdCacheForTests();
    vi.stubGlobal("fetch", mockIdsEndpoint({ ids: [REAL_ID] }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ignores paths that are not a single listing segment", async () => {
    for (const p of ["/properties", "/properties/", "/", "/crested-butte"]) {
      expect(await validateListingUrl(req(p))).toBeNull();
    }
  });

  it("ignores deeper paths under a listing", async () => {
    expect(
      await validateListingUrl(req(`/properties/${REAL_ID}/photos`))
    ).toBeNull();
  });

  it("lets a real listing through", async () => {
    expect(
      await validateListingUrl(req(`/properties/the-ice-palace-${REAL_ID}`))
    ).toBeNull();
  });

  it("lets a bare real id through, so the canonical redirect can still run", async () => {
    expect(await validateListingUrl(req(`/properties/${REAL_ID}`))).toBeNull();
  });

  // Gate 1 — no Guesty id at the end, so it cannot resolve. No lookup needed.
  it("404s a slug with no Guesty id", async () => {
    const res = await validateListingUrl(req("/properties/totally-made-up"));
    expect(res?.status).toBe(404);
    expect(res?.headers.get("x-listing-404")).toBe("shape");
    expect(res?.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("404s on shape without calling the ids endpoint at all", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const res = await validateListingUrl(req("/properties/nope"));
    expect(res?.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  // Gate 2 — the case that matters for the index: a delisted property.
  it("404s a well-formed id that no longer exists", async () => {
    const res = await validateListingUrl(
      req(`/properties/old-listing-${DEAD_ID}`)
    );
    expect(res?.status).toBe(404);
    expect(res?.headers.get("x-listing-404")).toBe("unknown-id");
  });

  // Failing open is the whole safety story: never 404 a live listing because
  // a lookup blipped.
  it("lets an unknown id through when the ids endpoint errors", async () => {
    vi.stubGlobal("fetch", mockIdsEndpoint({}, { ok: false, status: 503 }));
    expect(
      await validateListingUrl(req(`/properties/x-${DEAD_ID}`))
    ).toBeNull();
  });

  it("lets an unknown id through when the ids endpoint returns an empty list", async () => {
    vi.stubGlobal("fetch", mockIdsEndpoint({ ids: [] }));
    expect(
      await validateListingUrl(req(`/properties/x-${DEAD_ID}`))
    ).toBeNull();
  });

  it("lets an unknown id through when the fetch never resolves usefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch
    );
    expect(
      await validateListingUrl(req(`/properties/x-${DEAD_ID}`))
    ).toBeNull();
  });

  it("still 404s on shape even when the ids endpoint is down", async () => {
    vi.stubGlobal("fetch", mockIdsEndpoint({}, { ok: false, status: 503 }));
    const res = await validateListingUrl(req("/properties/garbage"));
    expect(res?.status).toBe(404);
  });

  it("caches the id set rather than refetching per request", async () => {
    const spy = mockIdsEndpoint({ ids: [REAL_ID] });
    vi.stubGlobal("fetch", spy);
    await validateListingUrl(req(`/properties/a-${REAL_ID}`));
    await validateListingUrl(req(`/properties/b-${REAL_ID}`));
    await validateListingUrl(req(`/properties/c-${REAL_ID}`));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps serving the last good set when a later refresh fails", async () => {
    await validateListingUrl(req(`/properties/a-${REAL_ID}`));
    vi.stubGlobal("fetch", mockIdsEndpoint({}, { ok: false, status: 500 }));
    // Still inside the TTL, so the cached set answers and the dead id 404s.
    const res = await validateListingUrl(req(`/properties/b-${DEAD_ID}`));
    expect(res?.status).toBe(404);
  });

  it("handles an uppercase-hex id as unmatched shape rather than a listing", async () => {
    // getListingSlug only ever emits lowercase hex; uppercase cannot be ours.
    const res = await validateListingUrl(
      req("/properties/AAAAAAAAAAAAAAAAAAAAAAAA")
    );
    expect(res?.status).toBe(404);
    expect(res?.headers.get("x-listing-404")).toBe("shape");
  });
});
