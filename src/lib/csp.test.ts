import { describe, expect, it } from "vitest";
import {
  buildBaseContentSecurityPolicy,
  buildSensitiveContentSecurityPolicy,
  isSensitiveCspPath,
} from "./csp";

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

describe("connect-src allows the Conduit reply stream", () => {
  // WHY (2026-10-16): Conduit's widget streams agent replies over SSE from a
  // Modal host and reads history from Convex. Neither is under *.conduit.ai.
  // While connect-src omitted them the browser blocked the stream and NO
  // reply — agent or human — ever appeared in the widget, even though all
  // three replies were sitting in Conduit's inbox.
  const prod = buildBaseContentSecurityPolicy({ isProduction: true });
  const dev = buildBaseContentSecurityPolicy({ isProduction: false });

  it("allows the Conduit agent SSE host", () => {
    for (const csp of [prod, dev]) {
      expect(csp).toContain(
        "https://conduit-ai--conduit-agents-stream-app.modal.run"
      );
    }
  });

  it("allows Convex over https, not only websockets", () => {
    for (const csp of [prod, dev]) {
      expect(csp).toContain("https://*.convex.cloud");
      expect(csp).toContain("wss://*.convex.cloud");
    }
  });

  // Modal is shared infrastructure. A wildcard would make every Modal
  // tenant's app a legal connect target for our pages.
  it("does NOT allow Modal by wildcard", () => {
    expect(prod).not.toContain("*.modal.run");
    expect(prod).not.toContain("https://modal.run");
  });

  it("puts both hosts in connect-src specifically", () => {
    const connectSrc = prod
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"));
    expect(connectSrc).toBeDefined();
    expect(connectSrc).toContain(
      "https://conduit-ai--conduit-agents-stream-app.modal.run"
    );
    expect(connectSrc).toContain("https://*.convex.cloud");
  });
});
