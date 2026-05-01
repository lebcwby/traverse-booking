import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/meta-visitor-store", () => ({
  lookupMetaVisitor: vi.fn().mockResolvedValue(null),
}));

import { buildServerEventContext } from "./track-request";

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://www.booktraverse.com/api/track/page-view", {
    headers,
  });
}

describe("buildServerEventContext zip resolution", () => {
  it("uses Vercel postal-code header when present", async () => {
    const req = makeRequest({
      "x-vercel-ip-postal-code": "97214",
      "x-vercel-ip-latitude": "45.5152",
      "x-vercel-ip-longitude": "-122.6784",
    });
    const ctx = await buildServerEventContext(req);
    expect(ctx.zip).toBe("97214");
  });

  it("falls back to lat/lon when postal-code is missing", async () => {
    const req = makeRequest({
      "x-vercel-ip-latitude": "45.5152",
      "x-vercel-ip-longitude": "-122.6784",
    });
    const ctx = await buildServerEventContext(req);
    expect(ctx.zip).toMatch(/^972/);
  });

  it("falls back to lat/lon when postal-code is empty string", async () => {
    const req = makeRequest({
      "x-vercel-ip-postal-code": "",
      "x-vercel-ip-latitude": "40.758",
      "x-vercel-ip-longitude": "-73.9855",
    });
    const ctx = await buildServerEventContext(req);
    expect(ctx.zip).toMatch(/^100/);
  });

  it("returns undefined zip when neither postal-code nor lat/lon are present", async () => {
    const req = makeRequest({
      "x-vercel-ip-city": "Portland",
      "x-vercel-ip-country-region": "OR",
    });
    const ctx = await buildServerEventContext(req);
    expect(ctx.zip).toBeUndefined();
  });
});
