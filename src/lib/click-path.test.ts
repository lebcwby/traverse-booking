import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLICK_PATH_COOKIE,
  MAX_COOKIE_BYTES,
  MAX_STEPS,
  appendStep,
  clickPathMinutes,
  formatClickPath,
  parseClickPath,
  recordClickPathStep,
  sanitizePath,
  serializeClickPath,
} from "./click-path";

const at = (minutes: number) =>
  new Date(Date.parse("2026-10-19T10:00:00.000Z") + minutes * 60_000);

describe("sanitizePath", () => {
  // Query strings carry search terms and occasionally an email. A funnel
  // reads fine without them.
  it("drops the query string and the fragment", () => {
    expect(
      sanitizePath("/properties/abc?email=a@b.com&checkIn=2026-11-01")
    ).toBe("/properties/abc");
    expect(sanitizePath("/plan#itinerary")).toBe("/plan");
  });

  it("strips the serializer's own separators so nothing needs escaping", () => {
    expect(sanitizePath("/weird~path:here")).toBe("/weirdpathhere");
  });

  it("refuses anything that is not a site path", () => {
    expect(sanitizePath("https://evil.example/x")).toBeNull();
    expect(sanitizePath("")).toBeNull();
  });

  // A real production URL. The original cap cut the tail and took the Guesty
  // id with it, so the digest said someone viewed a property but not which —
  // and every listing slug on the site is long enough to hit the cap, so this
  // happened on every property step of every path. Synthetic short paths in
  // the first version of these tests is exactly why it shipped.
  describe("over-long paths keep the identifying tail", () => {
    const REAL =
      "/properties/the-tennessee-pass-a-frame-cabin-9-acres-mt-elbert-views-woo-6ad00c9eded1620031ba3ef8";
    const GUESTY_ID = "6ad00c9eded1620031ba3ef8";

    it("keeps the full Guesty id", () => {
      const out = sanitizePath(REAL)!;
      expect(out).toContain(GUESTY_ID);
      expect(out.endsWith(GUESTY_ID)).toBe(true);
    });

    it("keeps enough of the slug to recognise the listing", () => {
      expect(sanitizePath(REAL)!).toContain("tennessee-pass");
    });

    it("marks the elision instead of pretending the path was short", () => {
      expect(sanitizePath(REAL)!).toContain("..");
    });

    it("still respects the length cap", () => {
      expect(sanitizePath(REAL)!.length).toBeLessThanOrEqual(64);
    });

    // Cookies are an ASCII medium and a literal "…" is not safe to write raw.
    // `/` is legal in a cookie value even though encodeURIComponent escapes
    // it, so the check is for genuinely forbidden characters, not for being
    // URI-encodable.
    it("uses only characters that are legal in a cookie value", () => {
      const out = sanitizePath(REAL)!;
      expect(out).toMatch(/^[A-Za-z0-9/_.\-]+$/);
      // No control chars, whitespace, non-ASCII, or cookie delimiters.
      expect(out).not.toMatch(/[\s;,"\\\u0080-￿]/);
    });

    it("leaves a path that fits completely alone", () => {
      expect(sanitizePath("/crested-butte")).toBe("/crested-butte");
      expect(sanitizePath("/")).toBe("/");
    });

    // Two different units in the same building differ only in the id.
    it("keeps two long sibling listings distinguishable", () => {
      const a = sanitizePath(
        "/properties/grand-lodge-slopeside-studio-king-bed-kitchen-at-mt-cb-6a8dc0112755850082f1457c"
      );
      const b = sanitizePath(
        "/properties/grand-lodge-slopeside-studio-king-bed-kitchen-at-mt-cb-6a8dc019c57522007aa9559f"
      );
      expect(a).not.toBe(b);
    });
  });
});

describe("appendStep", () => {
  it("starts the trail at zero on the first page", () => {
    const p = appendStep(null, "/crested-butte", at(0))!;
    expect(p.steps).toEqual([{ path: "/crested-butte", atSeconds: 0 }]);
    expect(p.startedAt).toBe("2026-10-19T10:00:00.000Z");
  });

  it("records each later page with its offset from the first", () => {
    let p = appendStep(null, "/", at(0));
    p = appendStep(p, "/crested-butte", at(2));
    p = appendStep(p, "/properties/abc", at(5));
    expect(p!.steps.map((s) => s.path)).toEqual([
      "/",
      "/crested-butte",
      "/properties/abc",
    ]);
    expect(p!.steps[2].atSeconds).toBe(300);
  });

  // A reload, or a date change that only rewrites the query, is not movement.
  it("ignores a repeat of the page already at the end of the trail", () => {
    let p = appendStep(null, "/properties/abc", at(0));
    p = appendStep(p, "/properties/abc?checkIn=2026-12-01", at(1));
    expect(p!.steps).toHaveLength(1);
  });

  it("keeps the landing page when it has to shed steps", () => {
    let p = appendStep(null, "/landed-here", at(0));
    for (let i = 0; i < MAX_STEPS + 5; i++) {
      p = appendStep(p, `/page-${i}`, at(i + 1));
    }
    expect(p!.steps.length).toBeLessThanOrEqual(MAX_STEPS);
    expect(p!.steps[0].path).toBe("/landed-here");
    // The last page seen is always present — it is usually the checkout.
    expect(p!.steps[p!.steps.length - 1].path).toBe(`/page-${MAX_STEPS + 4}`);
    expect(p!.dropped).toBeGreaterThan(0);
  });

  // This cookie rides on every request to the site, so the cap is the point.
  it("stays under the byte cap even with long paths", () => {
    let p = appendStep(null, "/", at(0));
    for (let i = 0; i < 40; i++) {
      p = appendStep(p, `/properties/${"a".repeat(60)}${i}`, at(i + 1));
    }
    expect(serializeClickPath(p!).length).toBeLessThanOrEqual(MAX_COOKIE_BYTES);
  });
});

describe("serialize / parse", () => {
  it("round-trips", () => {
    let p = appendStep(null, "/", at(0));
    p = appendStep(p, "/crested-butte", at(3));
    const parsed = parseClickPath(serializeClickPath(p!));
    expect(parsed).toEqual(p);
  });

  it("returns null rather than throwing on junk, a wrong version, or nothing", () => {
    expect(parseClickPath(undefined)).toBeNull();
    expect(parseClickPath("")).toBeNull();
    expect(parseClickPath("not-a-path")).toBeNull();
    expect(parseClickPath("v2~1760000000~0~/:0")).toBeNull();
    expect(parseClickPath("v1~abc~0~/:0")).toBeNull();
  });

  it("skips malformed steps but keeps the good ones", () => {
    const parsed = parseClickPath("v1~1760000000~0~/:0~garbage~/book:120");
    expect(parsed!.steps.map((s) => s.path)).toEqual(["/", "/book"]);
  });
});

describe("formatClickPath", () => {
  it("renders the journey in order", () => {
    let p = appendStep(null, "/", at(0));
    p = appendStep(p, "/crested-butte", at(1));
    p = appendStep(p, "/book/q1", at(9));
    expect(formatClickPath(p)).toBe("/ → /crested-butte → /book/q1");
  });

  // A path that silently looks shorter than it was is worse than no path.
  it("says how many steps were elided", () => {
    let p = appendStep(null, "/landed-here", at(0));
    for (let i = 0; i < MAX_STEPS + 2; i++)
      p = appendStep(p, `/p${i}`, at(i + 1));
    expect(formatClickPath(p)).toContain("more…");
    expect(formatClickPath(p)!.startsWith("/landed-here → …")).toBe(true);
  });

  it("is null when there is nothing to show", () => {
    expect(formatClickPath(null)).toBeNull();
  });
});

/**
 * `document.cookie` is a getter that returns "a=1; b=2" and a setter that
 * takes one "name=value; attrs" string. Faking both is the only way to prove
 * the module reads back its own write — the bug class a pure-function test
 * cannot reach.
 */
function fakeDocument() {
  const jar = new Map<string, string>();
  return {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    set cookie(entry: string) {
      const [pair] = entry.split(";");
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1));
    },
    lastWrite: "",
  };
}

