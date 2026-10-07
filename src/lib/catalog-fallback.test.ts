import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/supabase";

const { mockGetListings } = vi.hoisted(() => ({ mockGetListings: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ getListings: mockGetListings }));

import {
  applyCatalogFilters,
  CatalogUnavailableError,
  loadCatalogFallback,
} from "./catalog-fallback";

function listing(partial: Partial<Listing> & { guesty_id: string }): Listing {
  return {
    title: "A place",
    address: { city: "Crested Butte" },
    bedrooms: 2,
    accommodates: 4,
    prices: { basePrice: 200 },
    tags: [],
    ...partial,
  } as unknown as Listing;
}

const CATALOGUE = [
  listing({
    guesty_id: "a",
    title: "Slopeside Studio",
    address: { city: "Mt. Crested Butte" },
    bedrooms: 0,
    accommodates: 2,
    prices: { basePrice: 150 },
  } as never),
  listing({
    guesty_id: "b",
    title: "Victorian House",
    address: { city: "Leadville" },
    bedrooms: 4,
    accommodates: 10,
    prices: { basePrice: 400 },
  } as never),
  listing({
    guesty_id: "c",
    title: "Lake Cabin",
    address: { city: "Twin Lakes" },
    bedrooms: 3,
    accommodates: 6,
    prices: { basePrice: 300 },
  } as never),
];

describe("applyCatalogFilters", () => {
  it("returns everything when no filters are set", () => {
    expect(applyCatalogFilters(CATALOGUE, {})).toHaveLength(3);
  });

  it("matches a city two ways, so 'Crested Butte' finds 'Mt. Crested Butte'", () => {
    const out = applyCatalogFilters(CATALOGUE, { city: "Crested Butte" });
    expect(out.map((l) => l.guesty_id)).toEqual(["a"]);
  });

  it("falls back to tags when the address city does not match", () => {
    const tagged = [
      listing({
        guesty_id: "t",
        address: { city: "" },
        tags: ["Leadville"],
      } as never),
    ];
    expect(applyCatalogFilters(tagged, { city: "Leadville" })).toHaveLength(1);
  });

  it("filters by free-text query across title and city", () => {
    expect(applyCatalogFilters(CATALOGUE, { q: "cabin" })).toHaveLength(1);
    expect(applyCatalogFilters(CATALOGUE, { q: "leadville" })).toHaveLength(1);
  });

  it("filters by bedrooms and guests as minimums", () => {
    expect(applyCatalogFilters(CATALOGUE, { bedrooms: 3 })).toHaveLength(2);
    expect(applyCatalogFilters(CATALOGUE, { guests: 6 })).toHaveLength(2);
  });

  it("filters by price range", () => {
    const out = applyCatalogFilters(CATALOGUE, {
      minPrice: 200,
      maxPrice: 350,
    });
    expect(out.map((l) => l.guesty_id)).toEqual(["c"]);
  });

  it("can legitimately return nothing when filters exclude everything", () => {
    expect(applyCatalogFilters(CATALOGUE, { city: "Nowhere" })).toHaveLength(0);
  });
});

describe("loadCatalogFallback", () => {
  beforeEach(() => mockGetListings.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("serves the mirror catalogue when BEAPI has failed", async () => {
    mockGetListings.mockResolvedValue(CATALOGUE);
    const result = await loadCatalogFallback({});
    expect(result.total).toBe(3);
    expect(result.listings).toHaveLength(3);
  });

  it("still applies the request's filters to the mirror", async () => {
    mockGetListings.mockResolvedValue(CATALOGUE);
    const result = await loadCatalogFallback({ city: "Leadville" });
    expect(result.total).toBe(3);
    expect(result.listings.map((l) => l.guesty_id)).toEqual(["b"]);
  });

  // The distinction the soft-404 turned on: "your filters matched nothing"
  // is a legitimate 200, "we have no catalogue" is not.
  it("reports an empty filtered result without treating it as an outage", async () => {
    mockGetListings.mockResolvedValue(CATALOGUE);
    const result = await loadCatalogFallback({ city: "Nowhere" });
    expect(result.total).toBe(3);
    expect(result.listings).toHaveLength(0);
  });

  it("throws rather than returning an empty catalogue when the mirror is empty", async () => {
    mockGetListings.mockResolvedValue([]);
    await expect(loadCatalogFallback({})).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  // A malformed mirror response reaches the same guard as a dropped
  // connection, and must surface as CatalogUnavailableError rather than
  // escaping as a TypeError on `.length`. Asserted with a bad value rather
  // than a rejecting mock: vitest reports an error raised inside a mock as a
  // test failure even when the code under test catches it.
  it("throws CatalogUnavailableError when the mirror returns a non-array", async () => {
    mockGetListings.mockResolvedValue(undefined as never);
    await expect(loadCatalogFallback({})).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  it("carries the upstream BEAPI reason into the error message", async () => {
    mockGetListings.mockResolvedValue([]);
    await expect(
      loadCatalogFallback({}, new Error("BEAPI 429"))
    ).rejects.toThrow(/BEAPI 429/);
  });
});
