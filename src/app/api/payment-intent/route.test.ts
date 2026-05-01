import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockBuildStripeIdempotencyKey,
  mockCustomersList,
  mockCustomersCreate,
  mockPaymentIntentRetrieve,
  mockPaymentIntentUpdate,
  mockPaymentIntentCreate,
  mockGetQuote,
  mockGetUpsellTotal,
  mockFindBlockingPendingCheckout,
  mockFindLatestReusablePendingCheckout,
  mockGetPendingCheckout,
  mockUpsertPendingCheckout,
  mockGetListing,
} = vi.hoisted(() => ({
  mockBuildStripeIdempotencyKey: vi.fn(),
  mockCustomersList: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockPaymentIntentRetrieve: vi.fn(),
  mockPaymentIntentUpdate: vi.fn(),
  mockPaymentIntentCreate: vi.fn(),
  mockGetQuote: vi.fn(),
  mockGetUpsellTotal: vi.fn(),
  mockFindBlockingPendingCheckout: vi.fn(),
  mockFindLatestReusablePendingCheckout: vi.fn(),
  mockGetPendingCheckout: vi.fn(),
  mockUpsertPendingCheckout: vi.fn(),
  mockGetListing: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  buildStripeIdempotencyKey: mockBuildStripeIdempotencyKey,
  getStripeServer: () => ({
    customers: {
      list: mockCustomersList,
      create: mockCustomersCreate,
    },
    paymentIntents: {
      retrieve: mockPaymentIntentRetrieve,
      update: mockPaymentIntentUpdate,
      create: mockPaymentIntentCreate,
    },
  }),
}));

vi.mock("@/lib/guesty-beapi", () => ({
  getQuote: mockGetQuote,
}));

vi.mock("@/lib/upsells", () => ({
  getUpsellTotal: mockGetUpsellTotal,
}));

vi.mock("@/lib/pending-checkouts", () => ({
  findBlockingPendingCheckout: mockFindBlockingPendingCheckout,
  findLatestReusablePendingCheckout: mockFindLatestReusablePendingCheckout,
  getPendingCheckout: mockGetPendingCheckout,
  upsertPendingCheckout: mockUpsertPendingCheckout,
}));

vi.mock("@/lib/supabase", () => ({
  getListing: mockGetListing,
}));

