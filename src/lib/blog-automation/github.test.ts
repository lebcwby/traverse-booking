import { describe, it, expect } from "vitest";
import { setPostImageInSource } from "./github";

const SAMPLE = `export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-to-pack-colorado-mountain-trip",
    oldSlug: "what-to-pack-colorado-mountain-trip",
    title: "What to Pack",
    market: "company",
    image: "",
  },
  {
    slug: "crested-butte-wildflower-season-guide-2026",
    oldSlug: "crested-butte-wildflower-season-guide-2026",
    title: "Wildflowers",
    market: "crested-butte",
    image: "/blog/old-wildflower.jpg",
  },
];
`;

describe("setPostImageInSource", () => {
  it("sets the image for the matching slug only", () => {
    const out = setPostImageInSource(
      SAMPLE,
      "what-to-pack-colorado-mountain-trip",
      "/blog/what-to-pack-colorado-mountain-trip-cover.jpg",
    );
    expect(out).toContain(
      'image: "/blog/what-to-pack-colorado-mountain-trip-cover.jpg"',
    );
    // The other post's image is untouched.
    expect(out).toContain('image: "/blog/old-wildflower.jpg"');
  });

  it("replaces an existing non-empty image on the targeted slug", () => {
    const out = setPostImageInSource(
      SAMPLE,
      "crested-butte-wildflower-season-guide-2026",
      "/blog/new-wildflower.webp",
    );
    expect(out).toContain('image: "/blog/new-wildflower.webp"');
    expect(out).not.toContain('image: "/blog/old-wildflower.jpg"');
    // First post still empty.
    expect(out).toContain('slug: "what-to-pack-colorado-mountain-trip"');
  });

  it("returns source unchanged when the slug is absent", () => {
    const out = setPostImageInSource(SAMPLE, "no-such-slug", "/blog/x.jpg");
    expect(out).toBe(SAMPLE);
  });

  it("does not bleed into a later post's image when target image is non-empty", () => {
    // Target the FIRST post; ensure only its (empty) image is filled, and the
    // regex's non-greedy match stops at the first image after the slug.
    const out = setPostImageInSource(
      SAMPLE,
      "what-to-pack-colorado-mountain-trip",
      "/blog/cover.png",
    );
    const firstIdx = out.indexOf('image: "/blog/cover.png"');
    const wildflowerIdx = out.indexOf('image: "/blog/old-wildflower.jpg"');
    expect(firstIdx).toBeGreaterThan(-1);
    expect(wildflowerIdx).toBeGreaterThan(firstIdx);
  });
});
