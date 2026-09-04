// READ-ONLY: fetch the account-level channel commission config from Guesty
// Open API (GET /v1/channel-commission/account), reusing the cached openapi
// token from Supabase. No writes.
// Run: npx tsx --env-file=.env.local scripts/get-account-channel-commission.ts
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("guesty_tokens")
    .select("access_token, expires_at")
    .eq("token_type", "openapi")
    .single();
  if (error || !data) throw new Error("no openapi token: " + error?.message);

  const resp = await fetch("https://open-api.guesty.com/v1/channel-commission/account", {
    headers: { Authorization: `Bearer ${data.access_token}`, Accept: "application/json" },
  });
  console.log("HTTP", resp.status);
  const body = await resp.text();
  try {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } catch {
    console.log(body.slice(0, 2000));
  }
}

main().then(() => process.exit(0));
