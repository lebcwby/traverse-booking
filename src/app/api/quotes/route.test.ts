import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The known-listing gate on POST /api/quotes.
 *
 * This route is public and unauthenticated and used to forward any listingId
 * to Guesty. A delisted id came back 403, which raised a "BEAPI 403 Forbidden"
 * ops email that could not name the listing it was about — see the
 * 2026-10-11 06:17 alert.
 *
 * The gate must never block a real booking, so every lookup failure falls
 * open to the old behaviour.
 */

const { mockCreateQuote, mockGetListings } = vi.hoisted(() => ({
  mockCreateQuote: vi.fn(),
  mockGetListings: vi.fn(),
}));

vi.mock("@/lib/guesty-beapi", () => ({ createQuote: mockCreateQuote }));
vi.mock("@/lib/supabase", () => ({ getListings: mockGetListings }));
vi.mock("@/lib/beapi-error", () => ({
  classifyBeapiError: () => ({
    message: "beapi failed",
    code: "BEAPI_ERROR",
    status: 502,
  }),
}));

const LIVE = "66576dd555d70f001bf1ae83";
const DELISTED = "5f31f77827046e002d00ba29";

function req(listingId: string) {
  return new Request("https://www.booktraverse.com/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      listingId,
      checkIn: "2027-02-10",
      checkOut: "2027-02-12",
      guestsCount: 2,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

async function post(listingId: string) {
  const { POST } = await import("./route");
  return POST(req(listingId));
}

describe("POST /api/quotes — known-listing gate", () => {
  beforeEach(() => {
    vi.resetModules(); // the id cache is module-level
    mockCreateQuote.mockReset().mockResolvedValue({ _id: "quote_1" });
    mockGetListings
      .mockReset()
      .mockResolvedValue([{ guesty_id: LIVE, title: "Live listing" }]);
  });
  afterEach(() => vi.clearAllMocks());

  it("quotes a live listing", async () => {
    const res = await post(LIVE);
    expect(res.status).toBe(200);
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
  });

  it("404s a delisted listing without ever calling Guesty", async () => {
    const res = await post(DELISTED);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      code: "LISTING_NOT_FOUND",
    });
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  it("still rejects a request missing required fields", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("https://www.booktraverse.com/api/quotes", {
        method: "POST",
        body: JSON.stringify({ listingId: LIVE }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );
    expect(res.status).toBe(400);
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  // Fail-open: a lookup problem must never cost us a booking.
  it("falls open to Guesty when the mirror throws", async () => {
    mockGetListings.mockRejectedValue(new Error("supabase down"));
    const res = await post(DELISTED);
    expect(res.status).toBe(200);
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
  });

  it("falls open when the mirror returns an empty set", async () => {
    // Empty means unreadable, not "we have no listings" — 404ing the whole
    // catalogue would take the site down for bookings.
    mockGetListings.mockResolvedValue([]);
    const res = await post(LIVE);
    expect(res.status).toBe(200);
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
  });

  it("caches the id set instead of reloading it per request", async () => {
    const { POST } = await import("./route");
    await POST(req(LIVE));
    await POST(req(LIVE));
    await POST(req(LIVE));
    expect(mockGetListings).toHaveBeenCalledTimes(1);
    expect(mockCreateQuote).toHaveBeenCalledTimes(3);
  });
});
