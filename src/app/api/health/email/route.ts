// /api/health/email
//
// Answers the question the alert system cannot answer about itself: our
// alerts are *accepted* by Resend (21 in 24h on 2026-10-05, proven by the
// alert_cooldown:* rows, which are only written after a successful send) and
// yet nobody receives them. Acceptance is not delivery, and nothing in the
// codebase recorded the difference.
//
// This reads back from Resend — in production, where RESEND_API_KEY actually
// lives — the two things that distinguish the candidate causes:
//
//   1. Per-message `last_event`: delivered / bounced / queued / failed.
//      bounced or failed => a sending problem. delivered => the mail reached
//      the mailbox and the problem is filtering on the receiving side.
//   2. The sending domain's verification status. An unverified domain is the
//      single most common reason Resend accepts and then silently drops.
//
// Plus the live recipient list, because ALERT_TO_EMAIL is encrypted in Vercel
// and `vercel env pull` returns empty for sensitive vars — so "who are we
// even mailing?" is otherwise unanswerable without the dashboard.
//
// Fully auth-gated (CRON_SECRET): this returns recipient addresses and alert
// subjects, which is more than a monitor needs.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  applyHealthCacheHeaders,
  isHealthRequestAuthorized,
} from "@/lib/health";
import { getAlertRouting } from "@/lib/alerts";

export const dynamic = "force-dynamic";
// The ?send=test path polls Resend for up to ~15s waiting for a verdict.
export const maxDuration = 60;

/** last_event values that mean the message did NOT reach the mailbox. */
const FAILED_EVENTS = new Set(["bounced", "failed", "complained"]);
/** last_event values that mean it is still in flight, not yet a verdict. */
const PENDING_EVENTS = new Set(["queued", "scheduled", "delivery_delayed"]);