vi.mock("@/lib/booking-identity", () => ({
  normalizeGuestEmail: (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "",
  normalizeGuestPhone: (value: unknown) =>
    typeof value === "string" ? value.replace(/\D/g, "") : "",
}));

import { PATCH, POST } from "./route";

// Test requests don't set any cookies/headers, so extractTrackingContext()
// always produces the all-undefined shape below. Asserted explicitly so any
// regression in cookie/header extraction surfaces as a test diff.
const EMPTY_TRACKING_CONTEXT = {
  cookies: {
    attribution: undefined,
    firstTouch: undefined,
    ga: undefined,
    gaSession: undefined,
    consent: undefined,
    legacyCcpaOptOut: undefined,
    fbp: undefined,
    fbc: undefined,
  },
  requestContext: {
    clientIp: undefined,
    clientUserAgent: undefined,
  },
};

describe("POST /api/payment-intent", () => {
  beforeEach(() => {
    mockBuildStripeIdempotencyKey.mockReturnValue("idem_key_create_pi");
    mockCustomersList.mockResolvedValue({ data: [] });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_existing",
      status: "requires_payment_method",
      client_secret: "pi_existing_secret",
      metadata: {
        quoteId: "quote_123",
        guestEmail: "guest@example.com",
      },
    });
    mockPaymentIntentUpdate.mockResolvedValue({
      id: "pi_existing",
      client_secret: "pi_existing_secret",
    });
    mockPaymentIntentCreate.mockResolvedValue({
      id: "pi_new",
      client_secret: "pi_new_secret",
    });
    mockGetQuote.mockResolvedValue({
      unitTypeId: "listing_1",
      checkInDateLocalized: "2026-04-20",
      checkOutDateLocalized: "2026-04-23",
      guestsCount: 2,
      rates: {
        ratePlans: [
          {
            ratePlan: {
              _id: "rate_plan_1",
              money: {
                hostPayout: 57.93,
              },
            },
          },
        ],
      },
    });
    mockGetUpsellTotal.mockReturnValue(25);
    mockFindBlockingPendingCheckout.mockResolvedValue(null);
    mockFindLatestReusablePendingCheckout.mockResolvedValue(null);
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: "cus_existing",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
      },
      upsells: [],
      pets: 0,
      status: "pending",
    });
    mockUpsertPendingCheckout.mockResolvedValue(undefined);
    mockGetListing.mockResolvedValue({
      title: "Test Home",
      nickname: "Test Home",
      picture: "https://example.com/home.jpg",
      property_type: "house",
      address: { city: "Portland" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("blocks a new payment intent when a paid pending reservation already exists", async () => {
    mockFindBlockingPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_blocked",
      status: "paid_pending_reservation",
    });

    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "POST",
      body: JSON.stringify({
        quoteId: "quote_123",
        guestEmail: "Guest@Example.com",
        guestPhone: "(503) 555-1212",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(409);
    expect(mockFindBlockingPendingCheckout).toHaveBeenCalledWith({
      quoteId: "quote_123",
      listingId: "listing_1",
      checkIn: "2026-04-20",
      checkOut: "2026-04-23",
    });
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error:
        "A payment for this booking was already received and your reservation is still being finalized. Please do not retry. Our team has been notified.",
      pendingRecovery: true,
      pendingPaymentIntentId: "pi_blocked",
    });
  });

  it("reuses and updates the latest pending payment intent when Stripe allows it", async () => {
    mockFindLatestReusablePendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_existing",
      stripeCustomerId: "cus_existing",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingTitle: "Older Title",
        picture: null,
        propertyType: null,
        city: null,
        guests: 1,
      },
    });

    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "POST",
      body: JSON.stringify({
        quoteId: "quote_123",
        guestEmail: "Guest@Example.com",
        guestPhone: "(503) 555-1212",
        upsellIds: ["late-checkout", "pet-fee"],
        pets: 2,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPaymentIntentRetrieve).toHaveBeenCalledWith("pi_existing");
    expect(mockPaymentIntentUpdate).toHaveBeenCalledWith("pi_existing", {
      amount: 28093,
      customer: "cus_existing",
      metadata: {
        quoteId: "quote_123",
        guestEmail: "guest@example.com",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        baseAmountCents: "5793",
        upsellIds: "late-checkout,pet-fee",
        pets: "2",
        petFeeAmountCents: "19800",
      },
    });
    expect(mockUpsertPendingCheckout).toHaveBeenCalledWith({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: "cus_existing",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 280.93,
      },
      upsells: ["late-checkout"],
      pets: 2,
      quoteSnapshot: {
        quoteId: "quote_123",
        ratePlanId: "rate_plan_1",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 280.93,
      },
      trackingContext: EMPTY_TRACKING_CONTEXT,
    });
    await expect(response.json()).resolves.toEqual({
      clientSecret: "pi_existing_secret",
      paymentIntentId: "pi_existing",
      stripeCustomerId: "cus_existing",
    });
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled();
  });

  it("creates a new payment intent with normalized metadata and idempotency key", async () => {
    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "POST",
      body: JSON.stringify({
        quoteId: "quote_123",
        guestEmail: " Guest@Example.com ",
        guestPhone: "(503) 555-1212",
        upsellIds: ["late-checkout", "pet-fee"],
        pets: 1,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCustomersList).not.toHaveBeenCalled();
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockBuildStripeIdempotencyKey).toHaveBeenCalledWith(
      "payment_intent_create",
      {
        quoteId: "quote_123",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        totalAmountCents: 18193,
        upsellIds: ["late-checkout"],
        pets: 1,
      }
    );
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      {
        amount: 18193,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          quoteId: "quote_123",
          listingId: "listing_1",
          checkIn: "2026-04-20",
          checkOut: "2026-04-23",
          baseAmountCents: "5793",
          upsellIds: "late-checkout,pet-fee",
          pets: "1",
          petFeeAmountCents: "9900",
        },
      },
      {
        idempotencyKey: "idem_key_create_pi",
      }
    );
    expect(mockUpsertPendingCheckout).toHaveBeenCalledWith({
      paymentIntentId: "pi_new",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: null,
      guest: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 181.93,
      },
      upsells: ["late-checkout"],
      pets: 1,
      quoteSnapshot: {
        quoteId: "quote_123",
        ratePlanId: "rate_plan_1",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 181.93,
      },
      trackingContext: EMPTY_TRACKING_CONTEXT,
    });
    await expect(response.json()).resolves.toEqual({
      clientSecret: "pi_new_secret",
      paymentIntentId: "pi_new",
      stripeCustomerId: null,
    });
  });
});

