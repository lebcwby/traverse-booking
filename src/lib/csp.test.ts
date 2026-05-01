import { describe, expect, it } from "vitest";
import { buildSensitiveContentSecurityPolicy, isSensitiveCspPath } from "./csp";

describe("isSensitiveCspPath", () => {
  it("matches the protected page families", () => {
    expect(isSensitiveCspPath("/login")).toBe(true);
    expect(isSensitiveCspPath("/contact")).toBe(true);
    expect(isSensitiveCspPath("/book/quote_123")).toBe(true);
    expect(isSensitiveCspPath("/account/reservations")).toBe(true);
    expect(isSensitiveCspPath("/auth/reset-password")).toBe(true);
  });

  it("does not over-match unrelated paths", () => {
    expect(isSensitiveCspPath("/")).toBe(false);
    expect(isSensitiveCspPath("/properties/abc")).toBe(false);
    expect(isSensitiveCspPath("/guide/where-to-stay-in-portland")).toBe(false);
    expect(isSensitiveCspPath("/auth/callback")).toBe(false);
  });
});

describe("buildSensitiveContentSecurityPolicy", () => {
  it("includes the nonce and omits unsafe-inline scripts", () => {
    const csp = buildSensitiveContentSecurityPolicy({
      isProduction: true,
      nonce: "test-nonce",
    });

    expect(csp).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(csp).not.toContain(
      "'unsafe-inline' https://www.googletagmanager.com"
    );
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});
