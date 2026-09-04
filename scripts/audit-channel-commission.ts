// READ-ONLY audit: current channel-commission / PM-commission / service-fee
// config across the whole portfolio, so we can safely reconfigure the direct
// channel commission 5% -> 10%.
// Run: npx tsx --env-file=.env.local scripts/audit-channel-commission.ts
import { getOpenAPIListingsPage } from "../src/lib/guesty-openapi";

const FIELDS =
  "_id nickname title active commissionFormula useAccountRevenueShare financials.channelCommission financials.additionalFees";

type Row = {
  nick: string;
  active: boolean;
  pmFormula: string;
  ccUsesAccount: boolean | null;
  ccManualCount: number;
  ccSummary: string;
  serviceFeePct: string; // any SERVICE-type additional fee %, by source coverage
};

function summarizeCC(cc: any): { usesAccount: boolean | null; manualCount: number; summary: string } {
  if (!cc) return { usesAccount: null, manualCount: 0, summary: "none" };
  const manual = Array.isArray(cc.manual) ? cc.manual : [];
  const parts = manual.map((r: any) => {
    const v = r?.commission?.value;
    const src = r?.source ?? "(any)";
    return `${v}%@${src}`;
  });
  return {
    usesAccount: cc.useAccountSettings ?? null,
    manualCount: manual.length,
    summary: parts.length ? parts.join(",") : "acct-default",
  };
}

function summarizeServiceFees(fees: any): string {
  if (!Array.isArray(fees)) return "-";
  const svc = fees.filter((f: any) => f?.type === "SERVICE");
  if (!svc.length) return "-";
  return svc
    .map((f: any) => `${f.value}${f.isPercentage ? "%" : "$"}${f.isDeducted ? "(ded)" : ""}`)
    .join(",");
}

async function main() {
  const rows: Row[] = [];
  let skip = 0;
  const limit = 100;
  for (let page = 0; page < 5; page++) {
    const resp: any = await getOpenAPIListingsPage({ fields: FIELDS, limit, skip });
    const results: any[] = resp?.results ?? resp?.data ?? [];
    if (!results.length) break;
    for (const l of results) {
      const cc = summarizeCC(l?.financials?.channelCommission);
      rows.push({
        nick: l.nickname || l.title || l._id,
        active: !!l.active,
        pmFormula: l.commissionFormula || "-",
        ccUsesAccount: cc.usesAccount,
        ccManualCount: cc.manualCount,
        ccSummary: cc.summary,
        serviceFeePct: summarizeServiceFees(l?.financials?.additionalFees),
      });
    }
    skip += limit;
    if (results.length < limit) break;
  }

  // Aggregate
  const total = rows.length;
  const byPm = new Map<string, number>();
  const byCc = new Map<string, number>();
  const bySvc = new Map<string, number>();
  let usesAccountCC = 0, ownListingCC = 0;
  for (const r of rows) {
    byPm.set(r.pmFormula, (byPm.get(r.pmFormula) || 0) + 1);
    byCc.set(r.ccSummary, (byCc.get(r.ccSummary) || 0) + 1);
    bySvc.set(r.serviceFeePct, (bySvc.get(r.serviceFeePct) || 0) + 1);
    if (r.ccUsesAccount === true) usesAccountCC++;
    else if (r.ccUsesAccount === false) ownListingCC++;
  }
  console.log(`TOTAL LISTINGS: ${total}`);
  console.log(`\nchannelCommission.useAccountSettings: true=${usesAccountCC}  false(own)=${ownListingCC}`);
  console.log(`\nPM commissionFormula distribution:`);
  [...byPm.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)}  ${k}`));
  console.log(`\nchannelCommission (listing-level manual) distribution:`);
  [...byCc.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)}  ${k}`));
  console.log(`\nSERVICE additional-fee distribution:`);
  [...bySvc.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(4)}  ${k}`));

  console.log(`\n--- listings with listing-level (own) channel commission overrides ---`);
  rows.filter((r) => r.ccUsesAccount === false).slice(0, 40).forEach((r) =>
    console.log(`  ${r.nick}: cc=${r.ccSummary} pm=${r.pmFormula} svc=${r.serviceFeePct}`));
}

main().then(() => process.exit(0));
