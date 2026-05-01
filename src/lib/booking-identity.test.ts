import { describe, expect, it } from "vitest";
import {
  buildBookingFingerprint,
  buildGuestIdentityKey,
  buildStayKey,
  normalizeGuestEmail,
  normalizeGuestPhone,
} from "./booking-identity";

describe("booking identity helpers", () => {
  it("normalizes email and phone values before fingerprinting", () => {
    expect(normalizeGuestEmail("  TEST@Example.com ")).toBe("test@example.com");
    expect(normalizeGuestPhone("(503) 555-1212")).toBe("5035551212");
  });

  it("builds a stay key only when all stay fields exist", () => {
    expect(
      buildStayKey({
        listingId: "listing_123",
        checkIn: "2026-05-01",
        checkOut: "2026-05-03",
      })
    ).toBe("listing_123|2026-05-01|2026-05-03");

    expect(
      buildStayKey({
        listingId: "listing_123",
        checkIn: "2026-05-01",
        checkOut: null,
      })
    ).toBeNull();
  });

  it("prefers normalized email over phone for guest identity", () => {
    expect(
      buildGuestIdentityKey({
        guestEmail: "Guest@Example.com",
        guestPhone: "(503) 555-1212",
      })
    ).toBe("email:guest@example.com");
  });

  it("falls back to a normalized phone identity when email is missing", () => {
    expect(
      buildGuestIdentityKey({
        guestPhone: "+1 (503) 555-1212",
      })
    ).toBe("phone:15035551212");
  });

  it("produces the same fingerprint across equivalent guest inputs", () => {
    const first = buildBookingFingerprint({
      listingId: "listing_123",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guestEmail: "Guest@Example.com",
      guestPhone: "(503) 555-1212",
    });

    const second = buildBookingFingerprint({
      listingId: "listing_123",
      checkIn: "2026-05-01",
      checkOut: "2026-05-03",
      guestEmail: " guest@example.com ",
      guestPhone: "5035551212",
    });

    expect(first).toBe(
      "listing_123|2026-05-01|2026-05-03|email:guest@example.com"
    );
    expect(second).toBe(first);
  });

  it("returns null without both stay and guest identity data", () => {
    expect(
      buildBookingFingerprint({
        listingId: "listing_123",
        checkIn: "2026-05-01",
        checkOut: "2026-05-03",
      })
    ).toBeNull();

    expect(
      buildBookingFingerprint({
        guestEmail: "guest@example.com",
      })
    ).toBeNull();
  });
});
