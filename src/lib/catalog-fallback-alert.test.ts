import { beforeEach, describe, expect, it, vi } from "vitest";

const wasAlertSentRecently = vi.fn();

vi.mock("@/lib/alerts", () => ({
  sendAlert: vi.fn(),
  wasAlertSentRecently: (...args: unknown[]) => wasAlertSentRecently(...args),
  OPS_ALERT_INBOX: "ops@example.com",
}));

import {
  mirrorAlertSubject,
  shouldNotify,
  TOKEN_ALERT_KEY,
  TOKEN_SUPPRESSION_MS,
} from "./catalog-fallback-alert";
import { describeUpstreamFailure } from "./failure-reason";

const reason = (kind: string) =>
  ({ kind, status: null, summary: "x" }) as Parameters<
    typeof mirrorAlertSubject
  >[0];

beforeEach(() => {
  wasAlertSentRecently.mockReset();
  wasAlertSentRecently.mockResolvedValue(false);
});

describe("mirrorAlertSubject", () => {
  // The reason used to live in the cooldown KEY, which gave every failure
  // kind its own hourly send budget. Moving it to the subject keeps the
  // emails distinguishable in the inbox without multiplying them.
  it("distinguishes causes in the subject line", () => {
    expect(mirrorAlertSubject(reason("rate_limited"))).toContain("rate limited");
    expect(mirrorAlertSubject(reason("timeout"))).toContain("timeout");
    expect(mirrorAlertSubject(reason("rate_limited"))).not.toEqual(
      mirrorAlertSubject(reason("timeout"))
    );
  });
});

describe("shouldNotify", () => {
  // The case that produced two emails one second apart on 2026-10-28.
  it("stays quiet when the token alert just fired", async () => {
    wasAlertSentRecently.mockResolvedValue(true);
    expect(await shouldNotify(reason("token"))).toBe(false);
    expect(wasAlertSentRecently).toHaveBeenCalledWith(
      TOKEN_ALERT_KEY,
      TOKEN_SUPPRESSION_MS
    );
  });

  it("still reports a token failure the token alert did not cover", async () => {
    wasAlertSentRecently.mockResolvedValue(false);
    expect(await shouldNotify(reason("token"))).toBe(true);
  });

  // Suppressing these would lose the signal: nothing else emails about them.
  it.each(["rate_limited", "timeout", "network", "unknown"])(
    "never defers for %s, even if a token alert is recent",
    async (kind) => {
      wasAlertSentRecently.mockResolvedValue(true);
      expect(await shouldNotify(reason(kind))).toBe(true);
      expect(wasAlertSentRecently).not.toHaveBeenCalled();
    }
  );
});

describe("the real token error reaches the suppression path", () => {
  // Guards the whole chain: if describeUpstreamFailure stops classifying the
  // thrown message as `token`, shouldNotify silently stops deduplicating and
  // the double email comes back with no test failing.
  it("classifies the message guesty-beapi actually throws", async () => {
    const thrown =
      "Could not obtain a BEAPI token. The cached token was expired, missing, " +
      "or unreadable (Supabase error), and the self-heal refresh was throttled " +
      "or failed. Check /api/health/beapi for the token's real expiry before " +
      "assuming it lapsed — and the refresh-tokens cron's recent runs.";
    const r = describeUpstreamFailure(new Error(thrown));
    expect(r.kind).toBe("token");

    wasAlertSentRecently.mockResolvedValue(true);
    expect(await shouldNotify(r)).toBe(false);
  });
});
