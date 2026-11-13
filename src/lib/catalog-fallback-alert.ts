/**
 * The "catalogue served from mirror" notification, and when NOT to send it.
 *
 * ── Two problems this fixes ─────────────────────────────────────────────
 *
 * 1. IT WAS A DUPLICATE. The mirror is served *because* an upstream call
 *    failed, and when that failure is the BEAPI token, `getBEAPIToken()` has
 *    already emailed "CRITICAL: BEAPI token unavailable". On 2026-10-28 the
 *    two landed at 04:51:11 and 04:51:12 — one incident, two emails, one
 *    second apart. The token alert is the better of the two (it names the
 *    cause and the cron to check), so when it has just fired this one stays
 *    quiet and lets it speak.
 *
 * 2. THE COOLDOWN KEY WAS FRAGMENTED. The key was
 *    `catalog-served-from-mirror:${reason.kind}`, added so a 429 and a
 *    timeout in the same hour would not collapse into two identical emails.
 *    It worked, and it also gave every failure kind its own independent
 *    one-hour budget: three keys existed in `kv_store` within two days
 *    (`:unknown`, `:rate_limited`, and the legacy bare key), so a flapping
 *    cause multiplied the send rate instead of deduplicating it.
 *
 *    The reason now goes in the SUBJECT LINE, which distinguishes the emails
 *    in the inbox — the actual goal — while a single key holds the hourly
 *    budget for all of them.
 */

import { sendAlert, wasAlertSentRecently, OPS_ALERT_INBOX } from "@/lib/alerts";
import { FAILURE_GUIDANCE, type FailureReason } from "@/lib/failure-reason";

/** One hourly budget for this alert, whatever the cause. */
export const MIRROR_ALERT_KEY = "catalog-served-from-mirror";

/** The upstream alert this one defers to. */
export const TOKEN_ALERT_KEY = "beapi-token-expired";

/**
 * How recently the token alert must have fired for this one to stay quiet.
 *
 * Matches sendAlert's own cooldown: while the token alert is still inside
 * its own window it would not re-send anyway, so that is exactly the period
 * during which this alert would be the second email about one incident.
 */
export const TOKEN_SUPPRESSION_MS = 60 * 60 * 1000;

/** Human-facing label for the subject line. */
const KIND_LABEL: Record<FailureReason["kind"], string> = {
  rate_limited: "rate limited",
  token: "token failure",
  forbidden: "403 forbidden",
  timeout: "timeout",
  network: "network error",
  upstream_error: "Guesty server error",
  unknown: "cause unclear",
};

export function mirrorAlertSubject(reason: FailureReason): string {
  return `LISTING CATALOGUE SERVED FROM MIRROR — ${KIND_LABEL[reason.kind]}`;
}

export function mirrorAlertBody(
  reason: FailureReason,
  branch: string | null | undefined
): string {
  return (
    `BEAPI failed on <code>/properties</code> (${branch ?? "unknown branch"}), ` +
    "so the page is being served from the Supabase <code>listings</code> " +
    "mirror instead of live inventory.<br><br>" +
    `<b>Reason:</b> ${reason.kind}` +
    (reason.status !== null ? ` (HTTP ${reason.status})` : "") +
    `<br><code>${reason.summary}</code><br><br>` +
    `${FAILURE_GUIDANCE[reason.kind]}<br><br>` +
    "The page and its internal links are intact, but " +
    "<b>availability and pricing are stale and booking is likely failing</b>. " +
    "Check <code>/api/health/beapi</code>."
  );
}

/**
 * Should this notification be sent at all?
 *
 * Only `token` defers. A 429 or a timeout has no upstream email covering it,
 * so suppressing those would lose the signal entirely.
 */
export async function shouldNotify(reason: FailureReason): Promise<boolean> {
  if (reason.kind !== "token") return true;
  return !(await wasAlertSentRecently(TOKEN_ALERT_KEY, TOKEN_SUPPRESSION_MS));
}

/** Fire-and-forget: this runs during a page render and must never throw. */
export async function notifyCatalogFallback(
  reason: FailureReason,
  branch: string | null | undefined
): Promise<void> {
  try {
    if (!(await shouldNotify(reason))) {
      console.log(
        "[CatalogFallback] Suppressed — the BEAPI token alert already covers this incident."
      );
      return;
    }
    await sendAlert(
      mirrorAlertSubject(reason),
      mirrorAlertBody(reason, branch),
      MIRROR_ALERT_KEY,
      { to: OPS_ALERT_INBOX }
    );
  } catch {
    // Never let alerting break a page render.
  }
}
