// src/lib/pois/seed/pass-0-import-existing.test.ts
import { describe, it, expect } from "vitest";
import { mapLegacyCategory, toSeedRow } from "./pass-0-import-existing";

describe("mapLegacyCategory", () => {
  it("maps dining → restaurant", () => {
    expect(mapLegacyCategory("dining")).toBe("restaurant");
  });
  it("maps coffee → coffee", () => {
    expect(mapLegacyCategory("coffee")).toBe("coffee");
  });
  it("maps parks → park", () => {
    expect(mapLegacyCategory("parks")).toBe("park");
  });
  it("maps shopping → shop", () => {
    expect(mapLegacyCategory("shopping")).toBe("shop");
  });
  it("maps transit → transit", () => {
    expect(mapLegacyCategory("transit")).toBe("transit");
  });
  it("maps attractions → activity", () => {
    expect(mapLegacyCategory("attractions")).toBe("activity");
  });
});

describe("toSeedRow", () => {
  it("produces a valid sp_pois insert row from a legacy poi", () => {
    const row = toSeedRow({
      name: "Salt & Straw (Alberta)",
      lat: 45.559,
      lng: -122.6467,
      category: "dining",
    });
    expect(row).toMatchObject({
      id: "salt-straw-alberta",
      name: "Salt & Straw (Alberta)",
      category: "restaurant",
      neighborhood: "unknown",
      lat: 45.559,
      lng: -122.6467,
      status: "draft",
      tags: [],
      time_slots: [],
      party_types: [],
    });
    expect(row.description).toContain("Imported from legacy POI list");
    expect(row.address).toBe("Portland, OR");
  });
});
