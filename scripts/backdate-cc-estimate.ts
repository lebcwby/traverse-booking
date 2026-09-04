/**
 * READ-ONLY: compute the retroactive 5% channel commission that WOULD apply to each
 * confirmed BE-API June-check-in reservation (base = adjusted accommodation +
 * cleaning, matching the existing `website` rule). Prints a per-reservation table +
 * total. No writes.
 * Run: npx tsx --env-file=.env.local scripts/backdate-cc-estimate.ts
 */
import { createClient } from "@supabase/supabase-js";

const RATE = 0.05;
const RES: Array<[string, string]> = [
  ["GY-CvXxRDxw", "6a1d03d246a5a8f5c9ea28ce"], // double-charge/chargeback — HANDLE MANUALLY
  ["GY-LSKWAKHc", "6a2594e0c4faeff873f9f283"],
  ["GY-7L6gnYhX", "6a28478ac09e5e53c814a588"],
  ["GY-4gL7dtvK", "6a20f34a7885f80b0d1110c3"],
  ["GY-88fEDh63", "6a25f5f333745ec39a262823"],
  ["GY-hixAjk6a", "6a1c31ed0d87a98f430a0456"],
  ["GY-pWQneNZC", "6a1b67a90d87a98f43fb91cd"],
  ["GY-SDpPqYnC", "6a32ebed30655dbe818021c9"],
  ["GY-kipRQPJf", "6a1f064c86f1f37aac681530"],
  ["GY-JTN4hKH6", "6a2f76a467586c796b7f693a"],
  ["GY-Wd9hqXCr", "6a278132e120a17d4264425f"],
  ["GY-dmwm6uVF", "6a1202674df8c7a303582b99"],
  ["GY-KMNTBjqM", "6a1cb0befd0b7c3498100ba7"],
  ["GY-SPEnu2wn", "6a24893533745ec39a09312f"],
  ["GY-Qx4jy9bF", "6a3361c45b747102fce8c0ab"],
  ["GY-JjuEVUKf", "6a332beebd1e237b9dd7df1f"],
  ["GY-wgKewVZ7", "6a3865fe76601323a0f11845"],
  ["GY-PTKi3knH", "6a3b13a58d14477f14d90252"],
  ["GY-VsCAVB5c", "6a13156bdf7e119fc6356223"],
  ["GY-VB59xbzf", "6a37f3ab96d730b9dd00e4f1"],
  ["GY-irgcVv2v", "6a389303a6f279f3c2710712"],
  ["GY-BAJcnR8R", "6a3b349086a13a71cf3a43c1"],
  ["GY-gR8HZE8S", "6a233382c4faeff873cc4fb6"],
  ["GY-iiRhLLQa", "6a3db5b84244a9cd0d19e7be"],
  ["GY-TbZCSesp", "6a2a2e70ceb9d4f0984cd41b"],
];

async function token() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("guesty_tokens").select("access_token").eq("token_type", "openapi").single();
  return data!.access_token as string;
}

async function main() {
  const tok = await token();
  let total = 0;
  console.log("code          adjAccom   cleaning   base      5% comm   existingHostSvcFee");
  for (const [code, id] of RES) {
    const r = await fetch(`https://open-api.guesty.com/v1/reservations/${id}`, {
      headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
    });
    if (!r.ok) { console.log(`${code}  ERR ${r.status}`); continue; }
    const m: any = (await r.json()).money || {};
    const adj = Number(m.fareAccommodationAdjusted || 0);
    const clean = Number(m.fareCleaning || 0);
    const base = adj + clean;
    const comm = Math.round(base * RATE * 100) / 100;
    total += comm;
    console.log(
      `${code}  ${adj.toFixed(2).padStart(8)}  ${clean.toFixed(2).padStart(8)}  ${base.toFixed(2).padStart(8)}  ${comm.toFixed(2).padStart(7)}   ${String(m.hostServiceFee ?? 0)}`
    );
  }
  console.log(`\nTOTAL retroactive 5% channel commission across ${RES.length} reservations: $${total.toFixed(2)}`);
  console.log("(GY-CvXxRDxw included in total but flagged — exclude/handle manually given its chargeback.)");
}

main().then(() => process.exit(0));
