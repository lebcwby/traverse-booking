import { describe, expect, it } from "vitest";
import {
  buildIsPartOf,
  buildListingItemList,
  buildWebSiteJsonLd,
  findBuildingForTags,
} from "./listing-jsonld";

const listing = (over: Partial<Record<string, unknown>> = {}) => ({
  guesty_id: "abc123",
  title: "1BR Ski-In/Out",
  nickname: "CB:GL:101",
  picture: "https://assets.guesty.com/x.jpg",
  bedrooms: 1,
  accommodates: 4,
  ...over,
});

const url = (l: { guesty_id: string }) =>
  `https://www.booktraverse.com/properties/slug-${l.guesty_id}`;

describe("findBuildingForTags / buildIsPartOf", () => {
  it("matches a unit to its building page", () => {
    expect(findBuildingForTags(["The Grand Lodge Crested Butte"])).toEqual({
      name: "The Grand Lodge Crested Butte",
      url: "https://www.booktraverse.com/crested-butte/grand-lodge",
    });
  });

  it("finds the building among other tags", () => {
    const got = findBuildingForTags([
      "Market - Crested Butte",
      "The Plaza Crested Butte",
      "hot tub",
    ]);
    expect(got?.url).toContain("/crested-butte/the-plaza");
  });

  it("returns null for a listing in no building we have a page for", () => {
    expect(findBuildingForTags(["cabin", "Market - Leadville"])).toBeNull();
    expect(findBuildingForTags([])).toBeNull();
    expect(findBuildingForTags(null)).toBeNull();
  });

  it("builds an ApartmentComplex, or nothing at all", () => {
    expect(buildIsPartOf(["The Lodge at Mountaineer Square"])).toEqual({
      "@type": "ApartmentComplex",
      name: "The Lodge at Mountaineer Square",
      url: "https://www.booktraverse.com/crested-butte/lodge-at-mountaineer-square",
    });
    // undefined, not null — it is spread into a JSON-LD object where an
    // explicit null would publish `"isPartOf": null`.
    expect(buildIsPartOf(["cabin"])).toBeUndefined();
  });

  // A tag typo would silently drop the link, so pin the exact Guesty strings.
  it("requires the exact Guesty tag", () => {
    expect(findBuildingForTags(["Grand Lodge Crested Butte"])).toBeNull();
    expect(findBuildingForTags(["the grand lodge crested butte"])).toBeNull();
  });
});

describe("buildListingItemList", () => {
  const base = {
    getUrl: url,
    name: "Colorado Vacation Rentals",
    url: "https://www.booktraverse.com/properties",
  };

  it("lists every listing in order with a stable @id", () => {
    const out = buildListingItemList({
      ...base,
      listings: [listing(), listing({ guesty_id: "def456" })],
    });
    expect(out["@type"]).toBe("ItemList");
    expect(out.numberOfItems).toBe(2);
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[1].position).toBe(2);
    expect(out.itemListElement[0].item["@id"]).toBe(
      "https://www.booktraverse.com/properties/slug-abc123#rental"
    );
  });

  // The phase 1 rule: never publish the $95 placeholder.
  it("includes an offer only for a listing with a real cached rate", () => {
    const out = buildListingItemList({
      ...base,
      listings: [listing(), listing({ guesty_id: "nocache" })],
      nightlyFromById: new Map([
        ["abc123", 223],
        ["nocache", undefined],
      ]),
    });
    expect(out.itemListElement[0].item.offers).toMatchObject({
      price: 223,
      priceCurrency: "USD",
      unitCode: "DAY",
    });
    expect(out.itemListElement[1].item.offers).toBeUndefined();
  });

  it("omits an offer when no price map is supplied at all", () => {
    const out = buildListingItemList({ ...base, listings: [listing()] });
    expect(out.itemListElement[0].item.offers).toBeUndefined();
  });

  it("rejects a zero or negative cached rate", () => {
    const out = buildListingItemList({
      ...base,
      listings: [listing(), listing({ guesty_id: "neg" })],
      nightlyFromById: new Map([
        ["abc123", 0],
        ["neg", -10],
      ]),
    });
    expect(out.itemListElement[0].item.offers).toBeUndefined();
    expect(out.itemListElement[1].item.offers).toBeUndefined();
  });

  it("falls back to the nickname and trims whitespace in the name", () => {
    const out = buildListingItemList({
      ...base,
      listings: [
        listing({ title: "  Plaza 2 BR  " }),
        listing({ guesty_id: "x2", title: null }),
      ],
    });
    expect(out.itemListElement[0].item.name).toBe("Plaza 2 BR");
    expect(out.itemListElement[1].item.name).toBe("CB:GL:101");
  });

  it("omits optional fields rather than emitting empty ones", () => {
    const out = buildListingItemList({
      ...base,
      listings: [
        listing({ picture: null, bedrooms: null, accommodates: null }),
      ],
    });
    const item = out.itemListElement[0].item;
    expect(item.image).toBeUndefined();
    expect(item.numberOfBedrooms).toBeUndefined();
    expect(item.occupancy).toBeUndefined();
  });

  it("skips a listing with no guesty_id instead of emitting a broken url", () => {
    const out = buildListingItemList({
      ...base,
      listings: [listing(), listing({ guesty_id: "" })],
    });
    expect(out.numberOfItems).toBe(1);
  });

  it("handles an empty catalogue without producing a malformed list", () => {
    const out = buildListingItemList({ ...base, listings: [] });
    expect(out.numberOfItems).toBe(0);
    expect(out.itemListElement).toEqual([]);
  });
});

describe("buildWebSiteJsonLd", () => {
  it("points the SearchAction at the real /properties?q= parameter", () => {
    const site = buildWebSiteJsonLd();
    expect(site["@type"]).toBe("WebSite");
    expect(site.potentialAction.target.urlTemplate).toBe(
      "https://www.booktraverse.com/properties?q={search_term_string}"
    );
    expect(site.potentialAction["query-input"]).toBe(
      "required name=search_term_string"
    );
  });

  it("references the existing Organization node rather than redefining it", () => {
    expect(buildWebSiteJsonLd().publisher).toEqual({
      "@id": "https://www.booktraverse.com/#organization",
    });
  });
});
