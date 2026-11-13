import { describe, expect, it } from "vitest";
import { describeUpstreamFailure } from "./failure-reason";

describe("describeUpstreamFailure", () => {
  // The exact shapes guesty-beapi.ts throws. If these drift, the alert
  // silently degrades to "unknown" rather than breaking, which is why they
  // are pinned here.
  it("classifies the real BEAPI throw shapes", () => {
    expect(
      describeUpstreamFailure(
        new Error("BEAPI /api/listings failed: 429 Too Many Requests")
      )
    ).toMatchObject({ kind: "rate_limited", status: 429 });

    expect(
      describeUpstreamFailure(
        new Error("BEAPI /api/listings forbidden: 403 Forbidden")
      )
    ).toMatchObject({ kind: "forbidden", status: 403 });

    expect(
      describeUpstreamFailure(new Error("BEAPI /api/listings failed: 503 "))
    ).toMatchObject({ kind: "upstream_error", status: 503 });

    expect(
      describeUpstreamFailure(
        new Error("CRITICAL: BEAPI token unavailable — assuming it lapsed")
      )
    ).toMatchObject({ kind: "token" });
  });

  it("separates a timeout from a rate limit", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    expect(describeUpstreamFailure(abort).kind).toBe("timeout");
    expect(describeUpstreamFailure(new Error("ETIMEDOUT")).kind).toBe(
      "timeout"
    );
  });

  it("recognises a connection that never reached Guesty", () => {
    const te = new TypeError("fetch failed");
    expect(describeUpstreamFailure(te).kind).toBe("network");
    expect(describeUpstreamFailure(new Error("ECONNRESET")).kind).toBe(
      "network"
    );
    expect(
      describeUpstreamFailure(new Error("getaddrinfo ENOTFOUND")).kind
    ).toBe("network");
  });

  // The body is interpolated into an HTML email, and the message carries
  // upstream response text we do not control.
  it("escapes HTML in the summary", () => {
    const r = describeUpstreamFailure(
      new Error('BEAPI failed: 500 <script>alert("x")</script>')
    );
    expect(r.summary).not.toContain("<script>");
    expect(r.summary).toContain("&lt;script&gt;");
  });

  it("truncates a huge upstream body", () => {
    const r = describeUpstreamFailure(
      new Error("BEAPI failed: 500 " + "x".repeat(5000))
    );
    expect(r.summary.length).toBeLessThanOrEqual(200);
  });

  // An unrecognised shape must still carry its message — degrading to
  // "unknown" with no detail would put us back where we started.
  it("keeps the raw message when it cannot classify", () => {
    const r = describeUpstreamFailure(new Error("something nobody predicted"));
    expect(r.kind).toBe("unknown");
    expect(r.status).toBeNull();
    expect(r.summary).toContain("something nobody predicted");
  });

  it("survives a non-Error throw", () => {
    expect(describeUpstreamFailure("plain string").summary).toContain(
      "plain string"
    );
    expect(describeUpstreamFailure({ odd: true }).kind).toBe("unknown");
    expect(describeUpstreamFailure(null).summary).toBe("null");
    expect(() => describeUpstreamFailure(undefined)).not.toThrow();
  });

  // A 404 is neither a rate limit nor a server fault; it should not be
  // mistaken for either.
  it("does not call a 4xx a server error or a rate limit", () => {
    const r = describeUpstreamFailure(new Error("BEAPI failed: 404 Not Found"));
    expect(r.status).toBe(404);
    expect(r.kind).toBe("upstream_error");
  });
});

describe("truncation", () => {
  // The alert that prompted this ended mid-word at "the token's real e",
  // which reads like the email itself is broken.
  it("breaks on a word boundary and says there is more", () => {
    const long =
      "Could not obtain a BEAPI token. The cached token was expired, missing, " +
      "or unreadable (Supabase error), and the self-heal refresh was throttled " +
      "or failed. Check /api/health/beapi for the token's real expiry before " +
      "assuming it lapsed.";
    const { summary } = describeUpstreamFailure(new Error(long));

    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith("…")).toBe(true);
    // No half-word before the ellipsis.
    expect(long).toContain(summary.slice(0, -1));
    expect(summary).not.toMatch(/real e…$/);
  });

  // A 200-char run with no spaces must not collapse to nothing.
  it("falls back to a hard cut when there is no space to break on", () => {
    const { summary } = describeUpstreamFailure(new Error("y".repeat(400)));
    expect(summary.length).toBe(200);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("leaves a short message exactly as it is", () => {
    const { summary } = describeUpstreamFailure(new Error("short and done"));
    expect(summary).toBe("short and done");
  });
});
