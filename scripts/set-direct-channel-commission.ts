/**
 * CONSISTENCY FIX (decided 2026-07-01): direct bookings already carry ~10% on the
 * owner side (5% channelCommission + a separate 5% "Service fee" additionalFee),
 * BUT `BE-API` and `Booking Engine` sources are missing the channel-commission 5%
 * that `website` has (they only get the service fee). This adds the SAME 5%
 * channel-commission rule to those sources so all direct sources match.
 *
 * NO rate change to existing sources. Does NOT touch the service fee, PM
 * commission, or OTA integrations. Guest-facing pricing is unaffected (owner-side
 * accounting only).
 *
 *   DRY RUN (default): GET config, print before/after, DO NOT write.
 *   EXECUTE:           npx tsx --env-file=.env.local scripts/set-direct-channel-commission.ts --execute
 *
 * ⚠️ EXECUTE writes account financial settings; it raises the direct take on
 * BE-API/Booking Engine bookings from ~5% to ~10% (parity with website). Requires
 * sign-off.
 */
import { createClient } from "@supabase/supabase-js";

const CC_URL = "https://open-api.guesty.com/v1/channel-commission/account";

// Bring these sources up to parity with the existing `website` channel-commission rule.
const SOURCES_TO_ADD = ["BE-API", "Booking Engine"];
const TEMPLATE_SOURCE = "website"; // copy this rule's value/base exactly

const EXECUTE = process.argv.includes("--execute");

async function getOpenApiToken() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb
    .from("guesty_tokens")
    .select("access_token")
    .eq("token_type", "openapi")
    .single();
  if (error || !data) throw new Error("no openapi token: " + error?.message);
  return data.access_token as string;
}

function fmt(rule: any): string {
  if (!rule?.commission) return "0% (none)";
  return `${rule.commission.value}% of [${(rule.commission.of || []).join(", ")}]`;
}

async function main() {
  const token = await getOpenApiToken();

  const getResp = await fetch(CC_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!getResp.ok) throw new Error(`GET failed: HTTP ${getResp.status} ${await getResp.text()}`);
  const current: any = await getResp.json();
  const currentManual: any[] = Array.isArray(current.manual) ? current.manual : [];
  const bySource = new Map(currentManual.map((r) => [r.source, r]));

  const template = bySource.get(TEMPLATE_SOURCE);
  if (!template?.commission) throw new Error(`no '${TEMPLATE_SOURCE}' rule to copy from`);
  console.log(`Template ('${TEMPLATE_SOURCE}'): ${fmt(template)}\n`);

  const desiredManual = SOURCES_TO_ADD.map((source) => {
    const existing = bySource.get(source);
    return {
      ...(existing?._id ? { _id: existing._id } : {}),
      source,
      commission: { value: template.commission.value, of: [...template.commission.of] },
      tax: template.tax ?? 0,
      isPreDeduct: template.isPreDeduct ?? false,
    };
  });

  console.log("=== CHANNEL COMMISSION: before -> after (only these sources change) ===\n");
  for (const source of SOURCES_TO_ADD) {
    const before = bySource.get(source);
    console.log(`  ${source.padEnd(16)} ${fmt(before).padEnd(20)} ->  ${fmt(desiredManual.find((d) => d.source === source))}${before ? "" : "   (NEW)"}`);
  }
  console.log(`\n  unchanged: website/Website/Email/manual (5%), all OTA integrations, and the separate 5% Service fee.`);

  console.log("\n=== PUT payload that WOULD be sent (upsert by source) ===");
  console.log(JSON.stringify({ manual: desiredManual }, null, 2));

  if (!EXECUTE) {
    console.log("\n🟡 DRY RUN — no write performed. Re-run with --execute to apply (requires sign-off).");
    return;
  }

  console.log("\n🔴 EXECUTING live PUT ...");
  const putResp = await fetch(CC_URL, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ manual: desiredManual }),
  });
  console.log("PUT HTTP", putResp.status);
  console.log((await putResp.text()).slice(0, 3000));
}

main().then(() => process.exit(0));
