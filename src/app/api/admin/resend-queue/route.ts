// /api/admin/resend-queue — TEMPORARY. Delete once the queue is cleared.
//
// Between 2026-05-01 and 2026-10-06 every "New Direct Booking" email was
// addressed to the two people who authored the template this site was
// scaffolded from, and sent from an unverified domain. Resend accepted each
// one with a 200 and parked it in `queued`. Those messages carry guest name,
// email, phone, stay dates, amount paid and our year-over-year nightly rate
// table, and they are still sitting in the account.
//
// This exists only because RESEND_API_KEY lives in production and nowhere
// else — `vercel env pull` returns empty for sensitive vars — so the queue
// cannot be inspected or cleared from a laptop.
//
// Safety rules, deliberately narrow:
//   - CRON_SECRET required.
//   - `scan` is the default and is strictly read-only.
//   - `cancel` touches ONLY messages that are BOTH still `queued` AND
//     addressed to one of TEMPLATE_RECIPIENTS. Anything delivered, sent, or
//     addressed to a Traverse inbox is never passed to cancel().
//   - `cancel` additionally requires confirm=yes, so a stray GET cannot fire
//     it.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  applyHealthCacheHeaders,
  isHealthRequestAuthorized,
} from "@/lib/health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The template authors. The only addresses this route will ever cancel for. */
const TEMPLATE_RECIPIENTS = [
  "hayden.laverty@gmail.com",
  "wyatt@mossdigitalstrategies.com",
];

/** Anything not delivered is a candidate for inspection. */
const TERMINAL_OK = new Set(["delivered", "opened", "clicked"]);

type Row = {
  id: string;
  created_at: string;
  from: string;
  to: string[];
  subject: string;
  last_event: string;
};

function isTemplateRecipient(to: string[] | null | undefined): boolean {
  return (to ?? []).some((addr) =>
    TEMPLATE_RECIPIENTS.includes(addr.trim().toLowerCase())
  );
}

export async function GET(request: Request) {
  if (!isHealthRequestAuthorized(request)) {
    return applyHealthCacheHeaders(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    );
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return applyHealthCacheHeaders(
      NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 503 })
    );
  }
  const resend = new Resend(apiKey);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "scan";
  const maxPages = Math.min(
    Math.max(Number(url.searchParams.get("pages") ?? 30), 1),
    60
  );

  // ── Page the whole mailbox ──────────────────────────────────────────────
  const rows: Row[] = [];
  let after: string | undefined;
  let pages = 0;
  let listError: string | null = null;

  while (pages < maxPages) {
    const res = await resend.emails.list(
      (after ? { limit: 100, after } : { limit: 100 }) as never
    );
    if (res.error) {
      listError = `${res.error.name}: ${res.error.message}`;
      break;
    }
    const data = res.data?.data ?? [];
    for (const e of data) {
      rows.push({
        id: e.id,
        created_at: e.created_at,
        from: e.from,
        to: e.to ?? [],
        subject: e.subject,
        last_event: e.last_event,
      });
    }
    pages += 1;
    if (!res.data?.has_more || data.length === 0) break;
    after = data[data.length - 1]?.id;
    if (!after) break;
  }

  const notDelivered = rows.filter((r) => !TERMINAL_OK.has(r.last_event));
  const queued = notDelivered.filter((r) => r.last_event === "queued");
  const queuedToTemplate = queued.filter((r) => isTemplateRecipient(r.to));
  const queuedToOthers = queued.filter((r) => !isTemplateRecipient(r.to));

  const tally = (rs: Row[]) =>
    rs.reduce<Record<string, number>>((a, r) => {
      a[r.last_event] = (a[r.last_event] ?? 0) + 1;
      return a;
    }, {});

  const summary = {
    scanned: rows.length,
    pages,
    listError,
    byEvent: tally(rows),
    queuedTotal: queued.length,
    queuedToTemplateAuthors: queuedToTemplate.length,
    queuedToOthers: queuedToOthers.length,
    oldestQueued: queued.at(-1)?.created_at ?? null,
    newestQueued: queued[0]?.created_at ?? null,
    sendersOfQueued: Array.from(new Set(queued.map((r) => r.from))),
    subjectsOfQueuedToTemplate: Array.from(
      new Set(queuedToTemplate.map((r) => r.subject.replace(/—.*$/, "— …")))
    ).slice(0, 10),
    // Shown so a human can eyeball what would NOT be touched.
    sampleQueuedToOthers: queuedToOthers.slice(0, 5).map((r) => ({
      to: r.to,
      subject: r.subject,
      created_at: r.created_at,
    })),
  };

  if (action === "scan") {
    return applyHealthCacheHeaders(
      NextResponse.json({ action: "scan", ...summary }, { status: 200 })
    );
  }

  if (action !== "cancel") {
    return applyHealthCacheHeaders(
      NextResponse.json(
        { error: "action must be scan or cancel" },
        { status: 400 }
      )
    );
  }

  if (url.searchParams.get("confirm") !== "yes") {
    return applyHealthCacheHeaders(
      NextResponse.json(
        {
          error: "cancel requires confirm=yes",
          wouldCancel: queuedToTemplate.length,
        },
        { status: 400 }
      )
    );
  }

  // ── Cancel, one at a time, only the narrowed set ────────────────────────
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("max") ?? 200), 1),
    500
  );
  const targets = queuedToTemplate.slice(0, limit);
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];

  for (const row of targets) {
    // Belt and braces: re-assert both conditions immediately before acting.
    if (row.last_event !== "queued" || !isTemplateRecipient(row.to)) {
      results.push({
        id: row.id,
        ok: false,
        detail: "skipped — failed re-check",
      });
      continue;
    }
    try {
      const res = await resend.emails.cancel(row.id);
      results.push(
        res.error
          ? {
              id: row.id,
              ok: false,
              detail: `${res.error.name}: ${res.error.message}`,
            }
          : { id: row.id, ok: true }
      );
    } catch (err) {
      results.push({
        id: row.id,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const cancelled = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return applyHealthCacheHeaders(
    NextResponse.json(
      {
        action: "cancel",
        attempted: results.length,
        cancelled,
        failedCount: failed.length,
        remainingAfterThisRun: Math.max(queuedToTemplate.length - cancelled, 0),
        failureReasons: Array.from(
          new Set(failed.map((f) => f.detail ?? "unknown"))
        ).slice(0, 5),
        ...summary,
      },
      { status: 200 }
    )
  );
}
