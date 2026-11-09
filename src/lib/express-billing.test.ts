import { describe, expect, it } from "vitest";
import {
  isBookableBillingName,
  splitWalletName,
  toExpressBillingDetails,
} from "./express-billing";

describe("splitWalletName", () => {
  it("splits an ordinary two-part name", () => {
    expect(splitWalletName("Emily Carter")).toEqual({
      firstName: "Emily",
      lastName: "Carter",
    });
  });

  // First token first, everything else last — so a multi-part surname is kept
  // whole rather than silently truncated to one word on the booking.
  it("keeps a multi-part surname together", () => {
    expect(splitWalletName("Ana María del Bosque")).toEqual({
      firstName: "Ana",
      lastName: "María del Bosque",
    });
  });

  it("ignores padding and repeated spaces", () => {
    expect(splitWalletName("  Emily   Carter  ")).toEqual({
      firstName: "Emily",
      lastName: "Carter",
    });
  });

  // ⚠️ The 2026-11-08 incident: the wallet returned no name, both fields came
  // out empty, the payment went through, and Guesty refused the reservation.
  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["null", null],
    ["undefined", undefined],
  ])("yields empty fields for %s", (_label, input) => {
    expect(splitWalletName(input)).toEqual({ firstName: "", lastName: "" });
  });

  // A single token is a real case — a mononym, or a wallet that shares only a
  // first name. It is not something splitting can fix, so it must surface as
  // unbookable rather than be papered over with a placeholder surname.
  it("leaves lastName empty for a single-token name", () => {
    expect(splitWalletName("Emily")).toEqual({
      firstName: "Emily",
      lastName: "",
    });
  });
});

describe("isBookableBillingName", () => {
  it("accepts a name Guesty will take", () => {
    expect(
      isBookableBillingName({ firstName: "Emily", lastName: "Carter" })
    ).toBe(true);
  });

  // Guesty rejects an empty firstName OR lastName, so both have to be real.
  it.each([
    ["both missing", "", ""],
    ["no last name", "Emily", ""],
    ["no first name", "", "Carter"],
    ["whitespace only", "  ", " "],
  ])("rejects %s", (_label, firstName, lastName) => {
    expect(isBookableBillingName({ firstName, lastName })).toBe(false);
  });
});

describe("toExpressBillingDetails", () => {
  it("builds the guest record a wallet payment needs", () => {
    expect(
      toExpressBillingDetails({
        name: "Emily Carter",
        email: "emily@example.com",
        phone: "7205550123",
      })
    ).toEqual({
      firstName: "Emily",
      lastName: "Carter",
      email: "emily@example.com",
      phone: "7205550123",
    });
  });

  // The exact shape of the stuck record: email and phone present, no name.
  // It must come back unbookable so the charge is blocked before it happens.
  it("reproduces the stuck booking's shape as unbookable", () => {
    const details = toExpressBillingDetails({
      name: null,
      email: "emaily@gmail.com",
      phone: "7206751699",
    });
    expect(details).toEqual({
      firstName: "",
      lastName: "",
      email: "emaily@gmail.com",
      phone: "7206751699",
    });
    expect(isBookableBillingName(details)).toBe(false);
  });

  it("does not turn missing contact fields into undefined", () => {
    expect(toExpressBillingDetails({ name: "Emily Carter" })).toEqual({
      firstName: "Emily",
      lastName: "Carter",
      email: "",
      phone: "",
    });
  });
});
