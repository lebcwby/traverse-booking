import { describe, expect, it } from "vitest";
import {
  compareNight,
  hasAnythingToShow,
  lastYearEquivalent,
  totalsFor,
} from "./yoy-revenue";

const LIVE_SINCE = { firstStayDate: "2024-01-01" };

describe("lastYearEquivalent", () => {
  // Weekend pricing is the biggest driver of a nightly rate, so comparing a
  // Tuesday with a Wednesday would be comparing the wrong thing.
  it("lands on the same weekday", () => {
    const d = "2026-10-27"; // Tuesday
    const ly = lastYearEquivalent(d);
    expect(ly).toBe("2025-10-28");
    expect(new Date(`${ly}T12:00:00Z`).getUTCDay()).toBe(
      new Date(`${d}T12:00:00Z`).getUTCDay()
    );
  });

  it("holds across a leap year", () => {
    const d = "2026-03-02";
    expect(new Date(`${lastYearEquivalent(d)}T12:00:00Z`).getUTCDay()).toBe(
      new Date(`${d}T12:00:00Z`).getUTCDay()
    );
  });
});

describe("compareNight", () => {
  it("credits only the difference when the night sold last year", () => {
    const n = compareNight("2026-10-27", 150, { earned: 120, ...LIVE_SINCE });
    expect(n.state).toBe("booked");
    expect(n.net).toBe(30);
  });

  it("reports a loss when we sold it cheaper than last year", () => {
    const n = compareNight("2026-10-27", 100, { earned: 140, ...LIVE_SINCE });
    expect(n.net).toBe(-40);
  });

  it("credits the whole rate when the night went unsold last year", () => {
    const n = compareNight("2026-10-27", 150, { earned: null, ...LIVE_SINCE });
    expect(n.state).toBe("vacant");
    expect(n.net).toBe(150);
  });

  // The case that prompted all of this: GY-gADdgJQC sits on a listing created
  // 2025-10-10 whose first stay was 2025-11-01, so last year's equivalent
  // nights predate it ever selling. Calling that "vacant" would invent
  // $355.86 of incremental revenue.
  it("refuses to compare a night from before the listing was selling", () => {
    const n = compareNight("2026-10-27", 118.62, {
      earned: null,
      firstStayDate: "2025-11-01",
    });
    expect(n.lastYearDate).toBe("2025-10-28");
    expect(n.state).toBe("no_comparable");
    expect(n.net).toBeNull();
  });

  it("treats a listing with no history at all as incomparable", () => {
    const n = compareNight("2026-10-27", 150, {
      earned: null,
      firstStayDate: null,
    });
    expect(n.state).toBe("no_comparable");
    expect(n.net).toBeNull();
  });

  // A night ON the first-stay date is comparable; the listing was selling.
  it("includes the boundary date", () => {
    const n = compareNight("2026-10-27", 150, {
      earned: null,
      firstStayDate: "2025-10-28",
    });
    expect(n.state).toBe("vacant");
    expect(n.net).toBe(150);
  });

  it("leaves net null when we do not know this year's rate either", () => {
    expect(
      compareNight("2026-10-27", null, { earned: 120, ...LIVE_SINCE }).net
    ).toBeNull();
  });
});

describe("totalsFor", () => {
  it("sums only the nights it could compare", () => {
    const nights = [
      compareNight("2026-10-27", 150, { earned: 120, ...LIVE_SINCE }),
      compareNight("2026-10-28", 150, { earned: null, ...LIVE_SINCE }),
      compareNight("2026-10-29", 150, {
        earned: null,
        firstStayDate: "2026-01-01",
      }),
    ];
    const t = totalsFor(nights);
    expect(t.nights).toBe(3);
    expect(t.comparableNights).toBe(2);
    expect(t.netTotal).toBe(180); // 30 + 150, the third contributes nothing
    expect(t.thisYearTotal).toBe(450);
    expect(t.lastYearTotal).toBe(120);
  });

  // The specific bug in the email: a bold "$0" read as "this booking added
  // nothing", when it meant "we have no data".
  it("returns null, not zero, when nothing could be compared", () => {
    const nights = [
      compareNight("2026-10-27", 118.62, {
        earned: null,
        firstStayDate: "2025-11-01",
      }),
    ];
    expect(totalsFor(nights).netTotal).toBeNull();
    expect(totalsFor(nights).comparableNights).toBe(0);
  });
});

describe("hasAnythingToShow", () => {
  it("is false when every figure is missing — render nothing at all", () => {
    const nights = ["2026-10-27", "2026-10-28"].map((d) =>
      compareNight(d, null, { earned: null, firstStayDate: null })
    );
    expect(hasAnythingToShow(nights)).toBe(false);
  });

  it("is true as soon as one real number exists", () => {
    const nights = [
      compareNight("2026-10-27", 150, { earned: null, firstStayDate: null }),
    ];
    expect(hasAnythingToShow(nights)).toBe(true);
  });
});
