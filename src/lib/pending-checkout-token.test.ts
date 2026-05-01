import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPendingCheckoutLookupToken,
  verifyPendingCheckoutLookupToken,
} from "./pending-checkout-token";

describe("pending checkout lookup token", () => {
  beforeEach(() => {
    process.env.PENDING_CHECKOUT_LOOKUP_SECRET = "test-pending-checkout-secret";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PENDING_CHECKOUT_LOOKUP_SECRET;
  });

  it("verifies a token for the matching payment intent", () => {
    const token = createPendingCheckoutLookupToken("pi_123");
    expect(verifyPendingCheckoutLookupToken(token, "pi_123")).toBe(true);
  });

  it("rejects a token for a different payment intent", () => {
    const token = createPendingCheckoutLookupToken("pi_123");
    expect(verifyPendingCheckoutLookupToken(token, "pi_456")).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const token = createPendingCheckoutLookupToken("pi_123");
    const tampered = `${token}x`;
    expect(verifyPendingCheckoutLookupToken(tampered, "pi_123")).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = createPendingCheckoutLookupToken("pi_123");
    vi.setSystemTime(new Date("2026-03-12T12:00:00.000Z"));
    expect(verifyPendingCheckoutLookupToken(token, "pi_123")).toBe(false);
  });

  it("requires a signing secret to create tokens", () => {
    delete process.env.PENDING_CHECKOUT_LOOKUP_SECRET;
    delete process.env.CRON_SECRET;

    expect(() => createPendingCheckoutLookupToken("pi_123")).toThrow(
      "PENDING_CHECKOUT_LOOKUP_SECRET or CRON_SECRET must be set"
    );
  });
});
