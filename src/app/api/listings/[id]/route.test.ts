import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetListingDetail } = vi.hoisted(() => ({
  mockGetListingDetail: vi.fn(),
}));

vi.mock("@/lib/guesty-beapi", () => ({
  getListingDetail: mockGetListingDetail,
}));

import { GET } from "./route";

const VALID = "63b7080c04bd5e0058e7fcf1";
const req = () => new NextRequest("http://localhost/api/listings/x");
const call = (id: string) => GET(req(), { params: Promise.resolve({ id }) });

beforeEach(() => {
  mockGetListingDetail.mockReset().mockResolvedValue({ _id: VALID });
});

describe("GET /api/listings/[id]", () => {
  // This endpoint plus /properties/[id] produced 97% of terminal BEAPI 429s.
  // An id that cannot exist must not cost a Guesty call to find that out.
  it("rejects a malformed id without calling Guesty", async () => {
    for (const bad of [
      "nope",
      "",
      "../admin",
      VALID + "x",
      VALID.toUpperCase(),
    ]) {
      const res = await call(bad);
      expect(res.status, bad).toBe(400);
    }
    expect(mockGetListingDetail).not.toHaveBeenCalled();
  });

  it("serves a valid id and caches it at the CDN", async () => {
    const res = await call(VALID);
    expect(res.status).toBe(200);
    expect(mockGetListingDetail).toHaveBeenCalledWith(VALID);
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
  });

  // A transient Guesty 429 pinned at the CDN for an hour would look like a
  // dead listing to every visitor behind it.
  it("never caches a failure", async () => {
    mockGetListingDetail.mockRejectedValue(new Error("BEAPI 429"));
    const res = await call(VALID);
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("does not cache the rejection of a bad id either", async () => {
    const res = await call("nope");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
