import { beforeEach, describe, expect, it, vi } from "vitest";

// The module reads NEXT_PUBLIC_META_PIXEL_ID at import time and bails when it
// is unset, so it has to be in place before the import below.
vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "957711153724958");

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// The suite runs in the "node" environment (vitest.config.ts) and nothing
// else here needs a DOM, so a stub global beats pulling in jsdom for one
// file. The code under test touches `window.fbq` and nothing more.
const win = globalThis as unknown as { window?: { fbq?: unknown } };
win.window = win.window ?? {};

const {
  applyAdvancedMatching,
  resetAppliedMatching,
} = await import("./consent-manager");

/** Every fbq('init', …) the pixel saw. */
function initCalls(fbq: { mock: { calls: unknown[][] } }) {
  return fbq.mock.calls.filter((c) => c[0] === "init");
}

describe("applyAdvancedMatching", () => {
  let fbq: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAppliedMatching();
    fbq = vi.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
  });

  it("initialises the pixel the first time it sees a payload", () => {
    applyAdvancedMatching({ external_id: "abc" });
    expect(initCalls(fbq)).toHaveLength(1);
    expect(fbq).toHaveBeenCalledWith("init", "957711153724958", {
      external_id: "abc",
    });
  });

  // The bug this whole change is about: three call sites re-initialised on
  // every page load, and Meta logs "Duplicate Pixel ID" for each one. A
  // warning that is always on is one nobody reads — and it is exactly what a
  // genuine second pixel (someone adding it in GTM) would look like.
  it("does not re-initialise for an unchanged payload", () => {
    applyAdvancedMatching({ external_id: "abc" });
    applyAdvancedMatching({ external_id: "abc" });
    applyAdvancedMatching({ external_id: "abc" });
    expect(initCalls(fbq)).toHaveLength(1);
  });

  // Re-init IS Meta's API for updating advanced matching — there is no
  // separate "set user data" call — so a real change must still go through.
  // This is the first page view of a session: the pixel comes up with the
  // visitor id, then edge geo lands from /api/anon-match.
  it("re-initialises when the payload genuinely changes", () => {
    applyAdvancedMatching({ external_id: "abc" });
    applyAdvancedMatching({ external_id: "abc", ct: "denver", st: "co" });
    expect(initCalls(fbq)).toHaveLength(2);
    expect(fbq).toHaveBeenLastCalledWith("init", "957711153724958", {
      external_id: "abc",
      ct: "denver",
      st: "co",
    });
  });

  it("ignores an empty payload rather than initialising with nothing", () => {
    applyAdvancedMatching({});
    expect(initCalls(fbq)).toHaveLength(0);
  });

  it("does nothing before the pixel stub exists", () => {
    (window as unknown as { fbq?: unknown }).fbq = undefined;
    expect(() => applyAdvancedMatching({ external_id: "abc" })).not.toThrow();
  });

  // Consent revoke clears the known guest. Without the reset, an opt-in that
  // rebuilt the same payload would be deduped against identity the pixel no
  // longer holds, and matching would never be re-applied.
  it("re-sends the same payload after a reset", () => {
    applyAdvancedMatching({ external_id: "abc" });
    resetAppliedMatching();
    applyAdvancedMatching({ external_id: "abc" });
    expect(initCalls(fbq)).toHaveLength(2);
  });
});
