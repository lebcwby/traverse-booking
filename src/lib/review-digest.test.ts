import { describe, expect, it } from "vitest";
import {
  buildReviewSummary,
  excerptReview,
  normalizeRating,
  renderReviewBlocks,
  type ReviewRow,
} from "./review-digest";

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  guesty_id: "rev-1",
  channel: "airbnb",
  overall_rating: 5,
  public_review: "Lovely stay, would come back.",
  reviewer_name: null,
  review_date: "2026-10-29T18:00:00.000Z",
  listing_id: "listing-1",
  listing_nickname: "CB:GL523:Juli",
  category_cleanliness: 5,
  category_accuracy: 5,
  category_checkin: 5,
  category_communication: 5,
  category_location: 5,
  category_value: 5,
  ...over,
});

const textOf = (blocks: Record<string, unknown>[]) =>
  JSON.stringify(blocks);

describe("normalizeRating", () => {
  it("leaves a 5-point score alone", () => {
    expect(normalizeRating(4)).toBe(4);
    expect(normalizeRating(5)).toBe(5);
  });

  it("halves a 10-point score, so VRBO's 10/10 is not read as a disaster", () => {
    expect(normalizeRating(10)).toBe(5);
    expect(normalizeRating(8)).toBe(4);
  });

  it("passes through a missing rating rather than inventing a zero", () => {
    expect(normalizeRating(null)).toBeNull();
  });
});

