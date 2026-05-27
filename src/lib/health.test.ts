import { describe, expect, it } from "vitest";
import {
  httpStatusForToken,
  isFailingStatus,
  isHealthRequestAuthorized,
} from "./health";

describe("isFailingStatus", () => {
  it("flags expired and missing as failing", () => {
    expect(isFailingStatus("expired")).toBe(true);
    expect(isFailingStatus("missing")).toBe(true);
  });
  it("does not flag healthy or warning as failing", () => {
    expect(isFailingStatus("healthy")).toBe(false);
    expect(isFailingStatus("warning")).toBe(false);
  });
});

describe("httpStatusForToken", () => {
  it("maps failing → 503 and others → 200", () => {
    expect(httpStatusForToken("expired")).toBe(503);
    expect(httpStatusForToken("missing")).toBe(503);
    expect(httpStatusForToken("healthy")).toBe(200);
    expect(httpStatusForToken("warning")).toBe(200);
  });
});

describe("isHealthRequestAuthorized", () => {
  const ORIGINAL = process.env.CRON_SECRET;
  function make(headers: Record<string, string>): Request {
    return new Request("https://example.com/api/health", { headers });
  }

  it("rejects when CRON_SECRET is unset", () => {
    process.env.CRON_SECRET = "";
    expect(isHealthRequestAuthorized(make({}))).toBe(false);
    process.env.CRON_SECRET = ORIGINAL;
  });

  it("accepts Authorization: Bearer <secret>", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(
      isHealthRequestAuthorized(
        make({ authorization: "Bearer test-secret" })
      )
    ).toBe(true);
    process.env.CRON_SECRET = ORIGINAL;
  });

  it("accepts x-cron-secret header alternate", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(
      isHealthRequestAuthorized(make({ "x-cron-secret": "test-secret" }))
    ).toBe(true);
    process.env.CRON_SECRET = ORIGINAL;
  });

  it("rejects wrong secret", () => {
    process.env.CRON_SECRET = "right-secret";
    expect(
      isHealthRequestAuthorized(make({ authorization: "Bearer wrong" }))
    ).toBe(false);
    process.env.CRON_SECRET = ORIGINAL;
  });

  it("rejects unauthenticated", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(isHealthRequestAuthorized(make({}))).toBe(false);
    process.env.CRON_SECRET = ORIGINAL;
  });
});
