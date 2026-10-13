import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch, mockGetListing, mockGetAvailability } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGetListing: vi.fn(),
  mockGetAvailability: vi.fn(),
}));

// Only the DB-touching functions are mocked; the validators are the real ones,
// because their behaviour is what these tests are about.
vi.mock("./agent-api", async () => {
  const actual =
    await vi.importActual<typeof import("./agent-api")>("./agent-api");
  return {
    ...actual,
    searchAvailableListings: mockSearch,
    getPublicListing: mockGetListing,
    getAvailability: mockGetAvailability,
  };
});

import {
  callMcpTool,
  MCP_TOOLS,
  negotiateProtocolVersion,
  PREFERRED_PROTOCOL_VERSION,
} from "./mcp-tools";

const ID = "69ea3d24f11d6f0014c2c3f2";
const parse = (r: { content: Array<{ text: string }> }) =>
  JSON.parse(r.content[0].text);

beforeEach(() => {
  mockSearch.mockReset().mockResolvedValue([]);
  mockGetListing.mockReset().mockResolvedValue({
    id: ID,
    name: "Lodge unit",
    url: "https://www.booktraverse.com/properties/lodge-" + ID,
  });
  mockGetAvailability.mockReset().mockResolvedValue([]);
});

describe("tool contract", () => {
  it("exposes exactly the three read tools — no booking or payment tool", () => {
    expect(MCP_TOOLS.map((t) => t.name)).toEqual([
      "search_listings",
      "get_listing",
      "check_availability",
    ]);
  });

  it("every tool declares required inputs", () => {
    for (const t of MCP_TOOLS) {
      expect(t.inputSchema.type, t.name).toBe("object");
      expect(t.inputSchema.required.length, t.name).toBeGreaterThan(0);
    }
  });

  // An assistant reads the description to decide whether our number is safe to
  // quote to a traveller. If that warning goes missing, it will quote a price
  // the guest will not be charged.
  it("warns about indicative pricing on every tool that returns a price", () => {
    for (const name of ["search_listings", "check_availability"]) {
      const t = MCP_TOOLS.find((x) => x.name === name)!;
      expect(t.description, name).toMatch(/INDICATIVE/);
      expect(t.description, name).toMatch(/checkout/i);
    }
  });
});

describe("negotiateProtocolVersion", () => {
  it("echoes a version we support", () => {
    expect(negotiateProtocolVersion("2025-03-26")).toBe("2025-03-26");
    expect(negotiateProtocolVersion("2024-11-05")).toBe("2024-11-05");
  });

  it("falls back to our preferred version for anything else", () => {
    expect(negotiateProtocolVersion("1999-01-01")).toBe(
      PREFERRED_PROTOCOL_VERSION
    );
    expect(negotiateProtocolVersion(undefined)).toBe(
      PREFERRED_PROTOCOL_VERSION
    );
    expect(negotiateProtocolVersion(42)).toBe(PREFERRED_PROTOCOL_VERSION);
  });
});

describe("search_listings", () => {
  it("requires real dates and never reaches the database without them", async () => {
    for (const args of [
      {},
      { checkIn: "2027-02-12" },
      { checkIn: "2027-02-31", checkOut: "2027-03-02" }, // pattern-valid, not a real date
      { checkIn: "12/02/2027", checkOut: "15/02/2027" },
    ]) {
      const r = await callMcpTool("search_listings", args);
      expect(r.isError, JSON.stringify(args)).toBe(true);
    }
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("rejects an inverted or over-long stay", async () => {
    const back = await callMcpTool("search_listings", {
      checkIn: "2027-02-15",
      checkOut: "2027-02-12",
    });
    expect(back.isError).toBe(true);
    const long = await callMcpTool("search_listings", {
      checkIn: "2027-02-01",
      checkOut: "2027-03-20",
    });
    expect(long.isError).toBe(true);
    expect(long.content[0].text).toMatch(/30 nights/);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric filter rather than silently dropping it", async () => {
    const r = await callMcpTool("search_listings", {
      checkIn: "2027-02-12",
      checkOut: "2027-02-15",
      guests: "lots",
    });
    expect(r.isError).toBe(true);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("passes a valid query through and carries the pricing disclosure", async () => {
    mockSearch.mockResolvedValue([{ id: ID, name: "A", stay: { nights: 3 } }]);
    const r = await callMcpTool("search_listings", {
      checkIn: "2027-02-12",
      checkOut: "2027-02-15",
      guests: 6,
      city: "Leadville",
    });
    expect(r.isError).toBeUndefined();
    const out = parse(r);
    expect(out.query.nights).toBe(3);
    expect(out.resultCount).toBe(1);
    // The model must be told the number is not authoritative.
    expect(out.pricing.authoritative).toBe(false);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ guests: 6, city: "Leadville" })
    );
  });
});

describe("get_listing", () => {
  it("rejects a malformed id before touching the database", async () => {
    const r = await callMcpTool("get_listing", { listingId: "not-an-id" });
    expect(r.isError).toBe(true);
    expect(mockGetListing).not.toHaveBeenCalled();
  });

  it("reports a well-formed but unknown id as an error, not an empty object", async () => {
    mockGetListing.mockResolvedValue(null);
    const r = await callMcpTool("get_listing", { listingId: "a".repeat(24) });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/No active listing/);
  });

  it("returns the listing", async () => {
    const r = await callMcpTool("get_listing", { listingId: ID });
    expect(r.isError).toBeUndefined();
    expect(parse(r).listing.id).toBe(ID);
  });
});

describe("check_availability", () => {
  it("caps the window at 90 days", async () => {
    const r = await callMcpTool("check_availability", {
      listingId: ID,
      from: "2027-02-01",
      to: "2027-08-20",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/90 days/);
    expect(mockGetAvailability).not.toHaveBeenCalled();
  });

  it("returns days for a valid window", async () => {
    mockGetAvailability.mockResolvedValue([
      { date: "2027-02-01", available: true, nightlyRate: 223 },
    ]);
    const r = await callMcpTool("check_availability", {
      listingId: ID,
      from: "2027-02-01",
      to: "2027-02-10",
    });
    expect(r.isError).toBeUndefined();
    const out = parse(r);
    expect(out.dayCount).toBe(1);
    expect(out.listingUrl).toContain("/properties/");
    expect(out.pricing.authoritative).toBe(false);
  });
});

describe("unknown tool", () => {
  it("is an error result rather than a throw", async () => {
    const r = await callMcpTool("book_reservation", {});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Unknown tool/);
  });
});
