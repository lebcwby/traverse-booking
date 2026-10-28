/**
 * Turn a thrown upstream error into something an alert can say out loud.
 *
 * The `LISTING CATALOGUE SERVED FROM MIRROR` alert said only "BEAPI failed",
 * which is the one thing we already knew. On 2026-10-26 it fired twice; one
 * firing had a matching burst of 429s in `guesty_rate_limit_events` and the
 * other had no recorded rate-limit event at all, so the two were
 * indistinguishable from the email even though they almost certainly had
 * different causes. A 429 means we are over Guesty's shared account budget
 * and the fix is pacing; a timeout or a token failure means something else
 * entirely and pacing would be wasted work.
 *
 * Errors from `guesty-beapi.ts` are plain `Error`s carrying the status in the
 * message (`BEAPI /api/listings failed: 429 …`), so classification is string
 * matching. That is fragile by nature, which is why `unknown` keeps the raw
 * message rather than discarding it — an unrecognised shape should still tell
 * the reader something.
 */

export type FailureKind =
  | "rate_limited"
  | "token"
  | "forbidden"
  | "timeout"
  | "network"
  | "upstream_error"
  | "unknown";

export interface FailureReason {
  kind: FailureKind;
  /** HTTP status when the message carried one. */
  status: number | null;
  /** Short, escaped, safe to drop into an HTML alert body. */
  summary: string;
}

const MAX_SUMMARY = 200;

/**
 * Cut long upstream text without slicing a word in half.
 *
 * A bare slice(0, 200) ended one real alert at "Check /api/health/beapi for
 * the token's real e", which reads like the email itself is broken. Back up
 * to the last space and say explicitly that there is more.
 */
function truncate(message: string): string {
  if (message.length <= MAX_SUMMARY) return message;
  // The ellipsis counts against the budget: callers (and the existing test)
  // treat MAX_SUMMARY as the length of what comes out, not of what went in.
  const cut = message.slice(0, MAX_SUMMARY - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Only honour the word boundary if it is not pathologically early — a long
  // run with no spaces (a URL, a stack frame, a base64 blob) should still
  // show its first ~200 characters rather than almost nothing.
  const body = lastSpace > (MAX_SUMMARY - 1) * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}…`;
}

/** The alert body is HTML, and the message contains upstream response text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || "Error";
  if (typeof err === "string") return err;
  try {
    // ⚠️ JSON.stringify(undefined) is `undefined`, not a string, and
    // JSON.stringify of a symbol or bare function is too. This runs on an
    // alert path that must never throw, so coerce before returning.
    return JSON.stringify(err) ?? String(err);
  } catch {
    return String(err);
  }
}

function statusOf(message: string): number | null {
  // Our own thrown shapes put the status straight after the verb.
  const tagged = message.match(/(?:failed|forbidden|error):\s*(\d{3})\b/i);
  if (tagged) return Number(tagged[1]);
  // Otherwise accept a bare 4xx/5xx, which is what most upstreams produce.
  const bare = message.match(/\b([45]\d{2})\b/);
  return bare ? Number(bare[1]) : null;
}

function kindOf(
  err: unknown,
  message: string,
  status: number | null
): FailureKind {
  const name = err instanceof Error ? err.name : "";

  if (status === 429 || /\brate.?limit/i.test(message)) return "rate_limited";
  // "token unavailable" is the alert SUBJECT; the thrown message says "Could
  // not obtain a BEAPI token …", which matched nothing and classified the
  // single most common real failure as `unknown`. That cost twice: the email
  // said "unrecognised failure shape" about a failure we recognise perfectly
  // well, and `unknown` opened its own cooldown bucket alongside the real
  // ones. Match on obtaining/refreshing a token, not on the subject line.
  if (
    status === 401 ||
    /token unavailable|unauthoriz|(?:obtain|refresh|mint)\w*\s+(?:a\s+)?\w*\s*token/i.test(
      message
    )
  ) {
    return "token";
  }
  if (status === 403) return "forbidden";
  if (
    name === "AbortError" ||
    /timed? ?out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(message)
  ) {
    return "timeout";
  }
  if (
    name === "TypeError" ||
    /fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
      message
    )
  ) {
    return "network";
  }
  if (status !== null && status >= 500) return "upstream_error";
  if (status !== null) return "upstream_error";
  return "unknown";
}

export function describeUpstreamFailure(err: unknown): FailureReason {
  const message = messageOf(err);
  const status = statusOf(message);
  return {
    kind: kindOf(err, message, status),
    status,
    summary: escapeHtml(truncate(message)),
  };
}

/** One line a human can act on, per kind. */
export const FAILURE_GUIDANCE: Record<FailureKind, string> = {
  rate_limited:
    "Guesty rejected us for volume — we are over the ~120/min shared account budget. " +
    "Look for a burst in <code>guesty_rate_limit_events</code> around this time.",
  token:
    "The BEAPI token was missing or rejected. Check <code>/api/health/beapi</code> " +
    "and the <code>refresh-tokens</code> cron; note OAuth mints are capped at 5/24h.",
  forbidden:
    "Guesty returned 403. This is usually credentials or scope, not volume.",
  timeout:
    "Guesty did not answer in time. No quota was consumed — this is latency, not limits.",
  network:
    "The request never reached Guesty (DNS, connection reset or refused).",
  upstream_error:
    "Guesty returned a server error. Nothing on our side to pace.",
  unknown:
    "Unrecognised failure shape — the raw message is above. If this recurs, " +
    "teach describeUpstreamFailure() about it.",
};
