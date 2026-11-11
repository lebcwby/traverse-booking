// Tests for src/lib/quote-response.ts — the BEAPI-quote normalization
// layer that feeds the checkout PriceBreakdown, the /api/quotes responses,
// and the pending-checkout snapshot.
//
// Regression coverage targets:
//   - taxBreakdown threading (2026-05-20: per-tax line items must survive
//     normalization so the checkout UI can render "State sales tax",
//     "Lodging tax", etc.)
//   - listingNickname threading (2026-05-13: must flow through so GA4
//     ecommerce events get item_variant)
//   - rate-plan-shape vs pricing-shape input — BEAPI returns one or the
//     other depending on the endpoint
//
// Sample fixtures are trimmed Guesty BEAPI responses captured from real
// quotes; identifiers are scrambled.

import { describe, expect, it } from "vitest";
import {
  buildNormalizedQuoteResponse,
  extractQuotePricing,
  extractTaxBreakdown,
  getQuoteIdentifiers,
} from "./quote-response";

// Realistic BEAPI shape — money lives under
// `rates.ratePlans[0].ratePlan.money`. This is the live production shape.
const RATE_PLAN_SHAPE = {
  _id: "quote_abc123",
  unitTypeId: "listing_xyz789",
  checkInDateLocalized: "2026-06-16",
  checkOutDateLocalized: "2026-06-19",
  guestsCount: 2,
  rates: {
    ratePlans: [
      {
        ratePlan: {
          _id: "rp_def456",
          money: {
            hostPayout: 869.2,
            fareAccommodation: 562.95,
            fareAccommodationAdjusted: 506.65,
            fareCleaning: 225,
            totalTaxes: 137.55,
            invoiceItems: [
              {
                title: "STATE_TAX",
                amount: 65.25,
                type: "TAX",
                isTax: true,
                normalType: "ST",
              },
              {
                title: "TRANSIENT_OCCUPANCY_TAX",
                amount: 52.3,
                type: "TAX",
                isTax: true,
                normalType: "TOT",
              },
              {
                title: "COUNTY_TAX",
                amount: 20,
                type: "TAX",
                isTax: true,
                normalType: "COT",
              },
              { title: "Cleaning fee", amount: 225, type: "CLEANING_FEE" },
            ],
          },
        },
        days: [
          { date: "2026-06-16", price: 187.65 },
          { date: "2026-06-17", price: 187.65 },
          { date: "2026-06-18", price: 187.65 },
        ],
      },
    ],
  },
};

describe("extractTaxBreakdown", () => {
  it("returns undefined for non-array input", () => {
    expect(extractTaxBreakdown(undefined, null)).toBeUndefined();
    expect(
      extractTaxBreakdown(null as unknown as unknown[] | undefined, null)
    ).toBeUndefined();
  });

  it("returns undefined when no items are tax-shaped", () => {
    expect(
      extractTaxBreakdown(
        [{ title: "Cleaning", amount: 225, type: "CLEANING_FEE" }],
        null
      )
    ).toBeUndefined();
  });

  it("recognizes isTax: true", () => {
    const out = extractTaxBreakdown(
      [{ title: "STATE_TAX", amount: 50, isTax: true }],
      null
    );
    expect(out).toEqual([{ name: "State sales tax", amount: 50 }]);
  });

  it("recognizes type: 'TAX'", () => {
    const out = extractTaxBreakdown(
      [{ title: "Tourism tax", amount: 12, type: "TAX" }],
      null
    );
    expect(out?.[0]?.name).toBe("Tourism tax");
  });

  it("recognizes normalType TOT / ST / COT / LT", () => {
    const out = extractTaxBreakdown(
      [
        { title: "STATE_TAX", amount: 10, normalType: "ST" },
        { title: "TRANSIENT_OCCUPANCY_TAX", amount: 20, normalType: "TOT" },
        { title: "COUNTY_TAX", amount: 5, normalType: "COT" },
        { title: "CITY_TAX", amount: 3, normalType: "LT" },
      ],
      null
    );
    expect(out).toHaveLength(4);
    expect(out?.map((t) => t.name)).toEqual([
      "State sales tax",
      "Lodging tax (transient occupancy)",
      "County tax",
      "City tax",
    ]);
  });

  it("falls back to title-case for unknown tax titles", () => {
    const out = extractTaxBreakdown(
      [{ title: "TOURISM_IMPROVEMENT_DISTRICT", amount: 5, isTax: true }],
      null
    );
    expect(out?.[0]?.name).toBe("Tourism Improvement District");
  });

  it("filters out zero-amount tax items (sometimes returned as placeholders)", () => {
    const out = extractTaxBreakdown(
      [
        { title: "STATE_TAX", amount: 50, isTax: true },
        { title: "OTHER_TAX", amount: 0, isTax: true },
      ],
      null
    );
    expect(out).toHaveLength(1);
  });
});

