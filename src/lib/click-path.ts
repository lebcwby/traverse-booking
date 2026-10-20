/**
 * The pages a visitor saw before they booked, for this browser session.
 *
 * ── Why it lives in a cookie written by the BROWSER ─────────────────────
 *
 * The obvious implementation — append the path in `proxy.ts` — is the one
 * thing we must not do. A response carrying `Set-Cookie` cannot be stored in
 * a shared cache, so writing a breadcrumb on every page view would put
 * `Set-Cookie` on every HTML response and un-cache the whole site. That is
 * precisely the regression PR #94 fixed when 216 of 219 Guesty 429s turned
 * out to come from uncacheable listing pages.
 *
 * `document.cookie` has no such effect: it is a client-side write, no
 * response header is involved, and the CDN never sees it. The server then
 * gets the trail for free on the next request — which is how the checkout
 * routes pick it up, with no change to any request body.
 *
 * ── Shape ───────────────────────────────────────────────────────────────
 *
 *   v1~<startEpochSeconds>~<droppedCount>~<path>:<offsetSeconds>~...
 *
 * Compact on purpose: this cookie rides along on every request, so it is
 * capped at {@link MAX_STEPS} steps and {@link MAX_COOKIE_BYTES} bytes. The
 * separators (`~`, `:`) are stripped from paths, so no escaping is needed and
 * the value survives `document.cookie` unencoded.
 *
 * When the cap is hit the LANDING page is kept and the second-oldest step is
 * dropped, because where someone entered is the part nothing else records.
 * `dropped` keeps the count honest so a rendered path can say "+3 more"
 * rather than quietly implying a shorter journey.
 *
 * Query strings are discarded. They carry search terms, occasionally an
 * email, and are not needed to read a funnel.
 */

export const CLICK_PATH_COOKIE = "_sp_path";
export const MAX_STEPS = 12;
export const MAX_COOKIE_BYTES = 700;
const MAX_PATH_LENGTH = 80;
const VERSION = "v1";

export interface ClickPathStep {
  /** Pathname only, no query string. */
  path: string;
  /** Seconds after the first step in this session. */
  atSeconds: number;
}

export interface ClickPath {
  /** ISO timestamp of the first page seen this session. */
  startedAt: string;
  /** Steps elided to stay under the cap. */
  dropped: number;
  steps: ClickPathStep[];
}

/** Strip the query, the separators, and anything unreasonably long. */
export function sanitizePath(input: string): string | null {
  if (!input) return null;
  const withoutQuery = input.split(/[?#]/)[0];
  const cleaned = withoutQuery.replace(/[^A-Za-z0-9/_.\-]/g, "");
  if (!cleaned.startsWith("/")) return null;
  return cleaned.slice(0, MAX_PATH_LENGTH);
}

export function serializeClickPath(path: ClickPath): string {
  const start = Math.floor(Date.parse(path.startedAt) / 1000);
  const steps = path.steps.map((s) => `${s.path}:${s.atSeconds}`);
  return [VERSION, String(start), String(path.dropped), ...steps].join("~");
}

export function parseClickPath(
  raw: string | null | undefined
): ClickPath | null {
  if (!raw) return null;
  const parts = raw.split("~");
  if (parts.length < 3 || parts[0] !== VERSION) return null;

  const startSeconds = Number(parts[1]);
  const dropped = Number(parts[2]);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(dropped)) return null;

  const steps: ClickPathStep[] = [];
  for (const entry of parts.slice(3)) {
    const sep = entry.lastIndexOf(":");
    if (sep <= 0) continue;
    const path = entry.slice(0, sep);
    const atSeconds = Number(entry.slice(sep + 1));
    if (!path.startsWith("/") || !Number.isFinite(atSeconds)) continue;
    steps.push({ path, atSeconds });
  }
  if (steps.length === 0) return null;

  return {
    startedAt: new Date(startSeconds * 1000).toISOString(),
    dropped: Math.max(0, Math.trunc(dropped)),
    steps,
  };
}

/**
 * Add a page to the trail. A reload or a replaced query string lands on the
 * same path as the previous step and is not recorded again — the interesting
 * signal is movement between pages, not how many times a page re-rendered.
 */
export function appendStep(
  existing: ClickPath | null,
  rawPath: string,
  now: Date = new Date()
): ClickPath | null {
  const path = sanitizePath(rawPath);
  if (!path) return existing;

  if (!existing) {
    return {
      startedAt: now.toISOString(),
      dropped: 0,
      steps: [{ path, atSeconds: 0 }],
    };
  }

  const last = existing.steps[existing.steps.length - 1];
  if (last?.path === path) return existing;

  const atSeconds = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(existing.startedAt)) / 1000)
  );

  let next: ClickPath = {
    ...existing,
    steps: [...existing.steps, { path, atSeconds }],
  };

  // Keep step 0 (the landing page) and shed from the front of the middle.
  while (
    next.steps.length > MAX_STEPS ||
    serializeClickPath(next).length > MAX_COOKIE_BYTES
  ) {
    if (next.steps.length <= 2) break;
    next = {
      ...next,
      dropped: next.dropped + 1,
      steps: [next.steps[0], ...next.steps.slice(2)],
    };
  }

  return next;
}

/** "/ → /crested-butte → …3 more… → /book/abc" */
export function formatClickPath(path: ClickPath | null): string | null {
  if (!path || path.steps.length === 0) return null;
  const rendered = path.steps.map((s) => s.path);
  if (path.dropped > 0 && rendered.length > 1) {
    rendered.splice(1, 0, `…${path.dropped} more…`);
  }
  return rendered.join(" → ");
}

/** Total minutes from the first page seen to the last recorded step. */
export function clickPathMinutes(path: ClickPath | null): number | null {
  if (!path || path.steps.length === 0) return null;
  return Math.round(path.steps[path.steps.length - 1].atSeconds / 60);
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : undefined;
}

/**
 * Record one page view. Safe to call on every route change; it is a single
 * cookie read and write and never touches the network.
 *
 * Session cookie by design — the trail describes one visit. The long game
 * (first touch, days-ago campaign) is the `_sp_first_touch` cookie's job.
 */
export function recordClickPathStep(
  rawPath: string,
  now: Date = new Date()
): ClickPath | null {
  if (typeof document === "undefined") return null;

  const next = appendStep(
    parseClickPath(readCookie(CLICK_PATH_COOKIE)),
    rawPath,
    now
  );
  if (!next) return null;

  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${CLICK_PATH_COOKIE}=${serializeClickPath(next)}; path=/; SameSite=Lax${secure}`;
  return next;
}
