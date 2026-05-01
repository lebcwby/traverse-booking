import { describe, expect, it } from "vitest";
import { getEffectiveServerConsent, IMPLIED_US_CONSENT } from "./consent";

describe("consent", () => {
  it("ignores Global Privacy Control on the server (SP below CCPA thresholds)", () => {
    // Sec-GPC / navigator.globalPrivacyControl is intentionally NOT honored.
    // See src/lib/consent.ts for rationale.
    expect(
      getEffectiveServerConsent({
        consentCookieValue: "a=1&m=1",
      })
    ).toEqual({
      analytics: true,
      marketing: true,
    });
  });

  it("respects the legacy CCPA opt-out cookie on the server", () => {
    expect(
      getEffectiveServerConsent({
        legacyOptOutValue: "1",
      })
    ).toEqual({
      analytics: true,
      marketing: false,
    });
  });

  it("falls back to tracked consent snapshots when request cookies are unavailable", () => {
    expect(
      getEffectiveServerConsent({
        fallback: {
          analytics: false,
          marketing: true,
        },
      })
    ).toEqual({
      analytics: false,
      marketing: true,
    });
  });

  it("defaults to implied US consent when no signals are present", () => {
    expect(getEffectiveServerConsent()).toEqual(IMPLIED_US_CONSENT);
  });
});
