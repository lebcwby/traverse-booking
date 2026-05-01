import { describe, expect, it } from "vitest";
import {
  buildWheelhouseSnapshot,
  getWheelhouseGuestyId,
  type WheelhouseListing,
  type WheelhouseListingPreference,
} from "./wheelhouse-rm";

describe("wheelhouse-rm", () => {
  it("prefers the Guesty channel id when available", () => {
    const listing: WheelhouseListing = {
      id: "airbnb_123",
      channel_ids: {
        Airbnb: "airbnb_123",
        Guesty: "guesty_456",
      },
    };

    expect(getWheelhouseGuestyId(listing)).toBe("guesty_456");
  });

  it("falls back to the partner listing id when Guesty is not present", () => {
    const listing: WheelhouseListing = {
      id: "partner_123",
    };

    expect(getWheelhouseGuestyId(listing)).toBe("partner_123");
  });

  it("builds a flattened snapshot with raw preference data attached", () => {
    const listing: WheelhouseListing = {
      id: "guesty_123",
      wheelhouse_id: 51077477,
      channel: "guesty",
      channel_ids: { Guesty: "guesty_123" },
      currency: "USD",
      title: "NW Kearney 1",
      nickname: "Kearney",
      num_bedrooms: 4,
      is_active: true,
      links: { app: "https://app.usewheelhouse.com/listings/51077477" },
    };

    const preference: WheelhouseListingPreference = {
      partner_listing_id: "guesty_123",
      base_price: 750,
      min_min_price: 425,
      weekly_discount: 0.05,
      monthly_discount: 0.1,
      weekend_factor: 1.15,
      minimum_price_rules_v3: [{ value: 550 }],
      long_term_discounts: { active: true },
      updated_at: "2026-03-11T12:00:00Z",
    };

    const snapshot = buildWheelhouseSnapshot(
      listing,
      preference,
      "2026-03-11T13:00:00Z"
    );

    expect(snapshot).toMatchObject({
      synced_at: "2026-03-11T13:00:00Z",
      guesty_id: "guesty_123",
      wheelhouse_id: 51077477,
      base_price: 750,
      min_min_price: 425,
      weekly_discount: 0.05,
      monthly_discount: 0.1,
      weekend_factor: 1.15,
      long_term_discounts: { active: true },
    });
    expect(snapshot.listing).toMatchObject({
      title: "NW Kearney 1",
      nickname: "Kearney",
      num_bedrooms: 4,
      is_active: true,
    });
    expect(snapshot.preferences).toEqual(preference);
  });
});
