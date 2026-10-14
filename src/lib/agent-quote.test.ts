import { describe, expect, it } from "vitest";
import {
  buildCheckoutUrl,
  isValidAgentSlug,
  QUOTE_TERMS,
  readQuoteExpiry,
  toAgentQuote,
} from "./agent-quote";
import { AGENT_DISCLOSURE } from "./agent-response";
import type { PublicListing } from "./agent-api";

const LISTING: PublicListing = {
  id: "63b7080c04bd5e0058e7fcf1",
  name: "The Plaza 201",
  url: "https://www.booktraverse.com/properties/the-plaza-201-63b7080c04bd5e0058e7fcf1",
  propertyType: "Apartment",
  bedrooms: 2,
  bathrooms: 2,
  beds: 3,
  maxGuests: 6,
  location: {
    city: "Mount Crested Butte",
    state: "CO",
    postalCode: "81225",
    country: "United States",
    latitude: 38.9,
    longitude: -106.96,
  },
  building: null,
  amenities: [],
  checkInTime: "16:00",
  checkOutTime: "10:00",
  photo: null,
};

/**
 * Shaped like a real BEAPI quote: the `rates.ratePlans[0]` branch, with the
 * top-level `expiresAt` measured against the live API on 2026-10-13.
 */
function beapiQuote(overrides: Record<string, unknown> = {}) {
  return {
    _id: "6acea998520e0e0ffc0f51e7",
    unitTypeId: LISTING.id,
    checkInDateLocalized: "2027-05-11",
    checkOutDateLocalized: "2027-05-14",
    guestsCount: 2,
    createdAt: "2026-10-13T21:58:48.892Z",
    expiresAt: "2026-10-14T21:58:48.892Z",
    rates: {
      ratePlans: [
        {
          ratePlan: {
            _id: "rp_1",
            money: {
              currency: "USD",
              fareAccommodation: 900,
              fareAccommodationAdjusted: 810,
              fareCleaning: 150,
              totalTaxes: 96.3,
              hostPayout: 1056.3,
            },
          },
          days: [
            { date: "2027-05-11", price: 300 },
            { date: "2027-05-12", price: 300 },
            { date: "2027-05-13", price: 300 },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe("readQuoteExpiry", () => {
  // The TTL was measured against the live API: BEAPI returns a top-level
  // expiresAt exactly 24h after createdAt. An earlier note in the design doc
  // claimed no expiry field existed; that was wrong.
  it("reads the top-level expiresAt and computes a TTL", () => {
    const now = Date.parse("2026-10-13T21:58:48.892Z");
    const e = readQuoteExpiry(beapiQuote(), now);
    expect(e?.expiresAt).toBe("2026-10-14T21:58:48.892Z");
    expect(e?.expiresInSeconds).toBe(86_400);
  });

  // Publishing a computed guess would be worse than publishing nothing: an
  // agent would hold a quote it believes is good for 24h.
  it("returns null rather than guessing when the field is missing", () => {
    expect(
      readQuoteExpiry({ createdAt: "2026-10-13T21:58:48.892Z" })
    ).toBeNull();
    expect(readQuoteExpiry({ expiresAt: "" })).toBeNull();
    expect(readQuoteExpiry({ expiresAt: "not a date" })).toBeNull();
    expect(readQuoteExpiry({ expiresAt: 1234 })).toBeNull();
  });

  it("floors an already-expired quote at zero", () => {
    const now = Date.parse("2026-10-16T00:00:00.000Z");
    expect(readQuoteExpiry(beapiQuote(), now)?.expiresInSeconds).toBe(0);
  });
});

describe("buildCheckoutUrl", () => {
  // Attribution rides the existing utm pipeline — proxy.ts captures these
  // into _sp_attribution, which already reaches GA4 and the reservations row.
  // A bespoke ?src=agent param would be read by nothing.
  it("carries utm attribution for the agent", () => {
    const url = new URL(buildCheckoutUrl("q123", "chatgpt"));
    expect(url.pathname).toBe("/book/q123");
    expect(url.searchParams.get("utm_source")).toBe("chatgpt");
    expect(url.searchParams.get("utm_medium")).toBe("ai_agent");
    expect(url.searchParams.get("utm_campaign")).toBe("agent_api");
  });

  it("still marks agent traffic when no agent identified itself", () => {
    const url = new URL(buildCheckoutUrl("q123"));
    expect(url.searchParams.get("utm_source")).toBe("ai-agent");
  });

  it("points at the production origin, not a relative path", () => {
    expect(buildCheckoutUrl("q123")).toMatch(
      /^https:\/\/www\.booktraverse\.com\/book\//
    );
  });

  it("encodes a hostile quote id instead of letting it alter the URL", () => {
    const url = new URL(buildCheckoutUrl("../../admin?x=1", "a"));
    expect(url.pathname).toBe("/book/..%2F..%2Fadmin%3Fx%3D1");
    expect(url.searchParams.get("x")).toBeNull();
  });
});

describe("isValidAgentSlug", () => {
  it("accepts plain identifiers", () => {
    for (const s of ["chatgpt", "claude", "perplexity-ai", "a.b_c", "x1"]) {
      expect(isValidAgentSlug(s), s).toBe(true);
    }
  });

  it("rejects anything that would pollute a utm dimension", () => {
    for (const s of [
      "",
      "Claude",
      "has space",
      "-leading",
      "sem;colon",
      "a".repeat(41),
      "emoji🙂",
      "a/b",
    ]) {
      expect(isValidAgentSlug(s), s).toBe(false);
    }
  });
});

describe("toAgentQuote", () => {
  it("returns an all-in total with the price broken out", () => {
    const q = toAgentQuote(beapiQuote(), LISTING, "chatgpt");
    expect(q.quoteId).toBe("6acea998520e0e0ffc0f51e7");
    expect(q.listingId).toBe(LISTING.id);
    expect(q.listingName).toBe("The Plaza 201");
    expect(q.nights).toBe(3);
    expect(q.guests).toBe(2);
    expect(q.currency).toBe("USD");
    // Post-promotion accommodation is what the guest pays.
    expect(q.price.accommodation).toBe(810);
    expect(q.price.cleaning).toBe(150);
    expect(q.price.taxes).toBe(96.3);
    expect(q.price.total).toBe(1056.3);
  });

  it("reconciles: accommodation + cleaning + taxes = total", () => {
    const { price } = toAgentQuote(beapiQuote(), LISTING);
    expect(price.accommodation + price.cleaning + price.taxes).toBeCloseTo(
      price.total,
      2
    );
  });

  // BEAPI's days[].price is the PUBLISHED nightly rate, not a breakdown of the
  // accommodation fare. On a verified quote the nights summed to $284 while the
  // fare was $337.20 before a discount — so including them inside `price`
  // would show a traveller two irreconcilable numbers.
  it("does not publish a per-night array inside price", () => {
    const { price } = toAgentQuote(beapiQuote(), LISTING);
    expect(price).not.toHaveProperty("nightly");
    expect(JSON.stringify(price)).not.toContain("2027-05-11");
  });

  it("surfaces the discount amount when a promotion applied", () => {
    const { price } = toAgentQuote(beapiQuote(), LISTING);
    // 900 fare -> 810 adjusted.
    expect(price.accommodationBeforeDiscount).toBe(900);
    expect(price.discount).toBe(90);
    expect(price.accommodation).toBe(810);
  });

  // The promo name is an internal Guesty string ("EB - All Units"), same
  // reasoning as keeping `tags` out of the listing payload.
  it("does not publish the promotion name", () => {
    const raw = beapiQuote({
      promotions: [{ name: "EB - All Units", type: "EARLY_BIRD" }],
    });
    const serialized = JSON.stringify(toAgentQuote(raw, LISTING));
    expect(serialized).not.toContain("EB - All Units");
    expect(serialized).not.toContain("EARLY_BIRD");
  });

  it("omits the discount fields when no promotion applied", () => {
    const raw = beapiQuote();
    raw.rates.ratePlans[0].ratePlan.money.fareAccommodationAdjusted = 0;
    const { price } = toAgentQuote(raw, LISTING);
    expect(price).not.toHaveProperty("discount");
    expect(price).not.toHaveProperty("accommodationBeforeDiscount");
    expect(price.accommodation).toBe(900);
  });

  it("includes the expiry and a checkout link", () => {
    const q = toAgentQuote(beapiQuote(), LISTING, "chatgpt");
    expect(q.expiresAt).toBe("2026-10-14T21:58:48.892Z");
    expect(q.checkoutUrl).toContain("/book/6acea998520e0e0ffc0f51e7");
    expect(q.checkoutUrl).toContain("utm_source=chatgpt");
  });

  it("omits expiry fields entirely when BEAPI sends none", () => {
    const noExpiry: Record<string, unknown> = beapiQuote();
    delete noExpiry.expiresAt;
    const q = toAgentQuote(noExpiry, LISTING);
    expect(q).not.toHaveProperty("expiresAt");
    expect(q).not.toHaveProperty("expiresInSeconds");
  });

  // A live quote is all-in and authoritative until it expires. AGENT_DISCLOSURE
  // says the opposite — cached, accommodation-only, not authoritative — and
  // attaching it here would tell an assistant to hedge a real, payable total.
  it("carries quote terms, NOT the cached-search disclosure", () => {
    const q = toAgentQuote(beapiQuote(), LISTING);
    expect(q.terms).toBe(QUOTE_TERMS);
    expect(q.terms.authoritative).toBe(true);
    expect(AGENT_DISCLOSURE.authoritative).toBe(false);
    expect(q.terms.priceBasis).toBe("all-in");
    expect(q.terms.includes).toContain("taxes");
    // The model must be told it cannot take payment.
    expect(q.terms.note).toMatch(/cannot take payment/);
  });

  // The raw BEAPI quote carries accountId, unitTypeId, rate-plan internals and
  // invoice-item metadata. None of it belongs in a public response.
  it("does not leak raw BEAPI internals", () => {
    const raw = beapiQuote({ accountId: "acct_secret", __v: 3 });
    const serialized = JSON.stringify(toAgentQuote(raw, LISTING));
    expect(serialized).not.toContain("acct_secret");
    expect(serialized).not.toContain("accountId");
    expect(serialized).not.toContain("ratePlans");
    expect(serialized).not.toContain("__v");
  });

  it("rounds money to cents", () => {
    const raw = beapiQuote();
    raw.rates.ratePlans[0].ratePlan.money.hostPayout = 1056.30000000001;
    raw.rates.ratePlans[0].ratePlan.money.totalTaxes = 96.299999999;
    const q = toAgentQuote(raw, LISTING);
    expect(q.price.total).toBe(1056.3);
    expect(q.price.taxes).toBe(96.3);
  });
});
