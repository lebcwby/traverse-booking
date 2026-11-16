import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendAlert } from "@/lib/alerts";
import { rateLimit } from "@/lib/rate-limit";
import { advisoryLocksEffective, getPool, withAdvisoryLock } from "@/lib/db";

export const dynamic = "force-dynamic";

const BEAPI_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const OPENAPI_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

// Refresh when the existing token has less than this much life left.
// Guesty caps OAuth at 5 tokens per 24h per client. Tokens last 24h, so even
// a 6h buffer refreshes about once a day — well under the cap.
//
// This was 2h, which is exactly this cron's own interval, and that left a
// 16-SECOND margin: a token expiring at 00:10:16 still had 2h 0m 16s at the
// 22:10 run, so it was skipped, and only the 00:10 run would refresh it. One
// late or dropped fire — Vercel crons are best-effort — and nothing held a
// valid token until 02:10. The BEAPI outages on 2026-10-08 and 2026-10-09
// both landed in that window, at 01:26 and 01:27.
//
// At 6h this cron gets three attempts before expiry instead of one. Keep it
// in step with TOKEN_BUFFER_MS in src/lib/guesty-beapi.ts, which decides when
// a token is "fresh" — if the two disagree the app can consider a token stale
// that this cron is not yet refreshing.
const REFRESH_BUFFER_MS = 6 * 60 * 60 * 1000;

// Floor for the end-of-refresh health check. A mint that doesn't leave at
// least this much life is treated as still-stale and surfaces as HTTP 500.
const MIN_USABLE_MARGIN_MS = 5 * 60 * 1000;

// How many successful mints we allow in a rolling 24h window per token type.
// Guesty's hard cap is 5; we hold the 5th back for a human to use after an
// incident. In V2 this counts SUCCESSES (rows in token_mint_log), not attempts.
const V2_MINT_LIMIT_PER_24H = 4;

interface RefreshTarget {
  tokenType: "beapi" | "openapi";
  tokenUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  scope: string;
  label: string;
}

/**
 * V2 is gated — Nadim flips BEAPI_MINT_V2=1 in Vercel after the migration
 * is applied and the SHARED_DATABASE_URL_DIRECT is confirmed pointing at the
 * session-mode port (:5432). Off by default so Phase 2 ships safely alongside
 * Phase 1.
 */
function isV2Enabled(): boolean {
  return (process.env.BEAPI_MINT_V2 || "").trim() === "1";
}

