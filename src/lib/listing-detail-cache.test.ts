import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMaybeSingle, mockFrom, mockGetListingDetail } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockFrom: vi.fn(),
  mockGetListingDetail: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

vi.mock("./guesty-beapi", () => ({
  getListingDetail: mockGetListingDetail,
  LISTING_DETAIL_FIELDS: "prices pictures title",
}));

import { readCachedListingDetail } from "./listing-detail-cache";

const LISTING = "6ad80e0156dd9900214b5f92";

/** Shape a `.from().select().eq().maybeSingle()` chain. */
function selectChain() {
  return {
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  };
}

beforeEach(() => {
  mockMaybeSingle.mockReset();
  mockFrom.mockReset().mockImplementation(() => selectChain());
  mockGetListingDetail.mockReset();
});

describe("readCachedListingDetail", () => {
  it("returns the cached payload when the field set matches", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { payload: { title: "Mountain Retreat" }, fields: "prices pictures title" },
      error: null,
    });
    await expect(readCachedListingDetail(LISTING)).resolves.toEqual({
      title: "Mountain Retreat",
    });
    expect(mockFrom).toHaveBeenCalledWith("listing_details");
  });

  it("returns null on a miss", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(readCachedListingDetail(LISTING)).resolves.toBeNull();
  });

  // The silent-staleness guard. Add a field to LISTING_DETAIL_FIELDS and every
  // stored payload is missing it — with no error anywhere. The page would just
  // render that section blank, which reads as a deliberate empty state.
  it("treats a payload fetched under a different field set as a miss", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { payload: { title: "Stale" }, fields: "prices pictures" },
      error: null,
    });
    await expect(readCachedListingDetail(LISTING)).resolves.toBeNull();
  });

  it("returns null rather than throwing when the database errors", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });
    await expect(readCachedListingDetail(LISTING)).resolves.toBeNull();
  });

  it("returns null rather than throwing when the client itself blows up", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("no service role key");
    });
    await expect(readCachedListingDetail(LISTING)).resolves.toBeNull();
  });

  // ⚠️ The property this whole module exists for. A fallback to Guesty here
  // would put BEAPI back in the render path, and 105 misses inside one crawler
  // sweep would be 105 BEAPI calls against a ~120/min shared ceiling — the
  // exact stampede the cache was built to stop.
  it("never calls Guesty, even on a miss", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    await readCachedListingDetail(LISTING);
    expect(mockGetListingDetail).not.toHaveBeenCalled();
  });
});
