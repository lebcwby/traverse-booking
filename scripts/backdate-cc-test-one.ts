/**
 * GUARDED TEST — apply the retroactive BE-API channel commission to ONE reservation
 * via financial recalculation, and diff the full money object before/after so we can
 * confirm ONLY the channel commission changed (nothing else moved).
 *
 * PUT /v1/reservations-v3/{id}/source { source:"BE-API", applyRecalculation:true }
 * Run: npx tsx --env-file=.env.local scripts/backdate-cc-test-one.ts
 */
import { createClient } from "@supabase/supabase-js";

const RES_ID = "6a25f5f333745ec39a262823"; // GY-88fEDh63, BE-API, 6/12-6/14
const SOURCE = "BE-API";

const FIELDS = [
  "fareAccommodation", "fareAccommodationAdjusted", "fareCleaning", "subTotalPrice",
  "totalTaxes", "totalFees", "hostServiceFee", "commission", "netIncome",
  "ownerRevenue", "hostPayout", "balanceDue", "totalPaid", "totalRefunded", "isFullyPaid",
];

async function token() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("guesty_tokens").select("access_token").eq("token_type", "openapi").single();
  if (error || !data) throw new Error("no openapi token");
  return data.access_token as string;
}

async function getMoney(tok: string) {
  const r = await fetch(`https://open-api.guesty.com/v1/reservations/${RES_ID}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`GET res ${r.status}`);
  const j: any = await r.json();
  return j.money || {};
}

async function main() {
  const tok = await token();

  const before = await getMoney(tok);
  console.log("BEFORE channelCommissionRules:", JSON.stringify(before.channelCommissionRules ?? null));

  const put = await fetch(`https://open-api.guesty.com/v1/reservations-v3/${RES_ID}/source`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ source: SOURCE, applyRecalculation: true }),
  });
  console.log("PUT source recalc HTTP", put.status);
  const putBody = await put.text();
  if (!put.ok) { console.log("PUT body:", putBody.slice(0, 1500)); return; }

  // small settle then re-read
  const after = await getMoney(tok);
  console.log("AFTER channelCommissionRules:", JSON.stringify(after.channelCommissionRules ?? null));

  console.log("\n=== MONEY DIFF (field: before -> after) ===");
  let changedBeyondCommission = false;
  for (const f of FIELDS) {
    const b = before[f], a = after[f];
    const same = JSON.stringify(b) === JSON.stringify(a);
    const flag = same ? "" : "   <-- CHANGED";
    if (!same && !["hostServiceFee", "netIncome", "ownerRevenue", "totalFees"].includes(f)) changedBeyondCommission = true;
    console.log(`  ${f.padEnd(26)} ${String(b).padEnd(12)} -> ${String(a)}${flag}`);
  }
  console.log("\nEXPECTED: hostServiceFee 0 -> ~5% of (accom+cleaning); netIncome/ownerRevenue drop by that; " +
    "accommodation/taxes/totalPaid/balanceDue UNCHANGED.");
  console.log(changedBeyondCommission
    ? "\n🔴 SOMETHING BEYOND COMMISSION CHANGED — do NOT bulk-apply; review."
    : "\n🟢 Only commission-side fields moved — safe to bulk-apply the rest.");
}

main().then(() => process.exit(0));