describe("PATCH /api/payment-intent", () => {
  beforeEach(() => {
    mockGetUpsellTotal.mockReturnValue(25);
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: "cus_existing",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
      },
      upsells: [],
      pets: 0,
      status: "pending",
    });
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_existing",
      status: "requires_payment_method",
      customer: "cus_existing",
      amount: 5793,
      metadata: {
        quoteId: "quote_123",
        guestEmail: "guest@example.com",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        baseAmountCents: "5793",
      },
    });
    mockPaymentIntentUpdate.mockResolvedValue(undefined);
    mockUpsertPendingCheckout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires a paymentIntentId", async () => {
    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "PATCH",
      body: JSON.stringify({ upsellIds: ["late-checkout"] }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "paymentIntentId is required",
    });
  });

  it("rejects updates when the Stripe payment intent is no longer editable", async () => {
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_existing",
      status: "succeeded",
      metadata: {
        baseAmountCents: "5793",
      },
    });

    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "PATCH",
      body: JSON.stringify({
        paymentIntentId: "pi_existing",
        upsellIds: ["late-checkout"],
        pets: 1,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mockPaymentIntentUpdate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Payment intent cannot be updated in its current state",
    });
  });

  it("updates the Stripe amount and pending checkout snapshot for upsell and pet changes", async () => {
    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "PATCH",
      body: JSON.stringify({
        paymentIntentId: "pi_existing",
        upsellIds: ["late-checkout", "pet-fee"],
        pets: 2,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(mockPaymentIntentRetrieve).toHaveBeenCalledWith("pi_existing");
    expect(mockPaymentIntentUpdate).toHaveBeenCalledWith("pi_existing", {
      amount: 28093,
      metadata: {
        upsellIds: "late-checkout,pet-fee",
        pets: "2",
        petFeeAmountCents: "19800",
      },
    });
    expect(mockGetPendingCheckout).toHaveBeenCalledWith("pi_existing");
    expect(mockUpsertPendingCheckout).toHaveBeenCalledWith({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: "cus_existing",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 280.93,
      },
      upsells: ["late-checkout"],
      pets: 2,
      trackingContext: EMPTY_TRACKING_CONTEXT,
    });
    await expect(response.json()).resolves.toEqual({
      amount: 280.93,
      stripeCustomerId: "cus_existing",
    });
  });

  it("attaches guest identity to an existing payment intent without reminting it", async () => {
    mockGetPendingCheckout.mockResolvedValue({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: null,
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "",
        phone: "",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
      },
      upsells: [],
      pets: 0,
      status: "pending",
    });
    mockPaymentIntentRetrieve.mockResolvedValue({
      id: "pi_existing",
      status: "requires_payment_method",
      customer: null,
      amount: 5793,
      metadata: {
        quoteId: "quote_123",
        listingId: "listing_1",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        baseAmountCents: "5793",
      },
    });
    mockCustomersList.mockResolvedValue({ data: [] });
    mockCustomersCreate.mockResolvedValue({ id: "cus_new" });

    const request = new NextRequest("http://localhost/api/payment-intent", {
      method: "PATCH",
      body: JSON.stringify({
        paymentIntentId: "pi_existing",
        guestEmail: " Guest@Example.com ",
        guestPhone: "(503) 555-1212",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(mockCustomersList).toHaveBeenCalledWith({
      email: "guest@example.com",
      limit: 1,
    });
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "guest@example.com",
      phone: "5035551212",
      metadata: {
        quoteId: "quote_123",
        source: "book-traverse",
      },
    });
    expect(mockPaymentIntentUpdate).toHaveBeenCalledWith("pi_existing", {
      customer: "cus_new",
      receipt_email: "guest@example.com",
      metadata: {
        guestEmail: "guest@example.com",
        guestPhone: "5035551212",
      },
    });
    expect(mockUpsertPendingCheckout).toHaveBeenCalledWith({
      paymentIntentId: "pi_existing",
      quoteId: "quote_123",
      ratePlanId: "rate_plan_1",
      stripeCustomerId: "cus_new",
      guest: {
        firstName: "Test",
        lastName: "Guest",
        email: "guest@example.com",
        phone: "5035551212",
      },
      tracking: {
        listingId: "listing_1",
        listingTitle: "Test Home",
        picture: "https://example.com/home.jpg",
        propertyType: "house",
        city: "Portland",
        checkIn: "2026-04-20",
        checkOut: "2026-04-23",
        guests: 2,
        stayTotal: 57.93,
        totalPaid: 57.93,
      },
      upsells: [],
      pets: 0,
      trackingContext: EMPTY_TRACKING_CONTEXT,
    });
    await expect(response.json()).resolves.toEqual({
      amount: 57.93,
      stripeCustomerId: "cus_new",
    });
  });
});
