import { describe, expect, it } from "vitest";
import {
  normalizeListingName,
  normalizeStateCode,
  resolveLocality,
} from "./listing-address";

describe("normalizeStateCode", () => {
  it("converts the spelled-out state to the code Google wants", () => {
    // 203 of 208 active listings say "Colorado".
    expect(normalizeStateCode("Colorado")).toBe("CO");
    expect(normalizeStateCode("colorado")).toBe("CO");
    expect(normalizeStateCode("  Colorado  ")).toBe("CO");
  });

  it("passes through an existing two-letter code, uppercased", () => {
    expect(normalizeStateCode("CO")).toBe("CO");
    expect(normalizeStateCode("co")).toBe("CO");
  });

  it("returns undefined for empty input rather than an empty string", () => {
    expect(normalizeStateCode("")).toBeUndefined();
    expect(normalizeStateCode(null)).toBeUndefined();
    expect(normalizeStateCode(undefined)).toBeUndefined();
  });

  it("leaves an unrecognised state alone instead of guessing", () => {
    // A wrong two-letter code is worse than a verbose correct name.
    expect(normalizeStateCode("Baja California")).toBe("Baja California");
  });
});

describe("resolveLocality", () => {
  // The defect this exists for: 78 active listings carry 81225 while naming
  // the city "Crested Butte". 81225 is Mount Crested Butte.
  it("corrects Crested Butte to Mount Crested Butte for 81225", () => {
    expect(resolveLocality("Crested Butte", "81225")).toBe(
      "Mount Crested Butte"
    );
  });

  it("leaves genuine Crested Butte (81224) alone", () => {
    expect(resolveLocality("Crested Butte", "81224")).toBe("Crested Butte");
  });

  it("matches on the 5-digit prefix so ZIP+4 is corrected too", () => {
    expect(resolveLocality("Crested Butte", "81225-1234")).toBe(
      "Mount Crested Butte"
    );
    // And a ZIP+4 with no correction still returns the Guesty city.
    expect(resolveLocality("Leadville", "80461-9709")).toBe("Leadville");
  });

  it("keeps the Guesty city for postcodes with no correction", () => {
    expect(resolveLocality("Leadville", "80461")).toBe("Leadville");
    expect(resolveLocality("Vail", "81657")).toBe("Vail");
    expect(resolveLocality("Twin Lakes", "81251")).toBe("Twin Lakes");
  });

  it("falls back to the city when the postcode is missing", () => {
    expect(resolveLocality("Granby", null)).toBe("Granby");
    expect(resolveLocality("Granby", "")).toBe("Granby");
  });

  it("still corrects when the city is missing entirely", () => {
    expect(resolveLocality(null, "81225")).toBe("Mount Crested Butte");
  });

  it("returns undefined when there is nothing to say", () => {
    expect(resolveLocality(null, null)).toBeUndefined();
    expect(resolveLocality("   ", undefined)).toBeUndefined();
  });
});

describe("normalizeListingName", () => {
  // " Plaza 2 BR mtn view" leaked into the <title>, the breadcrumb and all
  // five generated FAQ answers.
  it("trims the stray leading space Guesty titles arrive with", () => {
    expect(normalizeListingName(" Plaza 2 BR mtn view")).toBe(
      "Plaza 2 BR mtn view"
    );
  });

  it("collapses internal whitespace runs and newlines", () => {
    expect(normalizeListingName("1BR  Ski-In/Out \n Best Views")).toBe(
      "1BR Ski-In/Out Best Views"
    );
  });

  it("returns undefined for an empty or whitespace-only name", () => {
    expect(normalizeListingName("   ")).toBeUndefined();
    expect(normalizeListingName(null)).toBeUndefined();
  });

  it("leaves a clean name untouched", () => {
    expect(
      normalizeListingName("1BR Leadville Carriage House | W/D | King")
    ).toBe("1BR Leadville Carriage House | W/D | King");
  });
});