export async function GET(request: Request) {
  // Tag every invocation so Vercel runtime logs can distinguish cron fires
  // from manual curl-driven self-heal calls (both hit the same route).
  // Vercel's cron sets a `user-agent: vercel-cron/1.0` header on its
  // scheduled invocations; manual curls won't.
  const userAgent = request.headers.get("user-agent") || "";
  const isVercelCron = userAgent.startsWith("vercel-cron/");
  const triggerSource = isVercelCron ? "vercel-cron" : "manual";
  const v2 = isV2Enabled();
  const startMs = Date.now();
  console.log(
    `[refresh-tokens] start trigger=${triggerSource} v2=${v2} ua=${userAgent.slice(0, 60)}`
  );

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn(
      `[refresh-tokens] UNAUTHORIZED trigger=${triggerSource} (cronSecret set=${!!cronSecret})`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Defensive trim — Vercel env values have been observed to retain
  // trailing literal "\n" or whitespace that silently breaks OAuth
  // client_secret validation (Guesty returns `invalid_client` with no
  // hint that whitespace is the problem). Same pattern stripe.ts uses
  // for STRIPE_SECRET_KEY.
  const trimEnv = (v: string | undefined) => (v || "").trim();

  const targets: RefreshTarget[] = [
    {
      tokenType: "beapi",
      tokenUrl: BEAPI_TOKEN_URL,
      clientId: trimEnv(process.env.GUESTY_BEAPI_CLIENT_ID),
      clientSecret: trimEnv(process.env.GUESTY_BEAPI_CLIENT_SECRET),
      scope: "booking_engine:api",
      label: "BEAPI",
    },
    {
      tokenType: "openapi",
      tokenUrl: OPENAPI_TOKEN_URL,
      clientId: trimEnv(process.env.GUESTY_CLIENT_ID),
      clientSecret: trimEnv(process.env.GUESTY_CLIENT_SECRET),
      scope: "open-api",
      label: "OpenAPI",
    },
  ];

  const results: Record<string, unknown> = {};

  for (const target of targets) {
    if (!target.clientId || !target.clientSecret) {
      console.warn(
        `[refresh-tokens] ${target.label} SKIPPED missing credentials (clientId=${!!target.clientId}, clientSecret=${!!target.clientSecret})`
      );
      results[target.tokenType] = { skipped: "missing credentials" };
      continue;
    }
    try {
      const beforeMs = Date.now();
      results[target.tokenType] = v2
        ? await refreshOneV2(supabase, target, triggerSource)
        : await refreshOneV1(supabase, target);
      const r = results[target.tokenType] as {
        refreshed: boolean;
        hoursRemaining: number;
      };
      console.log(
        `[refresh-tokens] ${target.label} ok v2=${v2} refreshed=${r.refreshed} hoursLeft=${r.hoursRemaining} elapsedMs=${Date.now() - beforeMs}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[refresh-tokens] ${target.label} FAILED v2=${v2} trigger=${triggerSource}:`,
        msg
      );
      results[target.tokenType] = { error: msg };

      // Skip the email alert for the well-known "wrong-creds" 401 the
      // OpenAPI side hits while GUESTY_CLIENT_ID/SECRET in Vercel are
      // still BEAPI-class instead of OpenAPI-class. Per CLAUDE.md this
      // is a known gap (the OpenAPI surface isn't used by the public
      // booking flow — only admin endpoints) and alerting once per
      // cron fire generates ~24 emails/day with no actionable signal.
      // The error stays in runtime logs for diagnosis.
      const isKnownWrongCreds =
        target.tokenType === "openapi" &&
        /use booking\.guesty\.com|UNAUTHO/i.test(msg);
      if (!isKnownWrongCreds) {
        // BEAPI failures ride the shared incident key so one BEAPI incident
        // produces one email thread (token-unavailable + mirror + refresh-
        // fail + mint-budget are facets of the same thing). OpenAPI keeps a
        // per-type key since it has no mirror/self-heal path to collapse.
        const alertKey =
          target.tokenType === "beapi"
            ? "beapi-health-incident"
            : `cron-${target.tokenType}-refresh-fail`;
        await sendAlert(
          `CRITICAL: ${target.label} Token Refresh Failed`,
          `<p>The refresh-tokens cron failed to refresh the ${target.label} token.</p>
           <p><strong>Trigger:</strong> ${escapeHtml(triggerSource)}</p>
           <p><strong>Error:</strong> ${escapeHtml(msg)}</p>
           <p>Next retry follows the cron schedule. If this repeats, check Guesty OAuth credentials.</p>`,
          alertKey
        );
      }
    }
  }

  const anyFailed = Object.values(results).some(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      "error" in (r as Record<string, unknown>)
  );

  console.log(
    `[refresh-tokens] done trigger=${triggerSource} v2=${v2} success=${!anyFailed} totalMs=${Date.now() - startMs}`
  );

  return NextResponse.json(
    { success: !anyFailed, v2, ...results },
    { status: anyFailed ? 500 : 200 }
  );
}

// ─── V1 (legacy) ─────────────────────────────────────────────────────────
//
// Kept intact so a bad V2 flip is one env var away from reverting. The known
// hazard is documented in V2 below: this path's rateLimit counter increments
// before the OAuth call, so a 429 burns budget without producing a token.

async function refreshOneV1(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  target: RefreshTarget
): Promise<{ refreshed: boolean; hoursRemaining: number }> {
  const { data: existing } = await supabase
    .from("guesty_tokens")
    .select("expires_at")
    .eq("token_type", target.tokenType)
    .single();

  if (existing && existing.expires_at > Date.now() + REFRESH_BUFFER_MS) {
    const hoursLeft =
      Math.round(((existing.expires_at - Date.now()) / 3600000) * 10) / 10;
    return { refreshed: false, hoursRemaining: hoursLeft };
  }

  const budget = await rateLimit(`guesty-token-mint:${target.tokenType}`, {
    limit: 4,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!budget.allowed) {
    const msg =
      `Refused to mint a ${target.label} token: 4 mints already used in the ` +
      `last 24h and Guesty allows only 5. Something is calling this route in ` +
      `a loop — check the self-heal path in guesty-beapi.ts and Vercel logs. ` +
      `One mint is deliberately held back for manual recovery.`;
    console.error(`[refresh-tokens] ${msg}`);
    const budgetAlertKey =
      target.tokenType === "beapi"
        ? "beapi-health-incident"
        : `token-mint-budget-${target.tokenType}`;
    await sendAlert(
      `CRITICAL: ${target.label} token mint budget exhausted`,
      `<p>${msg}</p><p>The token will expire and API calls will start failing. ` +
        `Fix the caller before minting by hand, or the 5th mint is spent too ` +
        `and the client is locked out for 24 hours.</p>`,
      budgetAlertKey
    );
    throw new Error(`Mint budget exhausted for ${target.tokenType}`);
  }

  const { expiresAt } = await performOAuthAndUpsert(supabase, target);
  const hoursLeft = Math.round(((expiresAt - Date.now()) / 3600000) * 10) / 10;
  return { refreshed: true, hoursRemaining: hoursLeft };
}

// ─── V2 — the actual fix (flag-gated) ────────────────────────────────────
//
// Three guarantees V1 couldn't give:
//
//   1. ONE mint at a time per token type, across every Vercel instance,
//      via pg_advisory_lock on the direct (session-mode) connection. The
//      per-instance throttle in attemptTokenSelfHeal was never cross-
//      instance — four concurrent cold starts could all stampede. The
//      advisory lock serialises them; after this, you can still see four
//      concurrent self-heals, but only one of them hits Guesty.
//
//   2. Only SUCCESSFUL mints count against the local budget. V1 counted
//      attempts via check_rate_limit, so an OAuth 429 (or network blip)
//      burned budget without producing a token. V2 writes to token_mint_log
//      AFTER a successful upsert, then enforces the 24h window with a
//      SELECT COUNT(*). Semantically matches Guesty's own quota and makes a
//      429 free of charge from our end.
//
//   3. End-of-refresh verification. V1 could return `{refreshed: true}` on
//      a mint whose upsert raced a stale read somewhere and left the row
//      effectively unchanged. V2 re-reads guesty_tokens after the lock
//      releases and throws (HTTP 500) if the row isn't above
//      MIN_USABLE_MARGIN_MS. The cron never returns 200 on a stale table.

async function refreshOneV2(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  target: RefreshTarget,
  triggerSource: string
): Promise<{ refreshed: boolean; hoursRemaining: number }> {
  // Hard assert: the lock has to be real. On the Supabase transaction pooler
  // (:6543) pg_advisory_lock silently does nothing — withAdvisoryLock would
  // warn and still run the function, which quietly reverts V2 to V1's
  // concurrency guarantees without changing the branch. Refuse to run.
  if (!advisoryLocksEffective()) {
    throw new Error(
      "BEAPI_MINT_V2 refuses to run: advisory locks are INEFFECTIVE on this " +
        "connection. SHARED_DATABASE_URL_DIRECT must point at the session-mode " +
        "URL (port 5432), not the transaction pooler (:6543). See " +
        "src/lib/db.ts::advisoryLocksEffective and /api/health/db."
    );
  }

  const outcome = await withAdvisoryLock(
    `guesty-mint:${target.tokenType}`,
    async () => {
      // Re-read inside the lock. If another instance minted while we were
      // waiting on pg_advisory_lock, the fresh row is already here and we
      // skip the mint entirely — the "load the saved token on cold start"
      // guarantee. Also handles the cold-start case where a long-warm peer
      // has a valid row that this instance hasn't seen yet.
      const { data: fresh } = await supabase
        .from("guesty_tokens")
        .select("expires_at")
        .eq("token_type", target.tokenType)
        .single();
      if (fresh && fresh.expires_at > Date.now() + REFRESH_BUFFER_MS) {
        const hoursLeft =
          Math.round(((fresh.expires_at - Date.now()) / 3600000) * 10) / 10;
        return { refreshed: false, hoursRemaining: hoursLeft };
      }

      await enforceSuccessfulMintBudget(target);
      const { expiresAt } = await performOAuthAndUpsert(supabase, target);
      await logSuccessfulMint(target, expiresAt, triggerSource);
      const hoursLeft =
        Math.round(((expiresAt - Date.now()) / 3600000) * 10) / 10;
      return { refreshed: true, hoursRemaining: hoursLeft };
    }
  );

  // End-of-refresh verification, AFTER the lock. The lock holder may have
  // decided `refreshed: false` (someone else minted); either way the row
  // must now be fresh. If it isn't, something between the lock-local view
  // and the authoritative table is broken — don't let the cron claim
  // success on a stale row.
  const { data: verify } = await supabase
    .from("guesty_tokens")
    .select("expires_at")
    .eq("token_type", target.tokenType)
    .single();
  const expiresAt = verify?.expires_at ?? 0;
  const margin = expiresAt - Date.now();
  if (margin < MIN_USABLE_MARGIN_MS) {
    throw new Error(
      `End-of-refresh check failed for ${target.tokenType}: ` +
        `row expires in ${Math.round(margin / 1000)}s (min ${
          MIN_USABLE_MARGIN_MS / 1000
        }s). The cron is NOT returning HTTP 200 on a stale table.`
    );
  }

  return outcome;
}

async function enforceSuccessfulMintBudget(target: RefreshTarget) {
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    `select count(*)::text as count
       from public.token_mint_log
      where token_type = $1
        and minted_at > now() - interval '24 hours'`,
    [target.tokenType]
  );
  const count = Number(rows[0]?.count ?? "0");
  if (count >= V2_MINT_LIMIT_PER_24H) {
    const msg =
      `Refused to mint a ${target.label} token: ${count} SUCCESSFUL mints ` +
      `in the last 24h and Guesty allows 5 total. Something is calling this ` +
      `route in a loop — check self-heal in guesty-beapi.ts and Vercel logs. ` +
      `One mint is deliberately held back for manual recovery.`;
    console.error(`[refresh-tokens] ${msg}`);
    const budgetAlertKey =
      target.tokenType === "beapi"
        ? "beapi-health-incident"
        : `token-mint-budget-${target.tokenType}`;
    await sendAlert(
      `CRITICAL: ${target.label} token mint budget exhausted`,
      `<p>${msg}</p><p>The token will expire and API calls will start failing. ` +
        `Fix the caller before minting by hand, or the 5th mint is spent too ` +
        `and the client is locked out for 24 hours.</p>`,
      budgetAlertKey
    );
    throw new Error(`Mint budget exhausted for ${target.tokenType}`);
  }
}

async function logSuccessfulMint(
  target: RefreshTarget,
  expiresAtEpochMs: number,
  triggerSource: string
) {
  try {
    const pool = getPool();
    await pool.query(
      `insert into public.token_mint_log (token_type, expires_at, source)
       values ($1, to_timestamp($2::double precision / 1000), $3)`,
      [target.tokenType, expiresAtEpochMs, triggerSource]
    );
  } catch (err) {
    // A log failure cannot roll back a successful mint, and the Supabase
    // guesty_tokens row IS the authoritative token. The 24h budget check
    // overreads by one in that case, which is strictly safer than
    // overwriting with a lost mint.
    console.error(
      `[refresh-tokens] token_mint_log insert failed for ${target.tokenType}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ─── Shared OAuth + upsert ───────────────────────────────────────────────

async function performOAuthAndUpsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  target: RefreshTarget
): Promise<{ expiresAt: number }> {
  const resp = await fetch(target.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: target.clientId!,
      client_secret: target.clientSecret!,
      scope: target.scope,
    }),
  });

  if (resp.status === 429) {
    // In V2 the caller hasn't yet written to token_mint_log, so this 429
    // costs nothing against the budget. That is the V2 point.
    throw new Error(`OAuth rate-limited (429) for ${target.tokenType}`);
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `OAuth failed for ${target.tokenType}: ${resp.status} ${errText.slice(0, 200)}`
    );
  }

  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token || !data.expires_in) {
    throw new Error(
      `OAuth response missing access_token or expires_in for ${target.tokenType}`
    );
  }

  const expiresAt = Date.now() + data.expires_in * 1000;

  const { error: upsertErr } = await supabase.from("guesty_tokens").upsert(
    {
      token_type: target.tokenType,
      access_token: data.access_token,
      expires_at: expiresAt,
      created_at: Date.now(),
    },
    { onConflict: "token_type" }
  );

  if (upsertErr) {
    throw new Error(
      `Token upsert failed for ${target.tokenType}: ${upsertErr.message}`
    );
  }

  return { expiresAt };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