describe("extractQuotePricing — rate-plan shape (production BEAPI)", () => {
  it("pulls money fields off rates.ratePlans[0].ratePlan.money", () => {
    const pricing = extractQuotePricing(RATE_PLAN_SHAPE);
    expect(pricing.total).toBe(869.2);
    expect(pricing.accommodation).toBe(562.95);
    expect(pricing.accommodationAdjusted).toBe(506.65);
    expect(pricing.cleaning).toBe(225);
    expect(pricing.taxes).toBe(137.55);
    // nights = number of `days[]` entries when present (authoritative
    // from BEAPI, not derived from check-in/check-out math).
    expect(pricing.nights).toBe(3);
  });

  it("threads taxBreakdown through (regression: 2026-05-20 fix)", () => {
    const pricing = extractQuotePricing(RATE_PLAN_SHAPE);
    expect(pricing.taxBreakdown).toHaveLength(3);
    expect(pricing.taxBreakdown?.[0]).toEqual({
      name: "State sales tax",
      amount: 65.25,
    });
  });

  it("throws when rates.ratePlans[0].ratePlan.money is missing", () => {
    expect(() =>
      extractQuotePricing({ rates: { ratePlans: [{ ratePlan: {} }] } })
    ).toThrow(/No rate plan/);
    expect(() => extractQuotePricing({})).toThrow(/No rate plan/);
  });
});

describe("extractQuotePricing — pricing shape (legacy / internal)", () => {
  it("pulls fields off pricing.* when present", () => {
    const pricing = extractQuotePricing({
      pricing: {
        nights: 3,
        accommodation: 500,
        accommodationAdjusted: 450,
        cleaning: 100,
        taxes: 50,
        total: 600,
        days: [],
        invoiceItems: [
          { title: "STATE_TAX", amount: 50, isTax: true },
        ],
      },
    });
    expect(pricing.total).toBe(600);
    expect(pricing.taxBreakdown).toEqual([
      { name: "State sales tax", amount: 50 },
    ]);
  });
});

describe("normalizePromotion", () => {
  it("returns undefined when no promotion is attached", () => {
    const pricing = extractQuotePricing(RATE_PLAN_SHAPE);
    expect(pricing.promotion).toBeUndefined();
  });

  it("normalizes a single-promotion array shape (BEAPI variant)", () => {
    const pricing = extractQuotePricing({
      ...RATE_PLAN_SHAPE,
      promotions: [
        { name: "28 days out (10%)", type: "PERCENT", code: "EARLY10" },
      ],
    });
    expect(pricing.promotion?.name).toBe("28 days out (10%)");
    expect(pricing.promotion?.type).toBe("PERCENT");
  });

  it("falls back to `code` then `title` when `name` is missing", () => {
    // Note: the rate-plan branch only reads `promotions` (plural). The
    // singular `promotion` field is only checked on the pricing-shape
    // branch — covered separately.
    const pricingByCode = extractQuotePricing({
      ...RATE_PLAN_SHAPE,
      promotions: { code: "WEEKLY15", discountType: "PERCENT" },
    });
    expect(pricingByCode.promotion?.name).toBe("WEEKLY15");

    const pricingByTitle = extractQuotePricing({
      ...RATE_PLAN_SHAPE,
      promotions: { title: "Weekly stay" },
    });
    expect(pricingByTitle.promotion?.name).toBe("Weekly stay");
  });

  it("on pricing shape, accepts singular `promotion` field too", () => {
    const pricing = extractQuotePricing({
      pricing: {
        nights: 1,
        accommodation: 100,
        accommodationAdjusted: 100,
        cleaning: 0,
        taxes: 0,
        total: 100,
        days: [],
      },
      promotion: { code: "PRICING_PROMO" },
    });
    expect(pricing.promotion?.name).toBe("PRICING_PROMO");
  });

  it("returns undefined when promotion has no usable identifier", () => {
    const pricing = extractQuotePricing({
      ...RATE_PLAN_SHAPE,
      promotions: { discountAmount: 50 }, // no name / code / title
    });
    expect(pricing.promotion).toBeUndefined();
  });
});

describe("getQuoteIdentifiers", () => {
  it("prefers explicit quoteId, falls back to _id, then id", () => {
    expect(getQuoteIdentifiers({ quoteId: "a", _id: "b", id: "c" }).quoteId).toBe(
      "a"
    );
    expect(getQuoteIdentifiers({ _id: "b", id: "c" }).quoteId).toBe("b");
    expect(getQuoteIdentifiers({ id: "c" }).quoteId).toBe("c");
    expect(getQuoteIdentifiers({}).quoteId).toBe("");
  });

  it("walks rates.ratePlans[0].ratePlan._id for ratePlanId fallback", () => {
    expect(getQuoteIdentifiers(RATE_PLAN_SHAPE).ratePlanId).toBe("rp_def456");
  });
});

