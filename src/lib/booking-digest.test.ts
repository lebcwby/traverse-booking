import { describe, expect, it } from "vitest";
import {
  buildDigest,
  formatChannel,
  renderSlackBlocks,
  rowToBooking,
  shortGuestName,
} from "./booking-digest";

const cookies = (
  attribution?: object,
  firstTouch?: object,
  clickPath?: string
) => ({
  cookies: {
    ...(attribution ? { attribution: JSON.stringify(attribution) } : {}),
    ...(firstTouch ? { firstTouch: JSON.stringify(firstTouch) } : {}),
    ...(clickPath ? { clickPath } : {}),
  },
});

const row = (over: Record<string, unknown> = {}) => ({
  reservation_id: "GY-abc123",
  guest: { firstName: "Kelly", lastName: "Watson" },
  tracking: {
    listingTitle: "Plaza 339",
    checkIn: "2026-10-23",
    checkOut: "2026-10-26",
    guests: 3,
    totalPaid: 993.3,
  },
  tracking_context: cookies({
    utm_source: "google",
    utm_medium: "cpc",
    landingPage: "/crested-butte",
    capturedAt: "2026-10-18T09:00:00.000Z",
  }),
  created_at: "2026-10-18T10:00:00.000Z",
  completed_at: "2026-10-18T10:12:00.000Z",
  ...over,
});

describe("formatChannel", () => {
  it("renders source / medium the way GA4 does, so the two can be compared", () => {
    expect(formatChannel({ utm_source: "google", utm_medium: "cpc" })).toBe(
      "google / cpc"
    );
    expect(
      formatChannel({ utm_source: "chatgpt", utm_medium: "ai_agent" })
    ).toBe("chatgpt / ai_agent");
  });

  it("falls back to the ad-click id when the link carried no utm", () => {
    expect(formatChannel({ gclid: "abc" })).toBe("google / cpc (gclid)");
    expect(formatChannel({ fbclid: "abc" })).toBe("facebook / paid (fbclid)");
    expect(formatChannel({ msclkid: "abc" })).toBe("bing / cpc (msclkid)");
  });

  it("says direct when there is genuinely nothing", () => {
    expect(formatChannel(null)).toBe("(direct) / (none)");
    expect(formatChannel({})).toBe("(direct) / (none)");
  });

  // An untagged visit carries no utm and no click id. Before 2026-10-19 we
  // recorded nothing for these and called every one of them "(direct)",
  // which for an organic Google visitor is simply wrong.
  it("uses the referring site when the visit carried no tagging at all", () => {
    expect(formatChannel({ referrer: "https://www.google.com" })).toBe(
      "google.com / referral"
    );
    expect(
      formatChannel({ referrer: "https://www.tripadvisor.com/Hotel_Review" })
    ).toBe("tripadvisor.com / referral");
  });

  it("prefers real campaign tagging over the referrer", () => {
    expect(
      formatChannel({
        utm_source: "newsletter",
        utm_medium: "email",
        referrer: "https://mail.google.com",
      })
    ).toBe("newsletter / email");
  });

  it("falls back to direct on a referrer it cannot parse", () => {
    expect(formatChannel({ referrer: "not a url" })).toBe("(direct) / (none)");
  });

  it("marks a half-tagged link rather than guessing the missing half", () => {
    expect(formatChannel({ utm_source: "newsletter" })).toBe(
      "newsletter / (not set)"
    );
  });
});

describe("shortGuestName", () => {
  it("gives first name and last initial — enough to recognise, no more", () => {
    expect(shortGuestName({ firstName: "Kelly", lastName: "Watson" })).toBe(
      "Kelly W."
    );
    expect(shortGuestName({ firstName: "Kelly" })).toBe("Kelly");
    expect(shortGuestName(null)).toBe("(no name)");
  });
});

