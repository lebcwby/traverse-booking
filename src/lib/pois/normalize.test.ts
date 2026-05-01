// src/lib/pois/normalize.test.ts
import { describe, it, expect } from "vitest";
import { slugify, normalizeNameKey, dedupeByKey } from "./normalize";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Heart Coffee")).toBe("heart-coffee");
  });

  it("strips punctuation and ampersands", () => {
    expect(slugify("Salt & Straw")).toBe("salt-straw");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Pok  --  Pok")).toBe("pok-pok");
  });

  it("appends a neighborhood suffix when given", () => {
    expect(slugify("Heart Coffee", "burnside")).toBe("heart-coffee-burnside");
  });

  it("handles diacritics", () => {
    expect(slugify("Café Olé")).toBe("cafe-ole");
  });
});

describe("normalizeNameKey", () => {
  it("returns a lowercase, punctuation-stripped key for dedupe", () => {
    expect(normalizeNameKey("Salt & Straw (Alberta)")).toBe(
      "salt straw alberta"
    );
  });

  it("collapses internal whitespace", () => {
    expect(normalizeNameKey("Heart   Coffee")).toBe("heart coffee");
  });
});

describe("dedupeByKey", () => {
  it("keeps the first occurrence by key", () => {
    const items = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
      { key: "a", value: 3 },
    ];
    const result = dedupeByKey(items, (i) => i.key);
    expect(result).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });
});
