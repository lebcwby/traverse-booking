// READ-ONLY probe: inspect Guesty Open API money/commission model on direct
// (website / BE-API) reservations + a listing's financial/accounting config, to
// determine how a 10% direct-channel PM commission could be represented.
// Run: npx tsx --env-file=.env.local scripts/probe-commission-model.ts
import { getOpenAPIReservation, getOpenAPIListing } from "../src/lib/guesty-openapi";

const RES = [
  { code: "GY-frD7U3Ws", src: "website", id: "6a42ed87eb96522198851773" },
  { code: "GY-bYqMuxuu", src: "BE-API", id: "6a448a7c70e970b2dbc0b67a" },
];
const LISTING_ID = "6864abd059a1ae000e240e43";

function pick(obj: any, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

async function main() {
  for (const r of RES) {
    console.log(`\n===== RESERVATION ${r.code} (${r.src}) =====`);
    try {
      const res: any = await getOpenAPIReservation(r.id);
      console.log("top-level keys:", Object.keys(res || {}).join(", "));
      console.log("source/integration:", pick(res, ["source", "channel", "platform", "integrationId"]));
      const m = res?.money || {};
      console.log("accounting chain:", pick(m, [
        "fareAccommodation", "fareAccommodationAdjusted", "fareCleaning",
        "subTotalPrice", "hostPayout", "totalFees", "totalTaxes",
        "commission", "commissionFormula", "commissionTax", "commissionIncTax",
        "netIncome", "netIncomeFormula",
        "ownerRevenue", "ownerRevenueFormula",
        "useAccountRevenueShare", "hostServiceFee",
      ]));
      console.log("channelCommissionRules:", JSON.stringify(m.channelCommissionRules ?? null));
      console.log("settingsSnapshot:", JSON.stringify(m.settingsSnapshot ?? null));
      console.log("res.accounting:", JSON.stringify(res?.accounting ?? null));
    } catch (e: any) {
      console.log("ERR:", e?.message || e);
    }
  }

  console.log(`\n===== LISTING ${LISTING_ID} financial/accounting config =====`);
  try {
    const l: any = await getOpenAPIListing(LISTING_ID);
    console.log("top-level keys:", Object.keys(l || {}).join(", "));
    console.log("financials:", JSON.stringify(l?.financials ?? null, null, 2));
    console.log("accounting:", JSON.stringify(l?.accounting ?? null, null, 2));
    console.log("commission fields:", pick(l, ["pmCommission", "commission", "commissionFee", "ownersRevenueFormula"]));
    if (l?.terms) console.log("terms:", JSON.stringify(l.terms, null, 2));
  } catch (e: any) {
    console.log("ERR:", e?.message || e);
  }
}

main().then(() => process.exit(0));
