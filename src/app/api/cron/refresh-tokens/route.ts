import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const BEAPI_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const OPENAPI_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";

// Refresh when the existing token has less than this much life left.
// Guesty caps OAuth at 5 tokens per 24h per client. Tokens last 24h, so a 2h
// buffer means we refresh ~once per ~22h — well under the cap.
const REFRESH_BUFFER_MS = 2 * 60 * 60 * 1000;

interface RefreshTarget {
  tokenType: "beapi" | "openapi";
  tokenUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  scope: string;
  label: string;
}

export async function GET(request: Request) {
  // Tag every invocation so Vercel runtime logs can distinguish cron fires
  // from manual curl-driven self-heal calls (both hit the same route).
  // Vercel's cron sets a `user-agent: vercel-cron/1.0` header on its
  // scheduled invocations; manual curls won't.
  const userAgent = request.headers.get("user-agent") || "";
  const isVercelCron = userAgent.startsWith("vercel-cron/");
  const triggerSource = isVercelCron ? "vercel-cron" : "manual";
  const startMs = Date.now();
  console.log(
    `[refresh-tokens] start trigger=${triggerSource} ua=${userAgent.slice(0, 60)}`
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
      results[target.tokenType] = await refreshOne(supabase, target);
      const r = results[target.tokenType] as {
        refreshed: boolean;
        hoursRemaining: number;
      };
      console.log(
        `[refresh-tokens] ${target.label} ok refreshed=${r.refreshed} hoursLeft=${r.hoursRemaining} elapsedMs=${Date.now() - beforeMs}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[refresh-tokens] ${target.label} FAILED trigger=${triggerSource}:`,
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
        await sendAlert(
          `CRITICAL: ${target.label} Token Refresh Failed`,
          `<p>The refresh-tokens cron failed to refresh the ${target.label} token.</p>
           <p><strong>Trigger:</strong> ${escapeHtml(triggerSource)}</p>
           <p><strong>Error:</strong> ${escapeHtml(msg)}</p>
           <p>Next retry follows the cron schedule. If this repeats, check Guesty OAuth credentials.</p>`,
          `cron-${target.tokenType}-refresh-fail`
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
    `[refresh-tokens] done trigger=${triggerSource} success=${!anyFailed} totalMs=${Date.now() - startMs}`
  );

  return NextResponse.json(
    { success: !anyFailed, ...results },
    { status: anyFailed ? 500 : 200 }
  );
}

async function refreshOne(
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

  const hoursLeft = Math.round(((expiresAt - Date.now()) / 3600000) * 10) / 10;
  return { refreshed: true, hoursRemaining: hoursLeft };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
