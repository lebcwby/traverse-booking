import { describe, expect, it } from "vitest";
import {
  AGENT_LISTING_COLUMNS,
  isValidDate,
  nightsBetween,
  toPublicListing,
} from "./agent-api";

describe("AGENT_LISTING_COLUMNS — the privacy allow-list", () => {
  // The whole point of an allow-list is that adding a sensitive column to the
  // mirror cannot silently publish it. This test is the guard.
  it("never includes an owner, money or operational column", () => {
    const forbidden = [
      "owners",
      "financials",
      "custom_fields",
      "wheelhouse_data",
      "occupancy_stats",
      "host_name",
      "contact_phone",
      "nickname",
      "cleaning_status",
      "integrations",
    ];
    for (const col of forbidden) {
      expect(AGENT_LISTING_COLUMNS as readonly string[], col).not.toContain(
        col
      );
    }
  });

  it("includes tags only because building membership is derived from them", () => {
    // tags IS read, but must never reach the response — live values include
    // "REMAX", "H&V" and "Lake County Zone". toPublicListing is what enforces
    // that; see the test below.
    expect(AGENT_LISTING_COLUMNS as readonly string[]).toContain("tags");
  });
});

const row = (over: Record<string, unknown> = {}) =>
  ({
    guesty_id: "69ea3d24f11d6f0014c2c3f2",
    title: "  Lodge at Mountaineer Square 3 Bedroom  ",
    property_type: "Apartment",
    room_type: "Entire home/apt",
    bedrooms: 3,
    bathrooms: 3,
    beds: 4,
    accommodates: 8,
    address: {
      city: "Crested Butte",
      state: "Colorado",
      zipcode: "81225",
      country: "United States",
      lat: 38.899,
      lng: -106.967,
      street: "620 Gothic Road",
      full: "620 Gothic Road, Mt Crested Butte, CO",
    },
    picture: "https://assets.guesty.com/a.jpg",
    amenities: ["Hot tub", "Wifi"],
    default_check_in_time: "16:00",
    default_check_out_time: "10:00",
    tags: [
      "REMAX",
      "H&V",
      "Lake County Zone",
      "The Lodge at Mountaineer Square",
      "google review",
    ],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("toPublicListing", () => {
  it("never leaks raw tags, which carry owner and vendor names", () => {
    const out = toPublicListing(row());
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("REMAX");
    expect(serialized).not.toContain("H&V");
    expect(serialized).not.toContain("Lake County Zone");
    expect(serialized).not.toContain("google review");
    expect(out).not.toHaveProperty("tags");
  });

  it("derives the building from tags instead", () => {
    expect(toPublicListing(row()).building).toEqual({
      name: "The Lodge at Mountaineer Square",
      url: "https://www.booktraverse.com/crested-butte/lodge-at-mountaineer-square",
    });
  });

  it("returns null building for a unit in no managed building", () => {
    expect(
      toPublicListing(row({ tags: ["cabin", "REMAX"] })).building
    ).toBeNull();
  });

  it("applies the same postcode locality correction as the listing pages", () => {
    // 81225 is Mount Crested Butte even though Guesty says "Crested Butte".
    const out = toPublicListing(row());
    expect(out.location.city).toBe("Mount Crested Butte");
    expect(out.location.state).toBe("CO");
  });

  it("trims the stray whitespace Guesty titles carry", () => {
    expect(toPublicListing(row()).name).toBe(
      "Lodge at Mountaineer Square 3 Bedroom"
    );
  });

  it("builds a bookable canonical url", () => {
    expect(toPublicListing(row()).url).toBe(
      "https://www.booktraverse.com/properties/lodge-at-mountaineer-square-3-bedroom-69ea3d24f11d6f0014c2c3f2"
    );
  });

  it("survives a listing with almost nothing populated", () => {
    const out = toPublicListing(
      row({
        address: null,
        amenities: null,
        tags: null,
        picture: null,
        bedrooms: null,
        accommodates: null,
      })
    );
    expect(out.location.city).toBeNull();
    expect(out.amenities).toEqual([]);
    expect(out.building).toBeNull();
    expect(out.photo).toBeNull();
  });
});

describe("isValidDate", () => {
  it("accepts a real date", () => {
    expect(isValidDate("2027-02-12")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true); // leap year
  });

  it("rejects an impossible date that matches the pattern", () => {
    // The regex alone would pass these; Date round-tripping catches them.
    expect(isValidDate("2027-02-31")).toBe(false);
    expect(isValidDate("2027-13-01")).toBe(false);
    expect(isValidDate("2027-02-29")).toBe(false); // not a leap year
  });

  it("rejects anything not in YYYY-MM-DD form", () => {
    expect(isValidDate("12/02/2027")).toBe(false);
    expect(isValidDate("2027-2-12")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate("2027-02-12T00:00:00Z")).toBe(false);
  });
});

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2027-02-12", "2027-02-15")).toBe(3);
    expect(nightsBetween("2027-02-12", "2027-02-13")).toBe(1);
  });

  it("returns 0 or negative for a non-stay, so callers can reject it", () => {
    expect(nightsBetween("2027-02-12", "2027-02-12")).toBe(0);
    expect(nightsBetween("2027-02-15", "2027-02-12")).toBe(-3);
  });

  it("is unaffected by a DST boundary", () => {
    // US DST starts 2027-03-14. A naive local-time diff would give 29.958
    // days here and round wrong; UTC parsing keeps it exact.
    expect(nightsBetween("2027-03-01", "2027-03-31")).toBe(30);
  });

  it("spans a year boundary", () => {
    expect(nightsBetween("2026-12-28", "2027-01-04")).toBe(7);
  });
});
