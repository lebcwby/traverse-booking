// src/lib/beapi-error.ts
//
// Sanitize Guesty BEAPI / OpenAPI error responses before they reach the
// browser.
//
// Why this exists:
// Raw BEAPI error strings frequently include internal field names
// (`checkInDateLocalized`, `unitTypeId`), Guesty Mongo ids, stack-shaped
// detail strings, and proprietary error codes (`LISTING_IS_NOT_AVAILABLE`,
// `WRONG_REQUEST_PARAMETERS`, `UNABLE_TO_GET_QUOTE`). Forwarding those raw
// to the browser leaks our integration surface and confuses guests.
//
// Pattern:
//   const classified = classifyBeapiError(err);
//   console.error("[Quotes]", err);            // raw stays in server logs
//   return NextResponse.json(
//     { error: classified.message, code: classified.code },
//     { status: classified.status }
//   );
//
// On the client, switch on `code` for special UX (e.g. "dates unavailable"
// triggers a date-picker shake) instead of substring-sniffing the message.
//
// This module is intentionally pure / synchronous so it can be safely
// imported by both server routes and (read-only) client error handlers.

/**
 * Stable, public error codes the browser can switch on. These are part of
 * our wire contract with the client. Add new variants here rather than
 * shipping ad-hoc strings.
 */
export type BeapiErrorCode =
  | "DATES_UNAVAILABLE"
  | "INVALID_DATES"
  | "MIN_NIGHTS_NOT_MET"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UPSTREAM_DOWN"
  | "QUOTE_EXPIRED"
  | "UNKNOWN";

export interface ClassifiedBeapiError {
  /** Stable code the browser switches on. */
  code: BeapiErrorCode;
  /** Friendly, sanitized message safe to render in the booking UI. */
  message: string;
  /** Recommended HTTP status for the route to respond with. */
  status: number;
}

/**
 * Coerce any caught value into a lowercased string usable for substring
 * matching. Handles Error, {message}, {error}, plain string, and the
 * `{ status, body }` shape thrown by some fetch wrappers.
 */
function extractRawText(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    // Some fetch wrappers stuff the response body onto a `.cause` property.
    const cause = (err as { cause?: unknown }).cause;
    const parts = [err.message];
    if (cause && typeof cause === "object") {
      parts.push(safeStringify(cause));
    }
    return parts.filter(Boolean).join(" | ");
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    if (typeof o.body === "string") return o.body;
    return safeStringify(o);
  }
  return String(err);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/**
 * Walk the raw text against a known set of BEAPI patterns. Order matters:
 * more specific patterns first, generic fallbacks last.
 */
export function classifyBeapiError(err: unknown): ClassifiedBeapiError {
  const raw = extractRawText(err);
  const lower = raw.toLowerCase();

  // ── Dates unavailable ───────────────────────────────────────────────
  // BEAPI returns LISTING_IS_NOT_AVAILABLE for blocked / booked dates.
  // The literal phrase "not applicable" is BEAPI's wording when no rate
  // plan is applicable to the requested dates (almost always = blocked).
  if (
    /listing_is_not_available|not applicable|no available rate plan/i.test(raw)
  ) {
    return {
      code: "DATES_UNAVAILABLE",
      message: "These dates are no longer available — please pick new dates.",
      status: 409,
    };
  }

  // ── Invalid date fields ─────────────────────────────────────────────
  // Validation errors mention the localized field names. These also show
  // up when the user picks a check-in equal to or after check-out.
  if (
    /checkindatelocalized|checkoutdatelocalized|invalid_date|date.*must be/i.test(
      raw
    )
  ) {
    return {
      code: "INVALID_DATES",
      message: "Please select valid check-in and check-out dates.",
      status: 400,
    };
  }

  // ── Min-nights / max-nights ─────────────────────────────────────────
  if (/min_nights|minimum.*nights|max_nights|maximum.*nights/i.test(raw)) {
    return {
      code: "MIN_NIGHTS_NOT_MET",
      message:
        "This property has a minimum-stay requirement that your dates don't meet — try extending your stay or pick a different property.",
      status: 400,
    };
  }

  // ── Quote expired / not found ───────────────────────────────────────
  if (/quote.*not.*found|quote.*expired|unable_to_get_quote/i.test(raw)) {
    return {
      code: "QUOTE_EXPIRED",
      message:
        "Your pricing has expired — please go back and reselect your dates.",
      status: 410,
    };
  }

  // ── Auth / token ────────────────────────────────────────────────────
  // Token-expired comes back as 401 with assorted text. The "use
  // booking.guesty.com" phrase is the BEAPI tenant-mismatch error.
  if (
    /token.*expired|invalid.*token|unauthor|use booking\.guesty\.com/i.test(raw)
  ) {
    return {
      code: "UNAUTHORIZED",
      // Don't tell the user about tokens — surface a graceful fallback.
      message:
        "We couldn't reach our booking system. Please refresh and try again — if this keeps happening, give us a call.",
      status: 503,
    };
  }

  // ── Rate limited ────────────────────────────────────────────────────
  if (/rate.?limit|429|too many requests/i.test(raw)) {
    return {
      code: "RATE_LIMITED",
      message:
        "We're getting a lot of requests right now. Please wait a moment and try again.",
      status: 429,
    };
  }

  // ── Generic upstream failure ────────────────────────────────────────
  // 5xx-shaped errors, network resets, "internal server error", etc.
  if (
    /^5\d\d|internal.*error|upstream|service unavailable|ECONNRESET|ETIMEDOUT/i.test(
      raw
    ) ||
    /^\s*5\d\d/.test(lower)
  ) {
    return {
      code: "UPSTREAM_DOWN",
      message:
        "Our booking system is temporarily unavailable. Please try again in a minute.",
      status: 503,
    };
  }

  // ── Bucket of malformed / unrecognized validation errors ────────────
  // WRONG_REQUEST_PARAMETERS is BEAPI's catch-all for "your request body
  // didn't validate" — almost always a date/guest-count combo problem
  // from the user's perspective.
  if (/wrong_request_parameters|bad.?request|400|validation/i.test(raw)) {
    return {
      code: "INVALID_REQUEST",
      message:
        "Something went wrong with that search — please try different dates.",
      status: 400,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Something went wrong. Please try again in a moment.",
    status: 500,
  };
}

/**
 * Convenience helper for routes that just want the friendly string.
 */
export function mapBeapiErrorToUserMessage(err: unknown): string {
  return classifyBeapiError(err).message;
}
