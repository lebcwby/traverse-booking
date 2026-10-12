import { describe, expect, it } from "vitest";
import {
  extractCalendarDays,
  mapCalendarDay,
  windowDates,
} from "./calendar-sync";

const AT = 1760000000000;
const LISTING = "69ea3d24f11d6f0014c2c3f2";

describe("extractCalendarDays", () => {
  // The endpoint had no caller in the repo, so the envelope is accepted in
  // every documented shape rather than assumed to be one of them.
  it("accepts {data:{days:[...]}}", () => {
    expect(
      extractCalendarDays({ data: { days: [{ date: "2027-01-01" }] } })
    ).toHaveLength(1);
  });

  it("accepts {days:[...]}", () => {
    expect(
      extractCalendarDays({ days: [{ date: "2027-01-01" }] })
    ).toHaveLength(1);
  });

  it("accepts {data:[...]}", () => {
    expect(
      extractCalendarDays({ data: [{ date: "2027-01-01" }] })
    ).toHaveLength(1);
  });

  it("accepts a bare array", () => {
    expect(extractCalendarDays([{ date: "2027-01-01" }])).toHaveLength(1);
  });

  it("returns [] for an unexpected shape instead of throwing", () => {
    // Surfaces as "0 days" in the run summary rather than taking the sync down.
    expect(extractCalendarDays(null)).toEqual([]);
    expect(extractCalendarDays("nope")).toEqual([]);
    expect(extractCalendarDays({ unexpected: true })).toEqual([]);
  });
});

describe("mapCalendarDay", () => {
  it("maps a full Guesty day onto the table's columns", () => {
    const row = mapCalendarDay(
      LISTING,
      {
        date: "2027-03-10",
        currency: "USD",
        price: 223,
        isBasePrice: false,
        minNights: 4,
        isBaseMinNights: false,
        status: "available",
        blocks: { m: false, b: false },
        cta: false,
        ctd: false,
        allotment: 1,
      },
      AT
    );
    expect(row).toEqual({
      listing_id: LISTING,
      date: "2027-03-10",
      price: 223,
      currency: "USD",
      is_base_price: false,
      min_nights: 4,
      is_base_min_nights: false,
      status: "available",
      raw_status: "available",
      blocks: { m: false, b: false },
      cta: false,
      ctd: false,
      allotment: 1,
      last_synced_at: AT,
    });
  });

  it("drops a day with no usable date — it has no unique key", () => {
    expect(mapCalendarDay(LISTING, { price: 200 }, AT)).toBeNull();
    expect(mapCalendarDay(LISTING, { date: "nonsense" }, AT)).toBeNull();
  });

  it("trims an ISO timestamp down to the date", () => {
    expect(
      mapCalendarDay(LISTING, { date: "2027-03-10T00:00:00.000Z" }, AT)?.date
    ).toBe("2027-03-10");
  });

  // The price feed skips any day whose price is not a positive number, so a
  // junk price must become NULL rather than 0 or NaN.
  it("stores only a positive finite price", () => {
    const p = (price: unknown) =>
      mapCalendarDay(
        LISTING,
        { date: "2027-03-10", price: price as number },
        AT
      )?.price;
    expect(p(223)).toBe(223);
    expect(p(0)).toBeNull();
    expect(p(-5)).toBeNull();
    expect(p(NaN)).toBeNull();
    expect(p("223")).toBeNull();
    expect(p(undefined)).toBeNull();
  });

  // Anything we are not sure is bookable must not be called "available",
  // because the price feed publishes exactly the available days.
  it("normalises status conservatively and keeps the raw word", () => {
    const s = (status: string) =>
      mapCalendarDay(LISTING, { date: "2027-03-10", status }, AT);
    expect(s("available")?.status).toBe("available");
    expect(s("AVAILABLE")?.status).toBe("available");
    expect(s("booked")?.status).toBe("booked");
    expect(s("reserved")?.status).toBe("booked");
    expect(s("unavailable")?.status).toBe("unavailable");
    expect(s("blocked")?.status).toBe("unavailable");
    // An unrecognised status is NOT promoted to available.
    expect(s("something-new")?.status).toBe("something-new");
    expect(s("something-new")?.raw_status).toBe("something-new");
    expect(mapCalendarDay(LISTING, { date: "2027-03-10" }, AT)?.status).toBe(
      "unknown"
    );
  });

  it("nulls missing optional fields rather than inventing defaults", () => {
    const row = mapCalendarDay(LISTING, { date: "2027-03-10" }, AT);
    expect(row).toMatchObject({
      price: null,
      currency: null,
      is_base_price: null,
      min_nights: null,
      is_base_min_nights: null,
      blocks: null,
      cta: null,
      ctd: null,
      allotment: null,
    });
  });

  it("keeps a legitimate zero allotment and false flags", () => {
    const row = mapCalendarDay(
      LISTING,
      { date: "2027-03-10", allotment: 0, cta: false, isBasePrice: false },
      AT
    );
    expect(row?.allotment).toBe(0);
    expect(row?.cta).toBe(false);
    expect(row?.is_base_price).toBe(false);
  });
});

describe("windowDates", () => {
  it("covers a year from the given day", () => {
    const { start, end } = windowDates(new Date("2026-10-12T00:00:00Z"));
    expect(start).toBe("2026-10-12");
    expect(end).toBe("2027-10-12");
  });

  it("crosses a month and year boundary correctly", () => {
    const { start, end } = windowDates(new Date("2026-12-31T00:00:00Z"));
    expect(start).toBe("2026-12-31");
    expect(end).toBe("2027-12-31");
  });
});
