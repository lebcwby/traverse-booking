/**
 * scripts/probe-quote-money.ts
 *
 * READ-ONLY diagnostic for the Stripe-vs-Guesty reconciliation gap.
 *
 * Background: Guesty confirmed (2026-05-29) that their quote engine and
 * reservation engine agree on `hostPayout` — so the ~0.7% / $3.71 delta we
 * see between what Stripe captured and Guesty's `balanceDue` is NOT a
 * platform fee. Our pipeline charges the guest `ratePlan.money.hostPayout`
 * (payment-intent/route.ts) but reconciles the payment against the
 * reservation's `money.balanceDue` (resolveAmountVsBalance). Those are two
 * different metrics. This script dumps a real quote's full money object so
 * we can see, side by side, which field actually equals the guest invoice
 * total (accommodation + cleaning + taxes + fees) and decide what we SHOULD
 * be charging.
 *
 * It only READS — it creates quotes (which are ephemeral, not bookings) and
 * never creates a reservation or charges anything.
 *
 * Run:  npx tsx --env-file=.env.local scripts/probe-quote-money.ts
 * Opt:  CITY="Leadville" NIGHTS=2 GUESTS=2 npx tsx ... (defaults: CB / 2 / 2)
 */
import { searchListings, createQuote } from "../src/lib/guesty-beapi";

const CITY = process.env.CITY || "Crested Butte";
const NIGHTS = Number(process.env.NIGHTS || 2);
const GUESTS = Number(process.env.GUESTS || 2);

function iso(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function main() {
  console.log(
    `\nProbing quote money — city="${CITY}" nights=${NIGHTS} guests=${GUESTS}\n`
  );

  const search = (await searchListings({
    city: CITY,
    country: "United States",
    limit: 20,
  })) as { results?: Array<{ _id: string; nickname?: string }> };
  const listings = search.results || [];
  if (listings.length === 0) {
    console.error(`No listings found for ${CITY}. Aborting.`);
    process.exit(1);
  }

  // Walk listings × date windows until one quotes successfully (availability
  // and min-nights vary), then dump the first success and stop.
  for (const listing of listings) {
    for (let daysAhead = 30; daysAhead <= 180; daysAhead += 15) {
      const checkIn = iso(daysAhead);
      const checkOut = iso(daysAhead + NIGHTS);
      let quote: unknown;
      try {
        quote = await createQuote({
          listingId: listing._id,
          checkIn,
          checkOut,
          guestsCount: GUESTS,
        });
      } catch {
        continue; // unavailable / below min-nights — try next window
      }

      const ratePlan = (
        quote as {
          rates?: { ratePlans?: Array<{ ratePlan?: Record<string, unknown> }> };
        }
      ).rates?.ratePlans?.[0]?.ratePlan;
      const money = (ratePlan?.money || {}) as Record<string, unknown>;
      if (Object.keys(money).length === 0) continue;

      console.log("─".repeat(72));
      console.log(`Listing : ${listing.nickname || listing._id}`);
      console.log(`Stay    : ${checkIn} → ${checkOut} (${NIGHTS} nights)\n`);

      // The fields that matter for the reconciliation question.
      const hostPayout = num(money.hostPayout);
      const fareAccommodation = num(money.fareAccommodation);
      const fareAccommodationAdjusted = num(money.fareAccommodationAdjusted);
      const fareCleaning = num(money.fareCleaning);
      const totalTaxes = num(money.totalTaxes);
      const totalFees = num(money.totalFees);
      const subTotalPrice = num(money.subTotalPrice);
      const totalPrice = num((money as { totalPrice?: unknown }).totalPrice);
      const hostServiceFee = num(
        (money as { hostServiceFee?: unknown }).hostServiceFee
      );

      const invoiceItems = Array.isArray(money.invoiceItems)
        ? (money.invoiceItems as Array<{ amount?: number; title?: string }>)
        : [];
      const invoiceSum = invoiceItems.reduce(
        (s, it) => s + (num(it.amount) || 0),
        0
      );

      const fmt = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

      console.log("KEY FIELDS");
      console.log(`  hostPayout              ${fmt(hostPayout)}   ← what we CHARGE the guest today`);
      console.log(`  totalPrice              ${fmt(totalPrice)}   ← likely the guest invoice total`);
      console.log(`  subTotalPrice           ${fmt(subTotalPrice)}`);
      console.log(`  fareAccommodation       ${fmt(fareAccommodation)}`);
      console.log(`  fareAccommodationAdj.   ${fmt(fareAccommodationAdjusted)}`);
      console.log(`  fareCleaning            ${fmt(fareCleaning)}`);
      console.log(`  totalTaxes              ${fmt(totalTaxes)}`);
      console.log(`  totalFees               ${fmt(totalFees)}`);
      console.log(`  hostServiceFee          ${fmt(hostServiceFee)}`);
      console.log(`  Σ invoiceItems          ${fmt(invoiceSum)}\n`);

      // The reconciliation deltas we care about.
      if (hostPayout != null && totalPrice != null) {
        const d = Number((hostPayout - totalPrice).toFixed(2));
        console.log(
          `  hostPayout − totalPrice = ${fmt(d)} ${d === 0 ? "(match)" : "(THIS is the Stripe-vs-Guesty gap)"}`
        );
      }
      if (hostPayout != null && invoiceSum > 0) {
        console.log(
          `  hostPayout − ΣinvoiceItems = ${fmt(Number((hostPayout - invoiceSum).toFixed(2)))}`
        );
      }

      console.log("\nINVOICE LINE ITEMS");
      for (const it of invoiceItems) {
        console.log(`  ${fmt(num(it.amount))}  ${it.title || "(untitled)"}`);
      }

      console.log("\nFULL money OBJECT (verbatim, for the Guesty ticket)");
      console.log(JSON.stringify(money, null, 2));
      console.log("─".repeat(72));
      return; // first success is enough
    }
  }

  console.error(
    "Could not get any quote to succeed across the sampled listings/dates."
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("Probe failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
