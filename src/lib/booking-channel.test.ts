import { describe, expect, it } from "vitest";
import { resolveBookingChannel } from "./server-tracking";

describe("resolveBookingChannel", () => {
  it("flags AI-agent bookings from the utm_medium our agent links carry", () => {
    expect(resolveBookingChannel({ utm_medium: "ai_agent" })).toBe("ai_agent");
    // Accept the hyphen spelling too — the brief used it, our links use "_".
    expect(resolveBookingChannel({ utm_medium: "ai-agent" })).toBe("ai_agent");
    expect(resolveBookingChannel({ utm_medium: "AI_Agent" })).toBe("ai_agent");
  });

  it("separates other marketing traffic from direct", () => {
    expect(resolveBookingChannel({ utm_medium: "cpc" })).toBe("web_marketing");
    expect(resolveBookingChannel({ utm_medium: "email" })).toBe(
      "web_marketing"
    );
  });

  it("falls back to direct with no attribution", () => {
    expect(resolveBookingChannel(undefined)).toBe("web_direct");
    expect(resolveBookingChannel({})).toBe("web_direct");
    expect(resolveBookingChannel({ utm_medium: "   " })).toBe("web_direct");
  });
});
