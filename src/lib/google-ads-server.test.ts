import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthorize, mockJwtConstructor } = vi.hoisted(() => {
  const authorize = vi.fn();
  return {
    mockAuthorize: authorize,
    mockJwtConstructor: vi.fn(),
  };
});

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: class MockJWT {
        constructor(options: unknown) {
          mockJwtConstructor(options);
        }

        authorize = mockAuthorize;
      },
    },
  },
}));

import { uploadGoogleAdsPurchaseConversion } from "./google-ads-server";

const fetchMock = vi.fn();

describe("uploadGoogleAdsPurchaseConversion", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockAuthorize.mockReset();
    mockJwtConstructor.mockClear();

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE = "server";
    process.env.GOOGLE_ADS_CUSTOMER_ID = "123-456-7890";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer-token";
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "098-765-4321";
    process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID = "987654321";
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_EMAIL =
      "service-account@example.com";
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE;
    delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID;
    delete process.env.GOOGLE_ADS_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_ADS_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("uploads the purchase conversion with gclid, order ID, and consent", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: true,
      currency: "USD",
      gclid: "test-gclid",
      occurredAt: new Date("2026-03-30T12:34:56.000Z"),
      reservationId: "res_123",
      value: 456.78,
    });

    expect(mockJwtConstructor).toHaveBeenCalledWith({
      email: "service-account@example.com",
      key: "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
      scopes: ["https://www.googleapis.com/auth/adwords"],
    });
    expect(mockAuthorize).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://googleads.googleapis.com/v23/customers/1234567890:uploadClickConversions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "developer-token": "developer-token",
          "login-customer-id": "0987654321",
        }),
        body: JSON.stringify({
          conversions: [
            {
              gclid: "test-gclid",
              conversionAction:
                "customers/1234567890/conversionActions/987654321",
              conversionDateTime: "2026-03-30 12:34:56+00:00",
              conversionValue: 456.78,
              currencyCode: "USD",
              orderId: "res_123",
              conversionEnvironment: "WEB",
              consent: {
                adUserData: "GRANTED",
                adPersonalization: "GRANTED",
              },
            },
          ],
          partialFailure: true,
        }),
      })
    );
  });

  it("no-ops when server purchase mode is disabled", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_MODE = "client";

    await uploadGoogleAdsPurchaseConversion({
      gclid: "test-gclid",
      reservationId: "res_123",
      value: 123,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops when the booking has no gclid, gbraid, or wbraid", async () => {
    await uploadGoogleAdsPurchaseConversion({
      reservationId: "res_123",
      value: 123,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it("uploads with gbraid when only gbraid is present (iOS App campaigns)", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: true,
      gbraid: "test-gbraid",
      occurredAt: new Date("2026-03-30T12:34:56.000Z"),
      reservationId: "res_gbraid",
      value: 100,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.conversions[0]).toMatchObject({ gbraid: "test-gbraid" });
    expect(body.conversions[0].gclid).toBeUndefined();
    expect(body.conversions[0].wbraid).toBeUndefined();
  });

  it("uploads with wbraid when only wbraid is present (iOS Web campaigns)", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: true,
      wbraid: "test-wbraid",
      occurredAt: new Date("2026-03-30T12:34:56.000Z"),
      reservationId: "res_wbraid",
      value: 100,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.conversions[0]).toMatchObject({ wbraid: "test-wbraid" });
    expect(body.conversions[0].gclid).toBeUndefined();
    expect(body.conversions[0].gbraid).toBeUndefined();
  });

  it("prefers gclid when multiple click identifiers are present", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: true,
      gclid: "test-gclid",
      gbraid: "test-gbraid",
      wbraid: "test-wbraid",
      occurredAt: new Date("2026-03-30T12:34:56.000Z"),
      reservationId: "res_priority",
      value: 100,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.conversions[0]).toMatchObject({ gclid: "test-gclid" });
    expect(body.conversions[0].gbraid).toBeUndefined();
    expect(body.conversions[0].wbraid).toBeUndefined();
  });

  it("attaches hashed userIdentifiers when guest fields + consent are present", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: true,
      gclid: "test-gclid",
      reservationId: "res_456",
      value: 200,
      email: "  Guest@Example.com  ",
      phone: "(555) 123-4567",
    });

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(call[1].body);
    const conversion = body.conversions[0];
    // ConversionUploadService only accepts hashed_email + hashed_phone_number.
    // address_info is silently dropped, so we don't send it.
    expect(conversion.userIdentifiers).toHaveLength(2);
    // SHA-256 of "guest@example.com"
    expect(conversion.userIdentifiers[0]).toEqual({
      hashedEmail:
        "513935c4d2db2d2d984dff1d68397f6e2ac8c4e5c48c92bd98e02bdc90b7aefe",
    });
    // SHA-256 of "+15551234567"
    expect(conversion.userIdentifiers[1]).toEqual({
      hashedPhoneNumber:
        "8a59780bb8cd2ba022bfa5ba2ea3b6e07af17a7d8b30c1f9b3390e36f69019e4",
    });
  });

  it("omits userIdentifiers when consent is denied", async () => {
    mockAuthorize.mockResolvedValue({
      access_token: "access-token",
      expiry_date: Date.now() + 3600_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ results: [{}] }),
    });

    await uploadGoogleAdsPurchaseConversion({
      consentGranted: false,
      gclid: "test-gclid",
      reservationId: "res_789",
      value: 100,
      email: "guest@example.com",
    });

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.conversions[0].userIdentifiers).toBeUndefined();
    expect(body.conversions[0].consent.adUserData).toBe("DENIED");
  });
});
