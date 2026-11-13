/**
 * Timestamped history of terminal Guesty 429s.
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 *
 * On 2026-10-14 the `guesty-429-burst` alert fired at 10:09Z. The alert text
 * said a traffic spike or scraper was eating our quota and pointed at the
 * Vercel Firewall. The site had served roughly 42 requests that hour, against
 * a ceiling of 120 per MINUTE — three orders of magnitude from the limit. A
 * quieter hour alerted while a busier one did not. It was not us.
 *
 * Guesty rate-limits per ACCOUNT. That quota is shared with every other
 * integration on the same credentials — notably the CRM, whose
 * `refresh-reservations` cron paginates guests, reservations AND messages
 * every hour on the hour, nine minutes before the burst we saw.
 *
 * The thing that made this hard to pin down: the alert's only durable trace
 * was a cooldown row holding `lastSentAt`, overwritten on every send. One
 * timestamp, no history, nothing to correlate against. So each occurrence
 * started the investigation from scratch and the honest answer was always "we
 * cannot tell". This module fixes that — not by guessing harder, but by
 * keeping the evidence.
 *
 * ── Shape ───────────────────────────────────────────────────────────────
 *
 * One INSERT per event, never a read-modify-write of an array: concurrent
 * lambdas would race and silently drop entries. Every write is best-effort
 * and swallows its errors — diagnostics must never break the BEAPI path they
 * are observing.
 */
import { getSupabaseAdmin } from "./supabase-admin";

const TABLE = "guesty_rate_limit_events";

/** How far back the alert summary looks. */
const SUMMARY_WINDOW_DAYS = 7;

/** Cap on rows pulled for the summary. Terminal 429s should be rare. */
const SUMMARY_ROW_CAP = 1000;

export async function recordRateLimitEvent(
  path: string,
  alerted: boolean
): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from(TABLE)
      .insert({ surface: "beapi", path, alerted });
  } catch {
    // Diagnostics must never break the path they observe.
  }
}

/**
 * Raw events for the last {@link SUMMARY_WINDOW_DAYS} days, newest first.
 *
 * Exposed so the daily digest can count its own windows without a second
 * round trip; `summarize`/`renderSummary` then reuse the same rows.
 */
export async function fetchRecentEvents(): Promise<
  Array<{ occurred_at: string; path: string | null; alerted: boolean | null }>
> {
  try {
    const since = new Date(
      Date.now() - SUMMARY_WINDOW_DAYS * 86_400_000
    ).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select("occurred_at, path, alerted")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(SUMMARY_ROW_CAP);
    if (error || !data) return [];
    return data as Array<{
      occurred_at: string;
      path: string | null;
      alerted: boolean | null;
    }>;
  } catch {
    return [];
  }
}

export interface RateLimitEventSummary {
  lastHour: number;
  lastWeek: number;
  /** Counts per 10-minute bucket of the hour, index 0 = :00–:09. */
  minuteBuckets: number[];
}

/**
 * Bucket events by minute-of-hour.
 *
 * This is the whole diagnostic. Our own traffic has no reason to cluster at a
 * particular minute; scheduled jobs do. Heavy weight in the :00–:09 bucket
 * points at an hourly cron somewhere on the account, which is a completely
 * different investigation from a scraper.
 */
export function summarize(
  rows: Array<{ occurred_at: string }>,
  now = Date.now()
): RateLimitEventSummary {
  const hourAgo = now - 3_600_000;
  const weekAgo = now - SUMMARY_WINDOW_DAYS * 86_400_000;
  const minuteBuckets = [0, 0, 0, 0, 0, 0];
  let lastHour = 0;
  let lastWeek = 0;

  for (const r of rows) {
    const t = Date.parse(r.occurred_at);
    if (!Number.isFinite(t) || t < weekAgo) continue;
    lastWeek += 1;
    if (t >= hourAgo) lastHour += 1;
    const bucket = Math.floor(new Date(t).getUTCMinutes() / 10);
    if (bucket >= 0 && bucket < 6) minuteBuckets[bucket] += 1;
  }

  return { lastHour, lastWeek, minuteBuckets };
}

/** Render the summary as the HTML fragment the alert email embeds. */
export function renderSummary(s: RateLimitEventSummary): string {
  if (s.lastWeek === 0) return "";

  const peak = Math.max(...s.minuteBuckets);
  const rows = s.minuteBuckets
    .map((count, i) => {
      const label = `:${String(i * 10).padStart(2, "0")}–:${String(i * 10 + 9).padStart(2, "0")}`;
      // Visual weight makes a cluster obvious at a glance in an email client
      // that may not render a chart.
      const bar = peak > 0 ? "█".repeat(Math.round((count / peak) * 12)) : "";
      return (
        `<tr><td style="padding:1px 8px 1px 0;font-family:monospace">${label}</td>` +
        `<td style="padding:1px 8px 1px 0;font-family:monospace">${bar}</td>` +
        `<td style="padding:1px 0;font-family:monospace">${count}</td></tr>`
      );
    })
    .join("");

  return (
    `<strong>Terminal 429s:</strong> ${s.lastHour} in the last hour, ` +
    `${s.lastWeek} in the last ${SUMMARY_WINDOW_DAYS} days.<br/><br/>` +
    `<strong>Clustering by minute of hour (UTC, last ${SUMMARY_WINDOW_DAYS} days):</strong><br/>` +
    `<table style="border-collapse:collapse;margin:6px 0">${rows}</table>` +
    `<em>Organic traffic has no reason to favour a particular minute; scheduled ` +
    `jobs do. Weight in <strong>:20–:29</strong> is OUR OWN <code>sync-calendar</code> ` +
    `cron (<code>25 * * * *</code>) — that is the first thing to pace. Weight in ` +
    `:00–:09 or :10–:19 points at a cron elsewhere on the shared Guesty account ` +
    `(the CRM sweep, PriceLabs, Conduit) rather than at this site.</em><br/><br/>`
  );
}

/**
 * Fetch and render in one call.
 *
 * Was the per-incident alert's context block. That alert is gone (see
 * guesty-beapi.ts) and the daily digest needs the raw rows for its own
 * windows, so it calls fetchRecentEvents() + summarize() + renderSummary()
 * directly. Kept because it is the obvious entry point for any future
 * surface that just wants the HTML.
 */
export async function summarizeRecentRateLimitEvents(): Promise<string> {
  const rows = await fetchRecentEvents();
  if (rows.length === 0) return "";
  return renderSummary(summarize(rows));
}
