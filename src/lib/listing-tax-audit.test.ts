// Tests for the tax-configuration drift check.
//
// The fixtures mirror the REAL portfolio distribution as of 2026-11-11,
// because the whole difficulty here is telling a second jurisdiction apart
// from a mistake, and only real proportions exercise that:
//
//   Crested Butte  98 @ 9.9% | 6 @ 12.9% | 1 @ 9%        ← last two are wrong
//   Leadville      53 @ 5.42% (in town) | 28 @ 1.9% (county) | 6 with none
//   Twin Lakes      7 @ 1.9%
//   Vail/Avon/Frisco/Granby   1–3 listings each, all different
//
// A flat "2 or fewer listings is an outlier" rule MISSED the six at 12.9%,
// which is exactly the group an accountant found by hand. A rule that flags
// any minority would report Leadville's 28 county properties every night
// until someone muted it.

import { describe, expect, it } from "vitest";
import {
  auditListingTaxes,
  findingsFingerprint,
  outlierThreshold,
  ratesSignature,
  type ListingTaxSnapshot,
} from "./listing-tax-audit";

const pct = (type: string, amount: number) => ({
  type,
  units: "PERCENTAGE",
  amount,
});
const CB = (tot: number) => [
  pct("TRANSIENT_OCCUPANCY_TAX", tot),
  pct("COUNTY_TAX", 6),
  pct("STATE_TAX", 2.9),
];
const LEAD = (tot: number) => [
  pct("TRANSIENT_OCCUPANCY_TAX", tot),
  pct("COUNTY_TAX", 4),
  pct("STATE_TAX", 2.9),
];

function many(
  n: number,
  city: string,
  prefix: string,
  taxes: ListingTaxSnapshot["taxes"]
): ListingTaxSnapshot[] {
  return Array.from({ length: n }, (_, i) => ({
    listingId: `${prefix}-${i}`,
    nickname: `${prefix}:${i}`,
    city,
    taxes,
  }));
}

/** The portfolio as it really is. */
function realWorldPortfolio(): ListingTaxSnapshot[] {
  return [
    ...many(98, "Crested Butte", "CB-norm", CB(9.9)),
    ...many(6, "Crested Butte", "CB-lms", CB(12.9)),
    ...many(1, "Crested Butte", "CB-gl279", CB(9)),
    ...many(53, "Leadville", "LEAD-town", LEAD(5.42)),
    ...many(28, "Leadville", "LEAD-county", LEAD(1.9)),
    ...many(7, "Twin Lakes", "TWIN", LEAD(1.9)),
    ...many(1, "Vail", "VAIL-a", [
      pct("TRANSIENT_OCCUPANCY_TAX", 2),
      pct("COUNTY_TAX", 2),
      pct("STATE_TAX", 2.9),
    ]),
    ...many(1, "Vail", "VAIL-b", [
      pct("TRANSIENT_OCCUPANCY_TAX", 5.9),
      pct("COUNTY_TAX", 2),
      pct("STATE_TAX", 2.9),
    ]),
    ...many(3, "Granby", "GRANB", [
      pct("TRANSIENT_OCCUPANCY_TAX", 4),
      pct("COUNTY_TAX", 3.3),
      pct("STATE_TAX", 2.9),
    ]),
  ];
}

const kindsFor = (findings: ReturnType<typeof auditListingTaxes>, id: string) =>
  findings.filter((f) => f.listingId.startsWith(id)).map((f) => f.kind);

