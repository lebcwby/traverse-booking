import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetClientIpCacheForTests } from "./client-ip-discovery";
import {
  trackBookingCompleted,
  trackStartedCheckout,
  trackViewedListing,
} from "./tracking";

const storage = new Map<string, string>();

// Stub Response: every endpoint (including api64.ipify.org) returns valid JSON
// so the IP discovery chain inside getDiscoveredClientIp resolves cleanly
// instead of throwing on `res.json()`.
const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ ip: "203.0.113.42" }),
}));

async function flushAllPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
const gtagMock = vi.fn();
const fbqMock = vi.fn();
const klaviyoTrackMock = vi.fn(async () => {});
const klaviyoIdentifyMock = vi.fn(async () => {});

function resetBrowserState() {
  storage.clear();
  fetchMock.mockClear();
  gtagMock.mockClear();
  fbqMock.mockClear();
  klaviyoTrackMock.mockClear();
  klaviyoIdentifyMock.mockClear();

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: { cookie: "" },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      location: { href: "https://booktraverse.com/properties/test-listing" },
      navigator: { globalPrivacyControl: false },
      gtag: gtagMock,
      fbq: fbqMock,
      dataLayer: [] as Record<string, unknown>[],
      klaviyo: {
        track: klaviyoTrackMock,
        identify: klaviyoIdentifyMock,
      },
    },
  });

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
}

describe("tracking", () => {
  beforeEach(() => {
    resetBrowserState();
    _resetClientIpCacheForTests();
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE;
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL;
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends listing analytics without marketing side effects when only analytics consent is granted", () => {
    document.cookie = "_sp_consent=a=1&m=0";

    trackViewedListing({
      id: "listing_123",
      title: "Test Listing",
      basePrice: 250,
      propertyType: "House",
      city: "Portland",
    });

    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "view_item",
      expect.any(Object)
    );
    expect(fbqMock).not.toHaveBeenCalled();
    expect(klaviyoTrackMock).not.toHaveBeenCalled();
    // Behavior tracking (first-party analytics) still fires, but no marketing server calls
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/track/viewed-listing",
      expect.any(Object)
    );
  });

  it("sends marketing listing events and server-side fanout only when marketing consent is granted", async () => {
    // _fbp cookie present → waitForPixelAndFbp resolves immediately
    document.cookie = "_sp_consent=a=0&m=1; _fbp=fb.1.1700000000.1234567890";

    trackViewedListing({
      id: "listing_123",
      title: "Test Listing",
      basePrice: 250,
      propertyType: "House",
      city: "Portland",
    });

    // Flush the full chain: waitForPixelAndFbp → ipify discovery → CAPI fetch.
    // setTimeout(0) lets every microtask in the chain settle before asserting.
    await flushAllPromises();

    expect(gtagMock).not.toHaveBeenCalled();
    expect(fbqMock).toHaveBeenCalledWith(
      "track",
      "ViewContent",
      expect.objectContaining({
        content_ids: ["listing_123"],
        currency: "USD",
      }),
      expect.objectContaining({
        eventID: expect.stringContaining("view_"),
      })
    );
    expect(klaviyoTrackMock).toHaveBeenCalledWith(
      "Viewed Listing",
      expect.objectContaining({
        ID: "listing_123",
        ListingCity: "Portland",
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/track/viewed-listing",
      expect.objectContaining({
        method: "POST",
      })
    );

    // The discovered ipify IP must reach the CAPI body so the server can forward
    // it as client_ip_address. Otherwise we regress to the IPv4-only x-forwarded-for
    // path and Meta's "client IPs don't match dataset" error returns.
    const calls = fetchMock.mock.calls as unknown as Array<
      [string, { body: string }]
    >;
    const viewedListingCall = calls.find(
      (call) => call[0] === "/api/track/viewed-listing"
    );
    expect(viewedListingCall).toBeDefined();
    const body = JSON.parse(viewedListingCall![1].body) as {
      clientIp?: string;
    };
    expect(body.clientIp).toBe("203.0.113.42");
  });

  it("ignores Global Privacy Control — SP below CCPA thresholds, GPC intentionally not honored", async () => {
    document.cookie = "_sp_consent=a=1&m=1; _fbp=fb.1.1700000000.1234567890";
    (
      window.navigator as Navigator & { globalPrivacyControl?: boolean }
    ).globalPrivacyControl = true;

    trackStartedCheckout({
      listingId: "listing_123",
      listingTitle: "Test Listing",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      total: 500,
      propertyType: "House",
    });

    // Flush waitForPixelAndFbp().then() microtasks before asserting
    await new Promise((r) => setTimeout(r, 10));

    // Marketing tracking still fires despite GPC — see src/lib/consent.ts
    expect(fbqMock).toHaveBeenCalledWith(
      "track",
      "InitiateCheckout",
      expect.any(Object),
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/track/checkout-started",
      expect.any(Object)
    );
  });

  it("omits incomplete enhanced conversion address data for booking conversions", () => {
    document.cookie = "_sp_consent=a=1&m=1";

    trackBookingCompleted({
      listingId: "listing_123",
      listingTitle: "Test Listing",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      total: 500,
      reservationId: "res_123",
      guestEmail: "Guest@example.com ",
      guestPhone: "(503) 555-1234",
      guestFirstName: "Jane",
      guestLastName: "Doe",
    });

    expect(gtagMock).toHaveBeenCalledWith("set", "user_data", {
      email: "guest@example.com",
      phone_number: "+15035551234",
    });
    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "conversion",
      expect.objectContaining({
        send_to: "AW-16519101211/ie2vCLzmhZUbEJv29cQ9",
        transaction_id: "res_123",
      })
    );
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "booking_completed",
        transaction_id: "res_123",
        enhanced_conversion_data: {
          email: "guest@example.com",
          phone_number: "+15035551234",
        },
      })
    );
  });

  it("still queues the GTM booking backup when standalone gtag is unavailable", () => {
    document.cookie = "_sp_consent=a=1&m=1";
    window.gtag = undefined;

    trackBookingCompleted({
      listingId: "listing_123",
      listingTitle: "Test Listing",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      total: 500,
      reservationId: "res_456",
      guestEmail: "guest@example.com",
    });

    expect(gtagMock).not.toHaveBeenCalled();
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "booking_completed",
        transaction_id: "res_456",
      })
    );
  });

  it("fires client Google Ads conversion even when server mode is enabled (belt-and-suspenders, deduped on transaction_id)", () => {
    document.cookie = `${"_sp_consent=a=1&m=1; _sp_attribution="}${encodeURIComponent(JSON.stringify({ gclid: "test-gclid" }))}`;
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE = "server";

    trackBookingCompleted({
      listingId: "listing_123",
      listingTitle: "Test Listing",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guests: 2,
      total: 500,
      reservationId: "res_server_mode",
      guestEmail: "guest@example.com",
    });

    expect(gtagMock).toHaveBeenCalledWith(
      "event",
      "conversion",
      expect.objectContaining({
        transaction_id: "res_server_mode",
      })
    );
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "booking_completed",
        transaction_id: "res_server_mode",
      })
    );
  });
});