describe("recordClickPathStep", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accumulates across calls by reading back its own cookie", () => {
    vi.stubGlobal("document", fakeDocument());

    recordClickPathStep("/", at(0));
    recordClickPathStep("/crested-butte", at(2));
    const final = recordClickPathStep("/book/q1?from=card", at(9));

    expect(formatClickPath(final)).toBe("/ → /crested-butte → /book/q1");

    // And the value actually in the jar parses back to the same thing — this
    // is what the checkout route will read off the request.
    const raw = (document.cookie.match(
      new RegExp(`${CLICK_PATH_COOKIE}=([^;]*)`)
    ) || [])[1];
    expect(formatClickPath(parseClickPath(raw))).toBe(
      "/ → /crested-butte → /book/q1"
    );
  });

  it("scopes the cookie to the whole site and to this session", () => {
    const doc = fakeDocument();
    let written = "";
    vi.stubGlobal("document", {
      get cookie() {
        return doc.cookie;
      },
      set cookie(entry: string) {
        written = entry;
        doc.cookie = entry;
      },
    });

    recordClickPathStep("/", at(0));

    expect(written).toContain("path=/");
    expect(written).toContain("SameSite=Lax");
    // No Max-Age and no Expires: the trail describes one visit, and the
    // long game is `_sp_first_touch`'s job.
    expect(written).not.toMatch(/max-age|expires/i);
  });

  it("does nothing at all on the server", () => {
    vi.stubGlobal("document", undefined);
    expect(recordClickPathStep("/")).toBeNull();
  });
});

describe("clickPathMinutes", () => {
  it("measures the first page to the last one recorded", () => {
    let p = appendStep(null, "/", at(0));
    p = appendStep(p, "/book/q1", at(14));
    expect(clickPathMinutes(p)).toBe(14);
  });

  it("is null without a path", () => {
    expect(clickPathMinutes(null)).toBeNull();
  });
});