describe("rowToBooking", () => {
  it("pulls the booking detail and the converting channel", () => {
    const b = rowToBooking(row());
    expect(b.listingTitle).toBe("Plaza 339");
    expect(b.totalPaid).toBe(993.3);
    expect(b.guestName).toBe("Kelly W.");
    expect(b.source).toBe("google / cpc");
    expect(b.landingPage).toBe("/crested-butte");
    expect(b.minutesInCheckout).toBe(12);
  });

  // The most useful thing here, and invisible in GA4's default reports: the
  // channel that FOUND the guest is often not the one that closed them.
  it("surfaces first touch only when it differs from last touch", () => {
    const same = rowToBooking(row());
    expect(same.firstTouchSource).toBeNull();

    const differs = rowToBooking(
      row({
        tracking_context: cookies(
          { utm_source: "google", utm_medium: "cpc" },
          {
            utm_source: "travelcrestedbutte",
            utm_medium: "referral",
            capturedAt: "2026-10-11T09:00:00.000Z",
          }
        ),
      })
    );
    expect(differs.firstTouchSource).toBe("travelcrestedbutte / referral");
    // 7 days from first touch to booked.
    expect(differs.minutesFromFirstTouch).toBe(7 * 24 * 60 + 72);
  });

  // The whole point of the 2026-10-19 proxy change: an untagged booking now
  // has a landing page and a referrer, and both must reach the digest.
  it("reads the landing page and channel from first touch when there was no campaign", () => {
    const b = rowToBooking(
      row({
        tracking_context: cookies(undefined, {
          landingPage: "/crested-butte/grand-lodge",
          referrer: "https://www.google.com",
          capturedAt: "2026-10-18T09:30:00.000Z",
        }),
      })
    );
    expect(b.source).toBe("google.com / referral");
    expect(b.landingPage).toBe("/crested-butte/grand-lodge");
    expect(b.referrer).toBe("https://www.google.com");
    // First touch IS the last touch here — don't render it twice.
    expect(b.firstTouchSource).toBeNull();
  });

  it("derives a landing page from the click path when no cookie carried one", () => {
    const b = rowToBooking(
      row({
        tracking_context: cookies(
          undefined,
          undefined,
          "v1~1760776800~0~/leadville:0~/book/q1:300"
        ),
      })
    );
    expect(b.landingPage).toBe("/leadville");
    expect(b.clickPath).toBe("/leadville → /book/q1");
    expect(b.pagesViewed).toBe(2);
    expect(b.minutesOnSite).toBe(5);
  });

  it("leaves the path fields null when nothing was recorded", () => {
    const b = rowToBooking(row());
    expect(b.clickPath).toBeNull();
    expect(b.pagesViewed).toBeNull();
    expect(b.minutesOnSite).toBeNull();
    expect(b.referrer).toBeNull();
  });

  it("survives missing or malformed attribution without throwing", () => {
    expect(rowToBooking(row({ tracking_context: null })).source).toBe(
      "(direct) / (none)"
    );
    expect(
      rowToBooking(
        row({ tracking_context: { cookies: { attribution: "{bad" } } })
      ).source
    ).toBe("(direct) / (none)");
    expect(rowToBooking(row({ tracking: null })).listingTitle).toBe(
      "(unknown listing)"
    );
  });

  it("returns null rather than a negative duration if timestamps are odd", () => {
    const b = rowToBooking(
      row({
        created_at: "2026-10-18T11:00:00.000Z",
        completed_at: "2026-10-18T10:00:00.000Z",
      })
    );
    expect(b.minutesInCheckout).toBeNull();
  });
});

describe("buildDigest", () => {
  it("totals value and groups by converting channel, biggest first", () => {
    const d = buildDigest(
      [
        row(),
        row({
          tracking: {
            listingTitle: "B",
            totalPaid: 500,
            checkIn: "x",
            checkOut: "y",
          },
        }),
        row({
          tracking: {
            listingTitle: "C",
            totalPaid: 100,
            checkIn: "x",
            checkOut: "y",
          },
          tracking_context: cookies({
            utm_source: "chatgpt",
            utm_medium: "ai_agent",
          }),
        }),
      ],
      "2026-10-18"
    );
    expect(d.bookings).toHaveLength(3);
    expect(d.totalValue).toBe(1593.3);
    expect(d.bySource[0]).toEqual({
      source: "google / cpc",
      count: 2,
      value: 1493.3,
    });
    expect(d.bySource[1].source).toBe("chatgpt / ai_agent");
  });

  it("handles a day with no bookings", () => {
    const d = buildDigest([], "2026-10-18");
    expect(d.bookings).toHaveLength(0);
    expect(d.totalValue).toBe(0);
    expect(d.bySource).toEqual([]);
  });
});

describe("renderSlackBlocks", () => {
  it("says so plainly when nothing was booked", () => {
    const p = renderSlackBlocks(buildDigest([], "2026-10-18"));
    expect(String(p.text)).toMatch(/No website bookings/);
  });

  it("leads with the count and value, and lists the channel split", () => {
    const p = renderSlackBlocks(buildDigest([row(), row()], "2026-10-18"));
    const json = JSON.stringify(p);
    expect(String(p.text)).toContain("2 website bookings");
    expect(json).toContain("$1,986.60");
    expect(json).toContain("By channel");
    expect(json).toContain("google / cpc");
  });

  // The click path has real edges — session-scoped, consent-gated, capped —
  // and a reader acting on it needs to know them.
  it("states the limits of the click path rather than implying it is complete", () => {
    const json = JSON.stringify(
      renderSlackBlocks(buildDigest([row()], "2026-10-18"))
    );
    expect(json).toMatch(/browser session only/);
    expect(json).toMatch(/analytics consent/);
  });

  it("includes the entry page and the timing signals", () => {
    const json = JSON.stringify(
      renderSlackBlocks(buildDigest([row()], "2026-10-18"))
    );
    expect(json).toContain("entered on");
    expect(json).toContain("in checkout");
  });

  it("renders the click path when one was recorded", () => {
    const json = JSON.stringify(
      renderSlackBlocks(
        buildDigest(
          [
            row({
              tracking_context: cookies(
                { utm_source: "google", utm_medium: "cpc" },
                undefined,
                "v1~1760776800~0~/:0~/crested-butte:120~/book/q1:540"
              ),
            }),
          ],
          "2026-10-18"
        )
      )
    );
    expect(json).toContain("/ → /crested-butte → /book/q1");
    expect(json).toContain("3 pages");
  });

  it("omits the path line entirely when nothing was recorded", () => {
    const json = JSON.stringify(
      renderSlackBlocks(buildDigest([row()], "2026-10-18"))
    );
    expect(json).not.toContain("path:");
  });
});
