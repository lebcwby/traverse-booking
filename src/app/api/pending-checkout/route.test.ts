import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetPendingCheckout,
  mockUpsertPendingCheckout,
  mockCreateLookupToken,
  mockVerifyLookupToken,
} = vi.hoisted(() => ({
  mockGetPendingCheckout: vi.fn(),
  mockUpsertPendingCheckout: vi.fn(),
  mockCreateLookupToken: vi.fn(),
  mockVerifyLookupToken: vi.fn(),
}));

vi.mock("@/lib/pending-checkouts", () => ({
  getPendingCheckout: mockGetPendingCheckout,
  upsertPendingCheckout: mockUpsertPendingCheckout,
}));

vi.mock("@/lib/pending-checkout-token", () => ({
  createPendingCheckoutLookupToken: mockCreateLookupToken,
  verifyPendingCheckoutLookupToken: mockVerifyLookupToken,
}));

import { GET, POST } from "./route";

describe("/api/pending-checkout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires a valid signed lookup token on GET", async () => {
    mockVerifyLookupToken.mockReturnValue(false);

    const request = new NextRequest(
      "http://localhost/api/pending-checkout?paymentIntentId=pi_123&token=bad",
      {
        method: "GET",
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the pending checkout when the signed token is valid", async () => {
    mockVerifyLookupToken.mockReturnValue(true);
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_123",
      quoteId: "quote_123",
      ratePlanId: "rate_123",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "",
      },
      tracking: { listingId: "listing_1" },
      upsells: [],
      pets: 0,
      status: "pending",
      reservationId: null,
      lastError: null,
      completedAt: null,
    });

    const request = new NextRequest(
      "http://localhost/api/pending-checkout?paymentIntentId=pi_123&token=good",
      {
        method: "GET",
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      paymentIntentId: "pi_123",
      quoteId: "quote_123",
      ratePlanId: "rate_123",
      status: "pending",
    });
  });

  it("saves a pending checkout and returns a signed lookup token on POST", async () => {
    mockCreateLookupToken.mockReturnValue("lookup_token");

    const request = new NextRequest("http://localhost/api/pending-checkout", {
      method: "POST",
      body: JSON.stringify({
        paymentIntentId: "pi_123",
        quoteId: "quote_123",
        guest: {
          firstName: "Test",
          lastName: "Guest",
          email: "guest@example.com",
          phone: "5035551212",
        },
        tracking: {
          listingId: "listing_1",
        },
        upsells: ["late-checkout"],
        pets: 1,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockUpsertPendingCheckout).toHaveBeenCalledWith({
      paymentIntentId: "pi_123",
      quoteId: "quote_123",
      ratePlanId: null,
      stripeCustomerId: null,
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
      },
      upsells: ["late-checkout"],
      pets: 1,
      quoteSnapshot: null,
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      lookupToken: "lookup_token",
    });
  });
});
