/**
 * Once-a-day summary of Guesty rate-limiting, replacing a per-incident email.
 *
 * ── Why a digest ────────────────────────────────────────────────────────
 *
 * `guesty-429-burst` used to email the moment six terminal 429s landed in
 * five minutes, deduped to one an hour. In the fortnight to 2026-10-28 that
 * trigger fired up to 168 times in a single day and put 1–6 emails a day in
 * the ops inbox — for a condition whose own alert text said "Do not assume
 * this site caused it" and then listed three things to go and check later.
 *
 * Nothing about a shared-account rate limit is fixed inside an hour. The
 * useful signal is the SHAPE over days: which minute of the hour the 429s
 * cluster in tells you whose scheduled job is eating the budget, and no
 * single incident can show you that. So the burst path now only records
 * (see guesty-beapi.ts) and this reports, once, in the morning.
 *
 * ── Quiet days send nothing ─────────────────────────────────────────────
 *
 * A digest that arrives every morning to say "nothing happened" is the same
 * noise problem in a daily wrapper. With no terminal 429s in 24 hours there
 * is nothing to report and no email is sent.
 *
 * Schedule: 35 7 * * * — five minutes after the booking digest, so the two
 * daily emails arrive together rather than scattered.
 */
import { NextResponse } from "next/server";
import { sendAlert, OPS_ALERT_INBOX } from "@/lib/alerts";
import { BEAPI_MAX_CONCURRENCY } from "@/lib/guesty-beapi";
import {
  fetchRecentEvents,
  renderSummary,
  summarize,
} from "@/lib/guesty-rate-limit-events";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Terminal 429s in 24h above which the subject line gets a warning marker.
 *
 * Calibrated against observed volume: in the fortnight to 2026-10-28 the
 * quiet days sat at 12–31 and the bad ones at 220–295, so this clears
 * normal background without requiring a spike to be extraordinary before it
 * is flagged. It changes the SUBJECT only — the email is sent either way.
 */
export const ELEVATED_24H = 120;

/**
 * Share of the week's events one bucket must hold to count as a cluster.
 *
 * Six buckets means even weight is ~17% each. 35% is roughly double that —
 * enough that calling it a cluster is a statement, not noise.
 */
export const CLUSTER_SHARE = 35;

/** `25 * * * *` lands in the third bucket, :20–:29. */
const OUR_CRON_BUCKET = 2;

export interface Digest {
  subject: string;
  body: string;
  last24h: number;
  lastWeek: number;
  peakBucket: string;
  peakShare: number;
  elevated: boolean;
}

function bucketLabel(index: number): string {
  return `:${String(index * 10).padStart(2, "0")}–:${String(
    index * 10 + 9
  ).padStart(2, "0")}`;
}

/**
 * Decide what today's digest says, or null when there is nothing to send.
 *
 * Pure so the judgment calls — is this a cluster, is it ours, is it
 * elevated — can be tested without a database or a mail provider.
 */
export function buildDigest(
  events: Array<{ occurred_at: string }>,
  now: number
): Digest | null {
  const dayAgo = now - 86_400_000;
  const last24h = events.filter(
    (e) => Date.parse(e.occurred_at) >= dayAgo
  ).length;

  // Silence is a valid result — that is the whole point of a digest.
  if (last24h === 0) return null;

  const summary = summarize(events, now);
  const elevated = last24h >= ELEVATED_24H;

  const peakCount = Math.max(...summary.minuteBuckets);
  const peakIndex = summary.minuteBuckets.indexOf(peakCount);
  const peakShare =
    summary.lastWeek > 0 ? Math.round((peakCount / summary.lastWeek) * 100) : 0;

  // Which bucket dominates is the one actionable fact here, so lead with it
  // rather than making the reader interpret the chart. A bucket that is
  // merely the largest of six roughly equal ones is not a cluster.
  const lead =
    peakShare >= CLUSTER_SHARE
      ? `<p><strong>${peakShare}% of the week's 429s fall in ${bucketLabel(peakIndex)}.</strong> ` +
        (peakIndex === OUR_CRON_BUCKET
          ? `That is our own <code>sync-calendar</code> cron (<code>25 * * * *</code>). ` +
            `If it is still the dominant bucket, widen <code>REQUEST_SPACING_MS</code> ` +
            `in <code>src/lib/calendar-sync.ts</code> further.`
          : `No job of ours runs then — that points at another integration on the ` +
            `shared Guesty account (the CRM sweep, PriceLabs, Conduit).`) +
        `</p>`
      : `<p>No single minute-of-hour dominates, so this looks like broad pressure ` +
        `on the shared account rather than one job.</p>`;

  return {
    subject: elevated
      ? `⚠️ Guesty rate limiting — ${last24h} in 24h`
      : `Guesty rate-limit digest — ${last24h} in 24h`,
    body:
      `<p>Terminal Guesty 429s in the last 24 hours: <strong>${last24h}</strong>.` +
      (elevated
        ? ` That is above the ${ELEVATED_24H}/day mark where this is worth acting on.`
        : ` This is background level — recorded for the trend, nothing to do.`) +
      `</p>` +
      lead +
      renderSummary(summary) +
      `<p>Guesty rate-limits per <strong>account</strong>, and that budget is shared ` +
      `with every other integration on the same credentials. A rising count is not ` +
      `by itself evidence that this site caused it — the minute clustering above is.</p>` +
      // The gate (#110) bounds fan-out per instance; the cron's spacing bounds
      // sustained rate. Neither bounds the other's failure mode, so a reader
      // looking at a spike needs to know which one is already in place.
      `<p>Page-render BEAPI calls are capped at ${BEAPI_MAX_CONCURRENCY} concurrent ` +
      `per instance, so a traffic burst queues rather than stampedes. A spike despite ` +
      `that means several instances were warm at once, a scheduled job spent the ` +
      `budget, or another integration did.</p>` +
      `<p>Full history: ` +
      `<code>select * from guesty_rate_limit_events order by occurred_at desc</code></p>`,
    last24h,
    lastWeek: summary.lastWeek,
    peakBucket: bucketLabel(peakIndex),
    peakShare,
    elevated,
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const digest = buildDigest(await fetchRecentEvents(), now);

  if (!digest) {
    return NextResponse.json({ sent: false, reason: "no 429s in 24h" });
  }

  await sendAlert(
    digest.subject,
    digest.body,
    // One key, one email a day. The date suffix is what makes it daily:
    // sendAlert's cooldown is an hour, which would not stop a retried cron
    // run from sending a second copy.
    `guesty-health-digest-${new Date(now).toISOString().slice(0, 10)}`,
    { to: OPS_ALERT_INBOX }
  );

  return NextResponse.json({ sent: true, ...digest, body: undefined });
}
