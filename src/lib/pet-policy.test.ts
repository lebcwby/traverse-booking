import { describe, expect, it } from "vitest";
import {
  isPetFriendly,
  NO_PETS_NOTE,
  PET_POLICY_NOTE,
  petPolicyNoteFor,
} from "./pet-policy";

describe("isPetFriendly — house rules flag", () => {
  it("is true when the Guesty house-rules flag is explicitly true", () => {
    expect(isPetFriendly({ houseRulesPetsAllowed: true })).toBe(true);
  });

  it("is false when the flag is explicitly false and nothing else says otherwise", () => {
    expect(isPetFriendly({ houseRulesPetsAllowed: false })).toBe(false);
  });

  // LEAD:427W3:Miller carries both the tag and the amenity while the BEAPI
  // flag is false. Any positive signal wins: telling a guest "no pets" about a
  // pet-friendly home loses a booking, but the reverse puts a guest and a dog
  // on a doorstep.
  it("lets a tag or amenity override an explicit false — the LEAD:427W3:Miller case", () => {
    expect(
      isPetFriendly({ houseRulesPetsAllowed: false, tags: ["Pet Friendly"] })
    ).toBe(true);
    expect(
      isPetFriendly({
        houseRulesPetsAllowed: false,
        amenities: ["Pets allowed"],
      })
    ).toBe(true);
  });
});

describe("isPetFriendly — tags", () => {
  it("matches the exact tag, case-insensitively and trimmed", () => {
    for (const tag of ["pet friendly", "Pet Friendly", "  PET FRIENDLY  "]) {
      expect(isPetFriendly({ tags: [tag] }), tag).toBe(true);
    }
  });

  it("does not match a tag that merely contains the phrase", () => {
    for (const tag of ["not pet friendly", "pet friendly?", "pet-friendly"]) {
      expect(isPetFriendly({ tags: [tag] }), tag).toBe(false);
    }
  });
});

describe("isPetFriendly — amenities", () => {
  it("matches the exact amenity, case-insensitively and trimmed", () => {
    for (const a of ["Pets allowed", "pets allowed", " PETS ALLOWED "]) {
      expect(isPetFriendly({ amenities: [a] }), a).toBe(true);
    }
  });

  // ⚠️ The whole reason this helper exists. The listing page used
  // `a.includes("pet")`, so every home with carpet was published to Google
  // and to AI assistants as pet-friendly.
  it("does NOT match 'carpet' — the substring bug this replaces", () => {
    expect(isPetFriendly({ amenities: ["Carpeted floors"] })).toBe(false);
    expect(isPetFriendly({ amenities: ["carpet"] })).toBe(false);
  });

  it("does not match related-but-different amenities", () => {
    for (const a of [
      "Pets not allowed",
      "No pets allowed",
      "Dog bowl",
      "Pet bed",
    ]) {
      expect(isPetFriendly({ amenities: [a] }), a).toBe(false);
    }
  });

  it("finds the amenity among many", () => {
    expect(
      isPetFriendly({ amenities: ["Wifi", "Carpeted floors", "Pets allowed"] })
    ).toBe(true);
  });
});

describe("isPetFriendly — missing data", () => {
  it("treats absent, empty and malformed input as NOT pet-friendly", () => {
    expect(isPetFriendly(null)).toBe(false);
    expect(isPetFriendly(undefined)).toBe(false);
    expect(isPetFriendly({})).toBe(false);
    expect(isPetFriendly({ tags: [], amenities: [] })).toBe(false);
    expect(isPetFriendly({ tags: null, amenities: null })).toBe(false);
    expect(
      isPetFriendly({
        tags: [undefined as unknown as string, 7 as unknown as string],
      })
    ).toBe(false);
  });
});

describe("petPolicyNoteFor", () => {
  it("tells a pet-friendly guest to use the guest portal, and never mentions a website fee", () => {
    const note = petPolicyNoteFor(true);
    expect(note).toBe(PET_POLICY_NOTE);
    expect(note).toMatch(/guest portal/i);
    expect(note).toMatch(/after booking/i);
  });

  it("says plainly when a home takes no pets", () => {
    expect(petPolicyNoteFor(false)).toBe(NO_PETS_NOTE);
    expect(petPolicyNoteFor(false)).toMatch(/does not allow pets/i);
  });
});
