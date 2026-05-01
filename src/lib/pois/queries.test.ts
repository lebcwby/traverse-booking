// src/lib/pois/queries.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFrom,
  mockSelect,
  mockEq,
  mockIn,
  mockOverlaps,
  mockLimit,
  mockOrder,
} = vi.hoisted(() => {
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockOverlaps = vi.fn();
  const mockIn = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  return {
    mockFrom,
    mockSelect,
    mockEq,
    mockIn,
    mockOverlaps,
    mockLimit,
    mockOrder,
  };
});

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

import { searchPois, getPoisByIds } from "./queries";

function buildChainable(result: { data: unknown; error: unknown }) {
  // Mimics PostgrestFilterBuilder: every chain method returns the chain,
  // and the chain itself is a thenable that resolves to {data, error}.
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.in = mockIn.mockReturnValue(chain);
  chain.overlaps = mockOverlaps.mockReturnValue(chain);
  chain.limit = mockLimit.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  // Make the chain itself a thenable so `await chain.in(...)` works
  // for queries that don't end in .order()
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

describe("searchPois", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by neighborhood and active status", async () => {
    mockFrom.mockReturnValue(buildChainable({ data: [], error: null }));
    await searchPois({ neighborhoods: ["pearl"], limit: 10 });
    expect(mockFrom).toHaveBeenCalledWith("sp_pois");
    expect(mockEq).toHaveBeenCalledWith("status", "active");
    expect(mockIn).toHaveBeenCalledWith("neighborhood", ["pearl"]);
    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it("filters by category when provided", async () => {
    mockFrom.mockReturnValue(buildChainable({ data: [], error: null }));
    await searchPois({ category: "coffee", limit: 5 });
    expect(mockEq).toHaveBeenCalledWith("category", "coffee");
  });

  it("filters by tags using overlaps", async () => {
    mockFrom.mockReturnValue(buildChainable({ data: [], error: null }));
    await searchPois({ tags: ["kid_friendly", "outdoor"], limit: 5 });
    expect(mockOverlaps).toHaveBeenCalledWith("tags", [
      "kid_friendly",
      "outdoor",
    ]);
  });

  it("returns hydrated Poi objects", async () => {
    const row = {
      id: "salt-straw-alberta",
      name: "Salt & Straw",
      category: "shop",
      neighborhood: "alberta",
      description: "Iconic Portland ice cream",
      address: "2035 NE Alberta St",
      lat: "45.559",
      lng: "-122.6467",
      tags: ["kid_friendly", "instagrammable"],
      time_slots: ["afternoon", "evening"],
      party_types: ["family", "couple"],
      price_level: 2,
      hours_summary: "Daily 11a-11p",
      photo_url: null,
      source_url: null,
      source_guide_slug: null,
      status: "active",
      created_at: "2026-04-08T00:00:00Z",
      updated_at: "2026-04-08T00:00:00Z",
    };
    mockFrom.mockReturnValue(buildChainable({ data: [row], error: null }));

    const result = await searchPois({ category: "shop", limit: 1 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "salt-straw-alberta",
      lat: 45.559,
      lng: -122.6467,
    });
  });

  it("throws on supabase error", async () => {
    mockFrom.mockReturnValue(
      buildChainable({ data: null, error: { message: "boom" } })
    );
    await expect(searchPois({ limit: 5 })).rejects.toThrow(/boom/);
  });
});

describe("getPoisByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries by id list", async () => {
    mockFrom.mockReturnValue(buildChainable({ data: [], error: null }));
    await getPoisByIds(["a", "b", "c"]);
    expect(mockIn).toHaveBeenCalledWith("id", ["a", "b", "c"]);
  });

  it("returns empty array if id list is empty without querying", async () => {
    const result = await getPoisByIds([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
