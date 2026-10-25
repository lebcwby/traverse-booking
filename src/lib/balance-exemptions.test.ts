import { describe, expect, it } from "vitest";
import { balanceExemption } from "./balance-exemptions";

describe("balanceExemption", () => {
  it("exempts the two channels that collect from the guest themselves", () => {
    expect(balanceExemption("Booking.com")).toBe("channel_collected");
    expect(balanceExemption("homesVillasByMarriott")).toBe("channel_collected");
  });

  it("keeps exempting owner stays, as before", () => {
    expect(balanceExemption("owner")).toBe("owner_stay");
    expect(balanceExemption("owner-guest")).toBe("owner_stay");
  });

  // Guesty's mirror holds both "expedia" and "Expedia", "manual" and "Manual".
  it("matches regardless of case and punctuation", () => {
    expect(balanceExemption("booking.com")).toBe("channel_collected");
    expect(balanceExemption("BOOKING.COM")).toBe("channel_collected");
    expect(balanceExemption("bookingcom")).toBe("channel_collected");
    expect(balanceExemption("homesvillasbymarriott")).toBe("channel_collected");
    expect(balanceExemption("Owner-Guest")).toBe("owner_stay");
  });

  // The distinction that decides membership: under hotel-collect WE charge the
  // card, so a balance is real money we have not taken. Adding these would
  // silence genuine uncollected revenue.
  it("does NOT exempt hotel-collect OTAs, however OTA-shaped the name", () => {
    for (const source of [
      "expedia",
      "Expedia",
      "VRBO",
      "HomeAway US",
      "Hotels.com",
      "Expedia Affiliate Network",
      "American Express Travel",
      "airbnb2",
      "whimstay",
    ]) {
      expect(balanceExemption(source)).toBeNull();
    }
  });

  it("does NOT exempt our own direct and hand-made bookings", () => {
    // These are the ones the job exists for — `website` and `manual` were 0
    // for 4 on auto-charge in the 2026-08-26 sweep.
    expect(balanceExemption("BE-API")).toBeNull();
    expect(balanceExemption("website")).toBeNull();
    expect(balanceExemption("manual")).toBeNull();
  });

  // An unclassifiable reservation must stay loud. Noise is recoverable;
  // silence is how money goes uncollected.
  it("stays loud for an unknown, empty or missing source", () => {
    expect(balanceExemption(null)).toBeNull();
    expect(balanceExemption(undefined)).toBeNull();
    expect(balanceExemption("")).toBeNull();
    expect(balanceExemption("some-new-channel-2027")).toBeNull();
  });

  // A near-miss must not match: if Guesty renames the source, alerts should
  // come back rather than disappear.
  it("does not match a partial or lookalike name", () => {
    expect(balanceExemption("Booking")).toBeNull();
    expect(balanceExemption("booking.com-affiliate")).toBeNull();
    expect(balanceExemption("Marriott")).toBeNull();
    expect(balanceExemption("Homes & Villas")).toBeNull();
  });
});