export async function GET(request: Request) {
  if (!isHealthRequestAuthorized(request)) {
    return applyHealthCacheHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    );
  }

  const routing = getAlertRouting();
  if (!routing.hasApiKey) {
    return applyHealthCacheHeaders(
      NextResponse.json(
        {
          status: "degraded",
          reason: "RESEND_API_KEY is not set — no alert can be sent at all.",
          routing,
        },
        { status: 503 }
      )
    );
  }

  const resend = new Resend((process.env.RESEND_API_KEY || "").trim());

  // ── Opt-in end-to-end test (?send=test) ────────────────────────────────
  // Sends one real alert to the configured recipients and polls Resend for
  // the verdict. Without this, "the config now looks right" is an assertion;
  // with it, `delivered` is evidence. Never fires unless explicitly asked.
  const wantsTest =
    new URL(request.url).searchParams.get("send") === "test" &&
    routing.recipients.length > 0;
  let testSend: Record<string, unknown> | null = null;
  if (wantsTest) {
    try {
      const sent = await resend.emails.send({
        from: routing.from,
        to: routing.recipients,
        subject: "[BookTraverse Alert] Delivery test",
        html:
          "<p>Delivery test for the ops alert pipeline. If you are reading " +
          "this in your inbox, alerts are reaching you again.</p>" +
          `<p style="color:#6b7280;font-size:12px;">Sent ${new Date().toISOString()} from <code>${routing.from}</code>.</p>`,
      });
      if (sent.error) {
        testSend = {
          ok: false,
          error: `${sent.error.name}: ${sent.error.message}`,
        };
      } else {
        const id = sent.data?.id ?? null;
        // Resend reports `queued` for a moment even on a healthy send, so give
        // it a few seconds to settle rather than reporting a false negative.
        let lastEvent: string | null = null;
        for (let attempt = 0; attempt < 6 && id; attempt++) {
          await new Promise((r) => setTimeout(r, 2500));
          const got = await resend.emails.get(id);
          lastEvent = got.data?.last_event ?? lastEvent;
          if (lastEvent && lastEvent !== "queued") break;
        }
        testSend = {
          ok: true,
          id,
          to: routing.recipients,
          lastEvent,
          interpretation:
            lastEvent === "delivered"
              ? "Delivered to the recipient server — alerts are working."
              : lastEvent === "queued"
                ? "Still queued after 15s — the send is not going out."
                : `Resend reports "${lastEvent}".`,
        };
      }
    } catch (err) {
      testSend = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Sending domain verification ────────────────────────────────────────
  let domains: Array<{
    name: string;
    status: string;
    region?: string;
    records?: Array<{ record: string; type: string; status: string }>;
  }> = [];
  let domainsError: string | null = null;
  try {
    const res = await resend.domains.list();
    if (res.error) {
      domainsError = `${res.error.name}: ${res.error.message}`;
    } else {
      domains = (res.data?.data ?? []).map((d) => ({
        name: d.name,
        status: d.status,
        region: d.region,
      }));
    }
  } catch (err) {
    domainsError = err instanceof Error ? err.message : String(err);
  }

  const fromDomainEntry = routing.fromDomain
    ? domains.find(
        (d) => d.name.toLowerCase() === routing.fromDomain!.toLowerCase()
      )
    : undefined;
  const fromDomainVerified = domainsError
    ? null
    : fromDomainEntry
      ? fromDomainEntry.status === "verified"
      : false;

  // ── Recent sends and what actually happened to them ────────────────────
  let recent: Array<{
    id: string;
    created_at: string;
    to: string[];
    subject: string;
    last_event: string;
  }> = [];
  let emailsError: string | null = null;
  try {
    const res = await resend.emails.list({ limit: 100 });
    if (res.error) {
      emailsError = `${res.error.name}: ${res.error.message}`;
    } else {
      recent = (res.data?.data ?? []).map((e) => ({
        id: e.id,
        created_at: e.created_at,
        to: e.to ?? [],
        subject: e.subject,
        last_event: e.last_event,
      }));
    }
  } catch (err) {
    emailsError = err instanceof Error ? err.message : String(err);
  }

  // Alert mail specifically — booking confirmations go to a different list and
  // would dilute the signal we are after.
  const alerts = recent.filter((e) =>
    e.subject?.startsWith("[BookTraverse Alert]")
  );

  const tally = (rows: typeof recent) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.last_event] = (acc[r.last_event] ?? 0) + 1;
      return acc;
    }, {});

  const alertEvents = tally(alerts);
  const anyFailed = alerts.some((a) => FAILED_EVENTS.has(a.last_event));
  const allPending =
    alerts.length > 0 && alerts.every((a) => PENDING_EVENTS.has(a.last_event));

  // ── Turn the raw data into the actual conclusion ───────────────────────
  let verdict: string;
  if (routing.recipients.length === 0) {
    verdict =
      "ALERT_TO_EMAIL resolves to NO recipients — sendAlert() bails before " +
      "calling Resend. Alerts with a hardcoded `to` (orphan sweep) still send.";
  } else if (fromDomainVerified === false) {
    verdict =
      `The sending domain "${routing.fromDomain}" is ` +
      (fromDomainEntry
        ? `"${fromDomainEntry.status}", not verified`
        : "not registered in this Resend account at all") +
      ". Resend accepts the send and then drops it. This is the cause — fix DNS.";
  } else if (anyFailed) {
    verdict =
      "Resend reports bounced/failed alerts — a delivery problem on the " +
      "receiving end (bad address, or the recipient server rejecting us).";
  } else if (allPending) {
    verdict =
      "Every recent alert is still queued at Resend — nothing delivered yet.";
  } else if (alerts.length === 0) {
    verdict =
      "Resend has no record of any [BookTraverse Alert] message. If cooldown " +
      "rows exist for the same window, the sends never reached this account.";
  } else {
    verdict =
      "Resend reports these alerts as DELIVERED to the recipient server. The " +
      "mail is arriving and being filed/filtered on the receiving side — " +
      "check spam/quarantine for the recipients listed here.";
  }

  const healthy =
    routing.recipients.length > 0 &&
    fromDomainVerified === true &&
    !anyFailed &&
    !allPending;

  return applyHealthCacheHeaders(
    NextResponse.json(
      {
        status: healthy ? "ok" : "degraded",
        verdict,
        routing,
        sendingDomain: {
          domain: routing.fromDomain,
          verified: fromDomainVerified,
          entry: fromDomainEntry ?? null,
          allDomains: domains,
          error: domainsError,
        },
        alertDelivery: {
          alertsFound: alerts.length,
          byEvent: alertEvents,
          mostRecent: alerts.slice(0, 15),
          error: emailsError,
        },
        allRecentByEvent: tally(recent),
        testSend,
        checkedAt: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503 }
    )
  );
}
