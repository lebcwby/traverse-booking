import { describe, expect, it } from "vitest";
import { buildCancellationEmailHtml, firstName } from "./cancellation-email";

const baseDetails = {
  reservationId: "res_abc",
  confirmationCode: "ABC123",
  guestEmail: "guest@example.com",
  guestName: "Sarah Anderson",
  listingId: "listing_1",
  listingTitle: "Modern Pearl District Loft",
  listingPhoto:
    "https://res.cloudinary.com/example/image/upload/c_fill,w_536,h_402/foo.jpg",
  checkIn: "2026-05-12",
  checkOut: "2026-05-15",
  refundAmount: 0,
  totalPaid: 712.45,
} as const;

describe("firstName", () => {
  it("returns the first space-separated token", () => {
    expect(firstName("Sarah Anderson")).toBe("Sarah");
  });
  it("falls back to 'there' for empty input", () => {
    expect(firstName("")).toBe("there");
    expect(firstName("   ")).toBe("there");
  });
});

describe("buildCancellationEmailHtml", () => {
  it("renders full_refund variant with amount and 5-10 business days copy", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      refundStatus: "full_refund",
      refundAmount: 712.45,
    });
    expect(html).toContain("$712.45");
    expect(html).toContain("5-10 business days");
    expect(html).toContain("CANCELED");
    expect(html).toContain("https://www.booktraverse.com/properties");
    // Red status pill colors
    expect(html).toContain("#fef2f2");
    expect(html).toContain("#991b1b");
  });

  it("renders non_refundable variant with policy copy and no dollar amount line", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      refundStatus: "non_refundable",
      refundAmount: 0,
    });
    expect(html).toContain("Non-refundable");
    expect(html).toContain("48 hours of check-in");
    expect(html).not.toContain("Amount refunded");
  });

  it("renders pending_manual variant with 24-hour processing copy", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      refundStatus: "pending_manual",
      refundAmount: 0,
    });
    expect(html).toContain("Processing");
    expect(html).toContain("within 24 hours");
  });

  it("renders failed variant with 'Needs attention' copy", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      refundStatus: "failed",
      refundAmount: 0,
    });
    expect(html).toContain("Needs attention");
    expect(html).toContain("reach out to you shortly");
  });

  it("HTML-escapes apostrophes in the greeting", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      guestName: "O'Brien Smith",
      refundStatus: "full_refund",
      refundAmount: 100,
    });
    expect(html).toContain("Hi O&#39;Brien,");
    // Should not contain the unescaped apostrophe inside the greeting
    expect(html).not.toContain("Hi O'Brien,");
  });

  it("renders a fallback block when listingPhoto is missing", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      listingPhoto: null,
      refundStatus: "full_refund",
      refundAmount: 100,
    });
    // Must NOT have a broken <img> with empty src
    expect(html).not.toMatch(/<img[^>]*src=""/);
    // Must still render the listing title
    expect(html).toContain("Modern Pearl District Loft");
  });

  it("HTML-escapes the listing title in the heading", () => {
    const html = buildCancellationEmailHtml({
      ...baseDetails,
      listingTitle: "Cozy <Loft> & Studio",
      refundStatus: "full_refund",
      refundAmount: 100,
    });
    expect(html).toContain("Cozy &lt;Loft&gt; &amp; Studio");
  });
});
