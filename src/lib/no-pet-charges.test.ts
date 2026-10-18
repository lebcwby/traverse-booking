/**
 * The website charges NOTHING for pets (2026-10-17). Guests disclose a pet
 * and pay any fee through the guest portal after booking.
 *
 * These are regression guards for that policy across every surface that
 * could reintroduce a charge. They are deliberately coarse — a precise
 * end-to-end test of the finalizer fights that file's fake timers and its
 * 2-second pre-invoice sleep, and a flaky guard on a money path is worse
 * than a blunt one.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  UPSELLS,
  getSelectedUpsells,
  getUpsellTotal,
  resolveUpsellsForListing,
} from "./upsells";
import { QUOTE_TERMS, toAgentQuote } from "./agent-quote";
import { toPublicListing } from "./agent-api";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("the upsell catalogue offers no pet fee", () => {
  it("has no pet-fee entry", () => {
    expect(UPSELLS.find((u) => u.id === "pet-fee")).toBeUndefined();
    expect(UPSELLS.some((u) => /pet/i.test(u.title))).toBe(false);
  });

  it("charges nothing for a pet-fee id an outdated client still sends", () => {
    expect(getUpsellTotal(["pet-fee"])).toBe(0);
    expect(getSelectedUpsells(["pet-fee"])).toEqual([]);
    expect(getUpsellTotal(["pet-fee", "pet-fee"])).toBe(0);
  });

  it("offers no pet fee for any listing", () => {
    expect(resolveUpsellsForListing().some((u) => u.id === "pet-fee")).toBe(
      false
    );
  });
});

describe("the finalizer cannot invoice a pet fee", () => {
  const finalizer = read("src/lib/checkout-finalizer.ts");

  // The AFE block used Guesty's pet account-fee id and secondIdentifier
  // "PET". If either returns to this file, a Pet Fee lands on a real
  // reservation invoice for money Stripe never collected.
  it("no longer references Guesty's pet account fee", () => {
    expect(finalizer).not.toContain("67fc4907f2cc23000e67992c");
  });

  it('no longer builds a "PET" invoice item', () => {
    expect(finalizer).not.toMatch(/secondIdentifier:\s*"PET"/);
    expect(finalizer).not.toMatch(/title:\s*petTitle/);
  });
});

describe("no payment path multiplies a pet count by a fee", () => {
  for (const rel of [
    "src/app/api/payment-intent/route.ts",
    "src/app/api/cart/payment-intent/route.ts",
    "src/lib/checkout-finalizer.ts",
    "src/lib/upsells.ts",
  ]) {
    it(`${rel} contains no pets × fee arithmetic`, () => {
      const src = read(rel);
      // Matches `pets * petFeePerPet`, `petCount * petFee`, etc.
      expect(src).not.toMatch(/pet\w*\s*\*\s*pet\w*Fee/i);
      expect(src).not.toMatch(/pet\w*Fee\w*\s*\*\s*pet/i);
    });
  }

  it("the retired per-pet default is gone from the codebase", () => {
    expect(read("src/lib/upsells.ts")).not.toMatch(
      /export const DEFAULT_PET_FEE_PER_PET/
    );
  });
});

describe("the agent API states the policy", () => {
  const row = {
    guesty_id: "63b7080c04bd5e0058e7fcf1",
    title: "Test Home",
    property_type: "House",
    bedrooms: 2,
    bathrooms: 1,
    beds: 2,
    accommodates: 4,
    address: { city: "Leadville", state: "CO", zipcode: "80461" },
    picture: null,
    amenities: ["Wifi"],
    default_check_in_time: "16:00",
    default_check_out_time: "10:00",
    tags: [],
  };

  it("exposes petsAllowed on a listing", () => {
    expect(toPublicListing(row).petsAllowed).toBe(false);
    expect(
      toPublicListing({ ...row, amenities: ["Wifi", "Pets allowed"] })
        .petsAllowed
    ).toBe(true);
    expect(
      toPublicListing({ ...row, tags: ["Pet Friendly"] }).petsAllowed
    ).toBe(true);
  });

  // "carpet" contains "pet" — the substring bug the old listing page shipped.
  it("does not call a carpeted home pet-friendly", () => {
    expect(
      toPublicListing({ ...row, amenities: ["Carpeted floors"] }).petsAllowed
    ).toBe(false);
  });

  it("quote terms promise no pet fee and point at the guest portal", () => {
    expect(QUOTE_TERMS.excludes.join(" ")).not.toMatch(/pet/i);
    expect(QUOTE_TERMS.petPolicy).toMatch(/no pet fee/i);
    expect(QUOTE_TERMS.petPolicy).toMatch(/guest portal/i);
  });

  it("an agent quote carries no pet amount", () => {
    const listing = toPublicListing(row);
    const quote = toAgentQuote(
      {
        _id: "6acea998520e0e0ffc0f51e7",
        checkInDateLocalized: "2027-05-11",
        checkOutDateLocalized: "2027-05-14",
        guestsCount: 2,
        rates: {
          ratePlans: [
            {
              ratePlan: {
                money: {
                  currency: "USD",
                  fareAccommodation: 300,
                  fareAccommodationAdjusted: 300,
                  fareCleaning: 100,
                  totalTaxes: 40,
                  hostPayout: 440,
                },
              },
              days: [],
            },
          ],
        },
      },
      listing
    );
    expect(JSON.stringify(quote.price)).not.toMatch(/pet/i);
    expect(
      quote.price.accommodation + quote.price.cleaning + quote.price.taxes
    ).toBeCloseTo(quote.price.total, 2);
  });
});
