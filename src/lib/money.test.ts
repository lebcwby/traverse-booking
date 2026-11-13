import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents } from "./money";

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(50)).toBe(5000);
  });

  it("converts the $46.29 tax-netted pet fee", () => {
    expect(dollarsToCents(46.29)).toBe(4629);
  });

  it("converts the $5.77 shortfall", () => {
    expect(dollarsToCents(5.77)).toBe(577);
  });

  it("rounds, rather than truncates, half-cents", () => {
    expect(dollarsToCents(0.005)).toBe(1);
    expect(dollarsToCents(0.004)).toBe(0);
  });

  it("handles zero", () => {
    expect(dollarsToCents(0)).toBe(0);
  });
});

describe("centsToDollars", () => {
  it("converts whole dollars", () => {
    expect(centsToDollars(5000)).toBe(50);
  });

  it("converts the balance recorded for a short payment", () => {
    expect(centsToDollars(4629)).toBe(46.29);
  });

  it("converts a top-up amount", () => {
    expect(centsToDollars(577)).toBe(5.77);
  });

  it("handles zero", () => {
    expect(centsToDollars(0)).toBe(0);
  });
});

describe("round trip", () => {
  it("returns the original dollar amount for integer-cent values", () => {
    for (const d of [0, 0.01, 0.5, 1, 5.77, 46.29, 50, 99.99, 1234.56]) {
      expect(centsToDollars(dollarsToCents(d))).toBe(d);
    }
  });
});
