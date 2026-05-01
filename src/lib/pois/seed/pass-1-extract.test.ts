// src/lib/pois/seed/pass-1-extract.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCompleteJson } = vi.hoisted(() => ({
  mockCompleteJson: vi.fn(),
}));

vi.mock("./claude-client", () => ({
  completeJson: mockCompleteJson,
  SEED_MODEL: "claude-sonnet-4-6",
}));

import { extractFromArticle, type ExtractedPoi } from "./pass-1-extract";

describe("extractFromArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls claude with the article body and returns parsed POIs", async () => {
    const fake: ExtractedPoi[] = [
      {
        name: "Heart Coffee",
        category_guess: "coffee",
        why_mentioned: "Listed as a top third-wave spot in the Pearl",
      },
    ];
    mockCompleteJson.mockResolvedValue(fake);

    const result = await extractFromArticle({
      slug: "pearl-district-guide",
      title: "Pearl District Guide",
      body: "Heart Coffee is a top third-wave spot in the Pearl.",
      neighborhood: "pearl",
    });

    expect(mockCompleteJson).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Heart Coffee",
      sourceGuideSlug: "pearl-district-guide",
      neighborhoodHint: "pearl",
    });
  });

  it("returns empty array if claude returns empty", async () => {
    mockCompleteJson.mockResolvedValue([]);
    const result = await extractFromArticle({
      slug: "x",
      title: "x",
      body: "no places mentioned",
    });
    expect(result).toEqual([]);
  });
});