describe("buildNormalizedQuoteResponse", () => {
  it("threads listingNickname through (regression: 2026-05-13 GA4 fix)", () => {
    const normalized = buildNormalizedQuoteResponse(RATE_PLAN_SHAPE, {
      title: "The Plaza 441",
      nickname: "Plaza 441",
      picture: "https://assets.guesty.com/p441.jpg",
      property_type: "Condo",
      address: { city: "Mt. Crested Butte" },
    });
    expect(normalized.listingNickname).toBe("Plaza 441");
    expect(normalized.listingTitle).toBe("The Plaza 441");
    expect(normalized.city).toBe("Mt. Crested Butte");
  });

  it("falls back to nickname when title is null", () => {
    const normalized = buildNormalizedQuoteResponse(RATE_PLAN_SHAPE, {
      title: null,
      nickname: "Plaza 441",
    });
    expect(normalized.listingTitle).toBe("Plaza 441");
  });

  it("falls back to pictures[0] when picture is missing", () => {
    const normalized = buildNormalizedQuoteResponse(RATE_PLAN_SHAPE, {
      picture: null,
      pictures: ["https://assets.guesty.com/alt1.jpg"],
    });
    expect(normalized.picture).toBe("https://assets.guesty.com/alt1.jpg");
  });

  it("populates checkIn/checkOut from localized fields (BEAPI shape)", () => {
    const normalized = buildNormalizedQuoteResponse(RATE_PLAN_SHAPE);
    expect(normalized.checkIn).toBe("2026-06-16");
    expect(normalized.checkOut).toBe("2026-06-19");
    expect(normalized.guests).toBe(2);
  });

  it("returns empty strings (not undefined) for missing identifiers", () => {
    const normalized = buildNormalizedQuoteResponse({
      rates: {
        ratePlans: [
          { ratePlan: { money: { hostPayout: 100 } }, days: [] },
        ],
      },
    });
    // Missing _id/quoteId on the source -> empty string, not "undefined" or null.
    // This matters because the client sessionStorage key uses `quote_${quoteId}`
    // and "quote_undefined" would silently overwrite other quotes.
    expect(normalized.quoteId).toBe("");
    expect(normalized.listingId).toBe("");
  });

  it("preserves the full pricing object including taxBreakdown", () => {
    const normalized = buildNormalizedQuoteResponse(RATE_PLAN_SHAPE);
    expect(normalized.pricing.taxBreakdown).toHaveLength(3);
    expect(normalized.pricing.total).toBe(869.2);
  });
});

// ── Tax RATES read from the listing config ────────────────────────────────
//
// 2026-11-11. The checkout breakdown used to derive the percentage beside
// each tax by dividing its amount by `accommodationAdjusted + cleaning`.
// That denominator is wrong in Crested Butte — Guesty also taxes the service
// fee there — so every CB listing published a Colorado state sales tax of
// 3.1% against an actual 2.9%, on a guest receipt, for months.
//
// Adding the fees to the denominator does not fix it: across 228 real
// bookings the state line only lands on 2.9% with a DIFFERENT base per
// jurisdiction, because Guesty is configured per listing —
//   Crested Butte  appliedOnFees: [AF, CF, SERVICE, DAMAGE_WAIVER]
//   Leadville      appliedOnFees: [AF, CF]
// So the rate is now READ from that config, never computed.
//
// Both fixtures below are the real shape, taken from listing_details.
const CB_TAX_CONFIG = [
  { type: "TRANSIENT_OCCUPANCY_TAX", units: "PERCENTAGE", amount: 9.9,
    appliedOnFees: ["AF", "CF", "SERVICE", "DAMAGE_WAIVER"] },
  { type: "COUNTY_TAX", units: "PERCENTAGE", amount: 6,
    appliedOnFees: ["AF", "CF", "SERVICE", "DAMAGE_WAIVER"] },
  { type: "STATE_TAX", units: "PERCENTAGE", amount: 2.9,
    appliedOnFees: ["AF", "CF", "SERVICE", "DAMAGE_WAIVER"] },
];
const LEADVILLE_TAX_CONFIG = [
  { type: "TRANSIENT_OCCUPANCY_TAX", units: "PERCENTAGE", amount: 5.42,
    appliedOnFees: ["AF", "CF"] },
  { type: "COUNTY_TAX", units: "PERCENTAGE", amount: 4, appliedOnFees: ["AF", "CF"] },
  { type: "STATE_TAX", units: "PERCENTAGE", amount: 2.9, appliedOnFees: ["AF", "CF"] },
];
const TAX_ITEMS = [
  { title: "TRANSIENT_OCCUPANCY_TAX", amount: 33.7, type: "TAX", isTax: true, normalType: "TOT" },
  { title: "COUNTY_TAX", amount: 20.41, type: "TAX", isTax: true, normalType: "COT" },
  { title: "STATE_TAX", amount: 9.88, type: "TAX", isTax: true, normalType: "ST" },
];
const rateOf = (out: ReturnType<typeof extractTaxBreakdown>, needle: string) =>
  out?.find((t) => t.name.toLowerCase().includes(needle))?.rate;