describe("auditListingTaxes — against the real distribution", () => {
  const findings = auditListingTaxes(realWorldPortfolio());

  it("flags the six Crested Butte listings at 12.9%", () => {
    // The case an accountant caught by hand. Six is small against 98 but not
    // small in absolute terms, which is what a naive threshold misses.
    expect(kindsFor(findings, "CB-lms")).toEqual(Array(6).fill("rare_rates"));
  });

  it("flags the single listing at 9% instead of 9.9%", () => {
    expect(kindsFor(findings, "CB-gl279")).toEqual(["rare_rates"]);
  });

  it("does NOT flag Leadville's 28 county properties", () => {
    // The legitimate second jurisdiction. Flagging these nightly is how an
    // audit gets muted and stops being read.
    expect(kindsFor(findings, "LEAD-county")).toEqual([]);
  });

  it("does not flag either dominant group", () => {
    expect(kindsFor(findings, "CB-norm")).toEqual([]);
    expect(kindsFor(findings, "LEAD-town")).toEqual([]);
  });

  it("stays silent on markets too small to have a norm", () => {
    // Vail has two listings on different rates and Granby three; neither has
    // a majority to deviate from, so there is nothing to say.
    for (const id of ["VAIL-a", "VAIL-b", "GRANB", "TWIN"]) {
      expect(kindsFor(findings, id)).toEqual([]);
    }
  });

  it("reports what the peers do, so the finding is actionable alone", () => {
    const f = findings.find((x) => x.listingId.startsWith("CB-lms"))!;
    expect(f.rates).toContain("TRANSIENT_OCCUPANCY_TAX=12.9");
    expect(f.peers).toContain("TRANSIENT_OCCUPANCY_TAX=9.9");
    expect(f.detail).toContain("98");
  });
});

describe("auditListingTaxes — per-listing problems", () => {
  it("flags an active listing with no taxes at all, in any market", () => {
    // 800PopUnitB/C: quoting direct bookings at zero tax while the two other
    // units in the same building were taxed.
    const findings = auditListingTaxes([
      ...many(53, "Leadville", "LEAD-town", LEAD(5.42)),
      { listingId: "800B", nickname: "LEAD:800PopUnitB1bed", city: "Leadville", taxes: [] },
      // Denver has only this one listing — too small for a peer comparison,
      // but "no tax at all" needs no peers to be worth reporting.
      { listingId: "DEN1", nickname: "DEN:802W12", city: "Denver", taxes: [] },
    ]);
    expect(kindsFor(findings, "800B")).toEqual(["no_tax_config"]);
    expect(kindsFor(findings, "DEN1")).toEqual(["no_tax_config"]);
  });

  it("does not also call an empty config a rare one", () => {
    const findings = auditListingTaxes([
      ...many(20, "Leadville", "LEAD-town", LEAD(5.42)),
      { listingId: "E", nickname: "empty", city: "Leadville", taxes: [] },
    ]);
    expect(kindsFor(findings, "E")).toEqual(["no_tax_config"]);
  });

  it("flags a FIXED levy, which can show no rate at checkout", () => {
    const findings = auditListingTaxes([
      ...many(20, "Leadville", "LEAD-town", LEAD(5.42)),
      {
        listingId: "F",
        nickname: "fixed",
        city: "Leadville",
        taxes: [...LEAD(5.42), { type: "CITY_TAX", units: "FIXED", amount: 4 }],
      },
    ]);
    expect(kindsFor(findings, "F")).toContain("non_percentage");
  });

  it("flags a duplicated tax type, which makes the rate ambiguous", () => {
    const findings = auditListingTaxes([
      ...many(20, "Leadville", "LEAD-town", LEAD(5.42)),
      {
        listingId: "D",
        nickname: "dupe",
        city: "Leadville",
        taxes: [...LEAD(5.42), pct("STATE_TAX", 4.1)],
      },
    ]);
    expect(kindsFor(findings, "D")).toContain("duplicate_type");
  });
});

describe("thresholds and fingerprinting", () => {
  it("scales the outlier threshold with the dominant group", () => {
    expect(outlierThreshold(98)).toBe(10); // catches 6 @ 12.9%
    expect(outlierThreshold(53)).toBe(6); // leaves 28 county listings alone
    expect(outlierThreshold(5)).toBe(2); // never below 2
  });

  it("renders a signature that is stable regardless of entry order", () => {
    expect(ratesSignature(CB(9.9))).toBe(ratesSignature([...CB(9.9)].reverse()));
    expect(ratesSignature([])).toBe("(none)");
  });

  it("changes the fingerprint only when the findings change", () => {
    const base = realWorldPortfolio();
    const same = findingsFingerprint(auditListingTaxes(base));
    expect(findingsFingerprint(auditListingTaxes([...base].reverse()))).toBe(
      same
    );

    const worse = [
      ...base,
      { listingId: "NEW", nickname: "new", city: "Leadville", taxes: [] },
    ];
    expect(findingsFingerprint(auditListingTaxes(worse))).not.toBe(same);
  });
});