describe("excerptReview", () => {
  // The real OSV201 review that motivated complaint-aware excerpting.
  const osv201 =
    "Bedrooms were cozy and comfortable! The room was clean and the kitchen " +
    "perfectly stocked for us to make meals. Location was great. It was close " +
    "to everything. We went on the railroad ride and recommend it! Our only " +
    "issue was checking in, as it was dark and raining and there is no light " +
    "for you to see the key access… we were soaked by the time we got in.";

  it("surfaces the complaint instead of the opening pleasantry", () => {
    const out = excerptReview(osv201, true)!;
    expect(out).toContain("only issue was checking in");
    expect(out).not.toContain("Bedrooms were cozy");
  });

  it("quotes from the top when complaint-hunting is off", () => {
    expect(excerptReview(osv201, false)!).toContain("Bedrooms were cozy");
  });

  it("does not mistake 'no issues' for a complaint", () => {
    const text =
      "We had no issues at all and everything was spotless. The host was kind.";
    expect(excerptReview(text, true)!).toContain("no issues at all");
  });

  it("carries the next sentence when the cue sentence is too short to stand alone", () => {
    const text =
      "Lovely spot. But wow. The heater rattled all night and nobody answered.";
    expect(excerptReview(text, true)!).toBe(
      "But wow. The heater rattled all night and nobody answered."
    );
  });

  it("falls back to the opening for a review with no English cue", () => {
    const text = "El anfitrión es una persona muy amable. Altamente recomendable";
    expect(excerptReview(text, true)!).toContain("El anfitrión");
  });

  it("treats empty and VRBO's '0' body as no text", () => {
    expect(excerptReview("", true)).toBeNull();
    expect(excerptReview("0", true)).toBeNull();
    expect(excerptReview(null, true)).toBeNull();
  });

  it("truncates a long excerpt with an ellipsis", () => {
    const out = excerptReview("x".repeat(400), false)!;
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildReviewSummary", () => {
  it("counts, averages, and groups by channel", () => {
    const s = buildReviewSummary(
      [
        review({ overall_rating: 5 }),
        review({ overall_rating: 4 }),
        review({ channel: "vrbo", overall_rating: 10 }),
      ],
      "2026-10-29"
    );

    expect(s.total).toBe(3);
    // 5, 4 and a normalised 5 — not a normalised-free 10, which would average 6.33.
    expect(s.averageRating).toBe(4.67);
    expect(s.byChannel).toEqual([
      { channel: "airbnb", count: 2, average: 4.5 },
      { channel: "vrbo", count: 1, average: 5 },
    ]);
  });

  it("flags a low overall rating", () => {
    const s = buildReviewSummary([review({ overall_rating: 2 })], "2026-10-29");
    expect(s.flags).toHaveLength(1);
    expect(s.flags[0].rating).toBe(2);
  });

  it("flags a low category even when the overall is five stars", () => {
    // The case that makes this worth building: 15 of the 17 red flags in the
    // 30 days to 2026-10-30 looked like this.
    const s = buildReviewSummary(
      [review({ overall_rating: 5, category_cleanliness: 3 })],
      "2026-10-29"
    );
    expect(s.flags).toHaveLength(1);
    expect(s.flags[0].lowCategories).toEqual([
      { name: "cleanliness", score: 3 },
    ]);
  });

  it("does not flag a clean review", () => {
    expect(buildReviewSummary([review()], "2026-10-29").flags).toHaveLength(0);
  });

  it("does not read a VRBO 10/10 as a red flag", () => {
    const s = buildReviewSummary(
      [review({ channel: "vrbo", overall_rating: 10 })],
      "2026-10-29"
    );
    expect(s.flags).toHaveLength(0);
  });

  it("orders low categories worst-first and flags several at once", () => {
    const s = buildReviewSummary(
      [review({ category_checkin: 1, category_value: 3 })],
      "2026-10-29"
    );
    expect(s.flags[0].lowCategories).toEqual([
      { name: "check-in", score: 1 },
      { name: "value", score: 3 },
    ]);
  });

  it("sorts flags worst-first, with a missing rating last", () => {
    const s = buildReviewSummary(
      [
        review({ guesty_id: "b", overall_rating: 3 }),
        review({ guesty_id: "c", overall_rating: null, category_value: 2 }),
        review({ guesty_id: "a", overall_rating: 1 }),
      ],
      "2026-10-29"
    );
    expect(s.flags.map((f) => f.rating)).toEqual([1, 3, null]);
  });

  it("falls back to the listing id when the mirror has no nickname", () => {
    const s = buildReviewSummary(
      [review({ listing_nickname: null, overall_rating: 2 })],
      "2026-10-29"
    );
    expect(s.flags[0].listing).toBe("listing-1");
  });

  it("treats VRBO's empty-body '0' as no text, not as a review saying 0", () => {
    const s = buildReviewSummary(
      [review({ public_review: "0", overall_rating: 2 })],
      "2026-10-29"
    );
    expect(s.flags[0].snippet).toBeNull();
  });
});

describe("renderReviewBlocks", () => {
  it("says so plainly when nobody reviewed", () => {
    const blocks = renderReviewBlocks(buildReviewSummary([], "2026-10-29"));
    expect(textOf(blocks)).toContain("No new reviews");
  });

  it("reports a clean day explicitly, so a broken sync cannot look like calm", () => {
    const blocks = renderReviewBlocks(
      buildReviewSummary([review(), review()], "2026-10-29")
    );
    const text = textOf(blocks);
    expect(text).toContain("2 reviews");
    expect(text).toContain("No red flags");
  });

  it("names the listing, the low categories and quotes the guest", () => {
    const blocks = renderReviewBlocks(
      buildReviewSummary(
        [
          review({
            overall_rating: 4,
            category_checkin: 1,
            public_review: "Nobody met us and the lockbox code was wrong.",
          }),
        ],
        "2026-10-29"
      )
    );
    const text = textOf(blocks);
    expect(text).toContain("CB:GL523:Juli");
    expect(text).toContain("check-in 1");
    expect(text).toContain("lockbox code was wrong");
  });

  it("collapses the tail when a day has more flags than it can show", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      review({ guesty_id: `r${i}`, overall_rating: 2 })
    );
    const blocks = renderReviewBlocks(buildReviewSummary(many, "2026-10-29"));
    const text = textOf(blocks);
    expect(text).toContain("8 to look at");
    expect(text).toContain("and 3 more flagged reviews");
  });

  it("stays well inside Slack's block budget on a bad day", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      review({ guesty_id: `r${i}`, overall_rating: 1 })
    );
    expect(
      renderReviewBlocks(buildReviewSummary(many, "2026-10-29")).length
    ).toBeLessThanOrEqual(3);
  });
});