describe("extractTaxBreakdown — rates come from the listing config", () => {
  it("reports Guesty's configured rate, not one derived from the amounts", () => {
    const out = extractTaxBreakdown(TAX_ITEMS, CB_TAX_CONFIG);
    expect(rateOf(out, "state")).toBe(2.9);
    expect(rateOf(out, "county")).toBe(6);
    expect(rateOf(out, "lodging")).toBe(9.9);
  });

  it("gives the same stay different rates in a different jurisdiction", () => {
    // Identical dollar amounts, different listing: the rate must follow the
    // CONFIG, which is the whole point. A derived percentage could not do
    // this — it would return the same number for both.
    const cb = extractTaxBreakdown(TAX_ITEMS, CB_TAX_CONFIG);
    const lead = extractTaxBreakdown(TAX_ITEMS, LEADVILLE_TAX_CONFIG);
    expect(rateOf(cb, "lodging")).toBe(9.9);
    expect(rateOf(lead, "lodging")).toBe(5.42);
    expect(rateOf(cb, "county")).toBe(6);
    expect(rateOf(lead, "county")).toBe(4);
  });

  it("still returns amounts, with no rate, when there is no config", () => {
    const out = extractTaxBreakdown(TAX_ITEMS, null);
    expect(out).toHaveLength(3);
    expect(out!.every((t) => t.rate === undefined)).toBe(true);
    expect(out!.map((t) => t.amount)).toEqual([33.7, 20.41, 9.88]);
  });

  it("matches a Title Case invoice title to an UPPER_SNAKE config type", () => {
    // At least one listing emits "Transient Occupancy Tax" rather than
    // TRANSIENT_OCCUPANCY_TAX; without normalizing, its rate silently vanished.
    const out = extractTaxBreakdown(
      [{ title: "Transient Occupancy Tax", amount: 33.7, type: "TAX", isTax: true }],
      CB_TAX_CONFIG
    );
    expect(out![0].rate).toBe(9.9);
  });

  it("shows no rate for a non-percentage tax", () => {
    // A FIXED per-night levy has no rate; rendering its dollar value with a
    // "%" would be a new flavour of the bug this replaces.
    const out = extractTaxBreakdown(
      [{ title: "CITY_TAX", amount: 12, type: "TAX", isTax: true }],
      [{ type: "CITY_TAX", units: "FIXED", amount: 4 }]
    );
    expect(out![0].amount).toBe(12);
    expect(out![0].rate).toBeUndefined();
  });

  it("shows no rate when the config is ambiguous for that type", () => {
    // Two different rates configured for one type: no single answer is
    // defensible, so show none rather than pick one.
    const out = extractTaxBreakdown(TAX_ITEMS, [
      { type: "STATE_TAX", units: "PERCENTAGE", amount: 2.9 },
      { type: "STATE_TAX", units: "PERCENTAGE", amount: 4.1 },
      { type: "COUNTY_TAX", units: "PERCENTAGE", amount: 6 },
    ]);
    expect(rateOf(out, "state")).toBeUndefined();
    expect(rateOf(out, "county")).toBe(6); // unambiguous one survives
  });

  it("tolerates a duplicate entry that agrees with itself", () => {
    const out = extractTaxBreakdown(TAX_ITEMS, [
      { type: "STATE_TAX", units: "PERCENTAGE", amount: 2.9 },
      { type: "STATE_TAX", units: "PERCENTAGE", amount: 2.9 },
    ]);
    expect(rateOf(out, "state")).toBe(2.9);
  });

  it("threads the rate through buildNormalizedQuoteResponse", () => {
    const normalized = buildNormalizedQuoteResponse(
      RATE_PLAN_SHAPE,
      null,
      CB_TAX_CONFIG
    );
    const states = normalized.pricing.taxBreakdown?.filter((t) =>
      t.name.toLowerCase().includes("state")
    );
    expect(states?.[0]?.rate).toBe(2.9);
  });

  it("survives a config that is junk rather than throwing", () => {
    for (const junk of [null, undefined, "nope", 42, [null, 7, {}]]) {
      expect(() =>
        extractTaxBreakdown(TAX_ITEMS, junk as never)
      ).not.toThrow();
    }
  });
});
