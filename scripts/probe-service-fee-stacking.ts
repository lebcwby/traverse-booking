// READ-ONLY: does a distinct "Service fee" (SERVICE additionalFee) actually get
// applied/deducted on direct reservations ALONGSIDE the channel commission?
// Dumps invoiceItems + fee breakdowns for direct (website / BE-API) reservations.
// Run: npx tsx --env-file=.env.local scripts/probe-service-fee-stacking.ts
import { getOpenAPIReservation } from "../src/lib/guesty-openapi";

const RES = [
  { code: "GY-frD7U3Ws", src: "website", id: "6a42ed87eb96522198851773" },
  { code: "GY-bYqMuxuu", src: "BE-API", id: "6a448a7c70e970b2dbc0b67a" },
  { code: "GY-AYMAW5Nj", src: "website", id: "6a428a1efe70adc46073d21e" },
];

function line(i: any) {
  return {
    title: i?.title,
    type: i?.type,
    normalType: i?.normalType,
    amount: i?.amount,
    isDeducted: i?.isDeducted,
    isBundled: i?.isBundled,
  };
}

async function main() {
  for (const r of RES) {
    console.log(`\n===== ${r.code} (${r.src}) =====`);
    const res: any = await getOpenAPIReservation(r.id);
    const m = res?.money || {};
    console.log("fareAccommodation:", m.fareAccommodation, " adjusted:", m.fareAccommodationAdjusted, " cleaning:", m.fareCleaning);
    console.log("hostServiceFee (=channel commission $):", m.hostServiceFee);
    console.log("commission (PM):", m.commission, " totalFees:", m.totalFees, " netIncome:", m.netIncome, " ownerRevenue:", m.ownerRevenue);

    const items = Array.isArray(m.invoiceItems) ? m.invoiceItems : [];
    const feeish = items.filter((i: any) =>
      /SERVICE|FEE|COMMISSION|HOMEOWNERS/i.test(`${i?.type} ${i?.normalType} ${i?.title}`));
    console.log("fee-ish invoiceItems:");
    feeish.forEach((i: any) => console.log("   ", JSON.stringify(line(i))));

    console.log("deductedFees:", JSON.stringify(m.deductedFees ?? null));
    console.log("bundledFees:", JSON.stringify(m.bundledFees ?? null));
    console.log("channelAfBreakdown:", JSON.stringify(m.channelAfBreakdown ?? null));
  }
}

main().then(() => process.exit(0));
