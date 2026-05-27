import { describe, expect, it } from "vitest";
import {
  classifyBeapiError,
  mapBeapiErrorToUserMessage,
} from "./beapi-error";

describe("classifyBeapiError", () => {
  it("classifies LISTING_IS_NOT_AVAILABLE as DATES_UNAVAILABLE (409)", () => {
    const result = classifyBeapiError(
      new Error("LISTING_IS_NOT_AVAILABLE: dates blocked for 2026-05-22")
    );
    expect(result.code).toBe("DATES_UNAVAILABLE");
    expect(result.status).toBe(409);
    expect(result.message).toBe(
      "These dates are no longer available — please pick new dates."
    );
    // Critical: the raw BEAPI code must NOT leak into the user-facing message.
    expect(result.message).not.toMatch(/LISTING_IS_NOT_AVAILABLE/i);
  });

  it("classifies 'not applicable' (blocked rate plan) as DATES_UNAVAILABLE", () => {
    const result = classifyBeapiError(
      "rate plan not applicable for these dates"
    );
    expect(result.code).toBe("DATES_UNAVAILABLE");
  });

  it("classifies checkInDateLocalized validation as INVALID_DATES (400)", () => {
    const result = classifyBeapiError(
      new Error(
        "ValidationError: checkInDateLocalized must be a valid date string"
      )
    );
    expect(result.code).toBe("INVALID_DATES");
    expect(result.status).toBe(400);
    // Critical: the internal field name must NOT leak.
    expect(result.message).not.toMatch(/checkInDateLocalized/i);
  });

  it("classifies checkOutDateLocalized validation as INVALID_DATES", () => {
    const result = classifyBeapiError(
      "checkOutDateLocalized must be after checkInDateLocalized"
    );
    expect(result.code).toBe("INVALID_DATES");
    expect(result.message).not.toMatch(/checkOutDateLocalized/i);
  });

  it("classifies min-nights errors", () => {
    const result = classifyBeapiError("MIN_NIGHTS not met for this listing");
    expect(result.code).toBe("MIN_NIGHTS_NOT_MET");
    expect(result.message).toMatch(/minimum-stay/i);
  });

  it("classifies token-expired / unauthorized as UNAUTHORIZED (503)", () => {
    const result = classifyBeapiError(new Error("token expired"));
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.status).toBe(503);
    // Critical: don't tell users about tokens.
    expect(result.message).not.toMatch(/token/i);
  });

  it("classifies BEAPI tenant-mismatch (use booking.guesty.com) as UNAUTHORIZED", () => {
    const result = classifyBeapiError(
      "401 Unauthorized — use booking.guesty.com instead"
    );
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.message).not.toMatch(/booking\.guesty\.com/i);
  });

  it("classifies WRONG_REQUEST_PARAMETERS as INVALID_REQUEST (400)", () => {
    const result = classifyBeapiError(
      new Error("WRONG_REQUEST_PARAMETERS: guestsCount must be > 0")
    );
    expect(result.code).toBe("INVALID_REQUEST");
    expect(result.status).toBe(400);
    expect(result.message).not.toMatch(/WRONG_REQUEST_PARAMETERS/i);
    expect(result.message).not.toMatch(/guestsCount/i);
  });

  it("classifies quote-expired errors as QUOTE_EXPIRED (410)", () => {
    const result = classifyBeapiError("UNABLE_TO_GET_QUOTE: quote not found");
    expect(result.code).toBe("QUOTE_EXPIRED");
    expect(result.status).toBe(410);
  });

  it("classifies rate-limit (429) as RATE_LIMITED", () => {
    const result = classifyBeapiError(new Error("429 Too Many Requests"));
    expect(result.code).toBe("RATE_LIMITED");
    expect(result.status).toBe(429);
  });

  it("classifies 5xx-shaped errors as UPSTREAM_DOWN (503)", () => {
    const result = classifyBeapiError(
      new Error("502 Bad Gateway from upstream Guesty service")
    );
    expect(result.code).toBe("UPSTREAM_DOWN");
    expect(result.status).toBe(503);
  });

  it("classifies network resets as UPSTREAM_DOWN", () => {
    const result = classifyBeapiError(new Error("fetch failed: ECONNRESET"));
    expect(result.code).toBe("UPSTREAM_DOWN");
  });

  it("falls through to UNKNOWN (500) for unrecognized strings", () => {
    const result = classifyBeapiError(new Error("kaboom"));
    expect(result.code).toBe("UNKNOWN");
    expect(result.status).toBe(500);
    expect(result.message).toBe(
      "Something went wrong. Please try again in a moment."
    );
  });

  it("handles a bare string", () => {
    const result = classifyBeapiError("LISTING_IS_NOT_AVAILABLE");
    expect(result.code).toBe("DATES_UNAVAILABLE");
  });

  it("handles plain objects with a message field", () => {
    const result = classifyBeapiError({
      message: "LISTING_IS_NOT_AVAILABLE",
    });
    expect(result.code).toBe("DATES_UNAVAILABLE");
  });

  it("handles plain objects with an error field", () => {
    const result = classifyBeapiError({
      error: "checkInDateLocalized invalid",
    });
    expect(result.code).toBe("INVALID_DATES");
  });

  it("handles null / undefined safely", () => {
    expect(classifyBeapiError(null).code).toBe("UNKNOWN");
    expect(classifyBeapiError(undefined).code).toBe("UNKNOWN");
  });

  it("walks Error.cause for fetch-wrapper bodies", () => {
    const err = new Error("HTTP error");
    (err as Error & { cause: unknown }).cause = {
      body: "LISTING_IS_NOT_AVAILABLE",
    };
    const result = classifyBeapiError(err);
    expect(result.code).toBe("DATES_UNAVAILABLE");
  });
});

describe("mapBeapiErrorToUserMessage", () => {
  it("returns only the message string", () => {
    expect(mapBeapiErrorToUserMessage("LISTING_IS_NOT_AVAILABLE")).toBe(
      "These dates are no longer available — please pick new dates."
    );
  });
});
