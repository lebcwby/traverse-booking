import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GUESTY_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const BEAPI_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const TOKEN_BUFFER_MS = 60 * 60 * 1000; // Refresh when < 1h remaining
const WARN_BUFFER_MS = 30 * 60 * 1000; // Warn when < 30min remaining (refresh already attempted at 1h)

const ALERT_TO = Deno.env.get("ALERT_TO_EMAIL") ?? "";
const ALERT_FROM =
  Deno.env.get("ALERT_FROM_EMAIL") ?? "Alerts <noreply@example.com>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  // Auth: only pg_cron can call this (passes cron_secret in custom header)
  const cronSecret = req.headers.get("x-cron-secret") || "";
  const expectedSecret = Deno.env.get("CRON_SECRET") || "";
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: Record<string, unknown> = {};

  // ─── OpenAPI Token ──────────────────────────────────────────────
  try {
    results.openapi = await refreshToken(supabase, {
      tokenType: "openapi",
      tokenUrl: GUESTY_TOKEN_URL,
      clientId: Deno.env.get("GUESTY_CLIENT_ID") || "",
      clientSecret: Deno.env.get("GUESTY_CLIENT_SECRET") || "",
      scope: "open-api",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OpenAPI token refresh failed:", msg);
    results.openapi = { error: msg };
    await sendAlert(
      "CRITICAL: OpenAPI Token Refresh Failed",
      `<p>The refresh-tokens cron failed to refresh the OpenAPI token.</p>
       <p><strong>Error:</strong> ${escapeHtml(msg)}</p>
       <p><strong>Impact:</strong> Payment recording, invoice items, and cancellations will fail when the current token expires.</p>
       <p><strong>Next retry:</strong> ~30 minutes (pg_cron)</p>
       <p>If this repeats, check Guesty OAuth credentials in Supabase secrets.</p>`
    );
  }

  // ─── BEAPI Token ────────────────────────────────────────────────
  try {
    results.beapi = await refreshToken(supabase, {
      tokenType: "beapi",
      tokenUrl: BEAPI_TOKEN_URL,
      clientId: Deno.env.get("GUESTY_BEAPI_CLIENT_ID") || "",
      clientSecret: Deno.env.get("GUESTY_BEAPI_CLIENT_SECRET") || "",
      scope: "booking_engine:api",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("BEAPI token refresh failed:", msg);
    results.beapi = { error: msg };
    await sendAlert(
      "CRITICAL: BEAPI Token Refresh Failed",
      `<p>The refresh-tokens cron failed to refresh the BEAPI token.</p>
       <p><strong>Error:</strong> ${escapeHtml(msg)}</p>
       <p><strong>Impact:</strong> Guest search, quotes, and bookings on booktraverse.com will fail when the current token expires.</p>
       <p><strong>Next retry:</strong> ~30 minutes (pg_cron)</p>
       <p>If this repeats, check Guesty BEAPI credentials in Supabase secrets.</p>`
    );
  }

  // ─── Proactive warnings for tokens approaching expiry ───────────
  await checkTokenHealth(supabase, "openapi", "OpenAPI");
  await checkTokenHealth(supabase, "beapi", "BEAPI");

  const anyFailed = Object.values(results).some(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      "error" in (r as Record<string, unknown>)
  );

  return json({ success: !anyFailed, ...results }, anyFailed ? 500 : 200);
});

async function refreshToken(
  supabase: ReturnType<typeof createClient>,
  opts: {
    tokenType: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
  }
): Promise<{ refreshed: boolean; hoursRemaining: number }> {
  if (!opts.clientId || !opts.clientSecret) {
    throw new Error(`Missing credentials for ${opts.tokenType}`);
  }

  // Check if current token is still fresh
  const { data: existing } = await supabase
    .from("guesty_tokens")
    .select("expires_at")
    .eq("token_type", opts.tokenType)
    .single();

  if (existing && existing.expires_at > Date.now() + TOKEN_BUFFER_MS) {
    const hoursLeft =
      Math.round(((existing.expires_at - Date.now()) / 3600000) * 10) / 10;
    return { refreshed: false, hoursRemaining: hoursLeft };
  }

  // Token expired or within buffer — refresh via OAuth
  console.log(`Refreshing ${opts.tokenType} token`);

  const resp = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      scope: opts.scope,
    }),
  });

  if (resp.status === 429) {
    throw new Error(`OAuth rate-limited (429) for ${opts.tokenType}`);
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `OAuth failed for ${opts.tokenType}: ${resp.status} ${errText.slice(0, 200)}`
    );
  }

  const data = await resp.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  const { error: upsertErr } = await supabase.from("guesty_tokens").upsert(
    {
      token_type: opts.tokenType,
      access_token: data.access_token,
      expires_at: expiresAt,
      created_at: Date.now(),
    },
    { onConflict: "token_type" }
  );

  if (upsertErr) {
    throw new Error(
      `Token upsert failed for ${opts.tokenType}: ${upsertErr.message}`
    );
  }

  const hoursLeft = Math.round(((expiresAt - Date.now()) / 3600000) * 10) / 10;
  console.log(`${opts.tokenType} token refreshed — expires in ${hoursLeft}h`);
  return { refreshed: true, hoursRemaining: hoursLeft };
}

async function checkTokenHealth(
  supabase: ReturnType<typeof createClient>,
  tokenType: string,
  label: string
) {
  try {
    const { data } = await supabase
      .from("guesty_tokens")
      .select("expires_at")
      .eq("token_type", tokenType)
      .single();

    if (!data) {
      await sendAlert(
        `CRITICAL: ${label} Token Missing`,
        `<p>No ${label} token row exists in guesty_tokens. All ${label} API calls will fail.</p>
         <p>This requires immediate manual intervention.</p>`
      );
      return;
    }

    const hoursLeft = (data.expires_at - Date.now()) / 3600000;

    if (hoursLeft <= 0) {
      await sendAlert(
        `CRITICAL: ${label} Token Expired`,
        `<p>The ${label} token is <strong>expired</strong>. All ${label} API calls are failing NOW.</p>
         <p>The refresh cron will retry in ~30 minutes. If this alert repeats, check credentials.</p>`
      );
    } else if (hoursLeft < 2) {
      await sendAlert(
        `WARNING: ${label} Token Expiring Soon`,
        `<p>The ${label} token expires in <strong>${Math.round(hoursLeft * 10) / 10} hours</strong>.</p>
         <p>The refresh cron should handle this on its next run. If you see this alert repeatedly, the refresh is failing.</p>`
      );
    }
  } catch {
    // Best effort — don't let health check crash the function
  }
}

async function sendAlert(subject: string, body: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error(`ALERT (no Resend key): ${subject}`);
    return;
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO,
        subject: `[BookTraverse] ${subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px;">
            <h2 style="color: #dc2626;">${subject}</h2>
            ${body}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">
              ${new Date().toISOString()} — book-traverse refresh-tokens cron
            </p>
          </div>
        `,
      }),
    });

    if (!resp.ok) {
      console.error(`Alert email failed: ${resp.status}`);
    } else {
      console.log(`Alert sent: ${subject}`);
    }
  } catch (err) {
    console.error("Failed to send alert:", err);
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
