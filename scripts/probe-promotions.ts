// READ-ONLY: do the Guesty "Online Booking solutions" promotions (Early-bird / Last-minute)
// pull through into BE-API quotes? Create quotes for a far-out window (early-bird eligible,
// >30d) and a near window (last-minute eligible, <29d) and inspect discount/promotion fields.
// Run: npx tsx --env-file=.env.local scripts/probe-promotions.ts
import { getListingCalendar, createQuote } from "../src/lib/guesty-beapi";

const LISTINGS: Array<[string, string]> = [
  ["CB:GL107:Nadim", "6744cc2707c0f70010a52101"],
  ["CB:GL115:Olsen", "624f3c910e1cbe00339a43c9"],
];

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

// find an available check-in ~targetDaysOut, with `nights` consecutive available days
function findWindow(cal: any[], targetDaysOut: number, nights: number) {
  const byDate = new Map(cal.map((d) => [d.date, d]));
  const today = new Date();
  for (let off = 0; off < 90; off++) {
    for (const delta of [off, -off]) {
      const ci = addDays(today, targetDaysOut + delta);
      let ok = true;
      for (let i = 0; i < nights; i++) {
        const d = byDate.get(ymd(addDays(ci, i)));
        if (!d || d.status !== "available") { ok = false; break; }
      }
      const first = byDate.get(ymd(ci));
      if (ok && first && !first.cta) return { checkIn: ymd(ci), checkOut: ymd(addDays(ci, nights)), nights };
    }
  }
  return null;
}

async function dumpQuote(label: string, listingId: string, w: any) {
  if (!w) { console.log(`  ${label}: no available window found`); return; }
  try {
    const q: any = await createQuote({ listingId, checkIn: w.checkIn, checkOut: w.checkOut, guestsCount: 2 });
    const rp = q?.rates?.ratePlans?.[0];
    const m = rp?.ratePlan?.money || {};
    const promos = q?.promotions ?? q?.promotion ?? rp?.ratePlan?.promotions ?? m?.promotions ?? null;
    const items = Array.isArray(m.invoiceItems) ? m.invoiceItems : [];
    const promoItems = items.filter((i: any) =>
      /promo|early|last|minute|discount|EB|LMD/i.test(`${i?.title} ${i?.type} ${i?.normalType}`));
    console.log(`  ${label}  ${w.checkIn}->${w.checkOut} (${w.nights}n)`);
    console.log(`     fareAccommodation      : ${m.fareAccommodation}`);
    console.log(`     fareAccommodationDiscount: ${m.fareAccommodationDiscount}`);
    console.log(`     fareAccommodationAdjustment: ${m.fareAccommodationAdjustment}`);
    console.log(`     fareAccommodationAdjusted: ${m.fareAccommodationAdjusted}`);
    console.log(`     promotions field       : ${JSON.stringify(promos)}`);
    console.log(`     promo-ish invoiceItems : ${JSON.stringify(promoItems.map((i:any)=>({title:i.title,type:i.type,amount:i.amount})))}`);
    console.log(`     all invoiceItem titles : ${JSON.stringify(items.map((i:any)=>i.title))}`);
  } catch (e: any) {
    console.log(`  ${label}: quote failed — ${e?.message || e}`);
  }
}

async function main() {
  const today = new Date();
  for (const [nick, id] of LISTINGS) {
    console.log(`\n===== ${nick} (${id}) =====`);
    let cal: any[];
    try { cal = await getListingCalendar(id, ymd(today), ymd(addDays(today, 150))); }
    catch (e: any) { console.log("  calendar failed:", e?.message); continue; }
    await dumpQuote("EARLY-BIRD (≈50d out, 3n)", id, findWindow(cal, 50, 3));
    await dumpQuote("LAST-MINUTE (≈12d out, 2n)", id, findWindow(cal, 12, 2));
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
