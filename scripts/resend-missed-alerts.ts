// One-off: resend the two manual backfill alerts using the real
// sendBookingConfirmation template. First send on 2026-04-14 used the
// old sync-website-reservations template which didn't match the
// checkout-flow format Hayden expects.
//
// Usage: pnpm tsx scripts/resend-missed-alerts.ts
//
// Reads /tmp/resend-payload.json written by the investigation session.

import { config } from "dotenv";
import { readFileSync } from "node:fs";
config({ path: ".env.local" });

type Payload = {
  reservationId: string;
  confirmationCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  listingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  chargedAmount: number;
  upsells: string[];
  pets: number;
};

async function main() {
  const { sendBookingConfirmation } = await import("../src/lib/alerts");
  const rows: Payload[] = JSON.parse(
    readFileSync("/tmp/resend-payload.json", "utf8")
  );
  console.log(`Resending ${rows.length} alerts via sendBookingConfirmation...`);
  for (const r of rows) {
    console.log(`  → ${r.confirmationCode} (${r.guestName})`);
    await sendBookingConfirmation({
      reservationId: r.reservationId,
      confirmationCode: r.confirmationCode,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      guestPhone: r.guestPhone,
      listingId: r.listingId,
      listingTitle: r.listingTitle,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guests: r.guests,
      chargedAmount: r.chargedAmount,
      upsells: r.upsells,
      pets: r.pets,
      attribution: null,
      firstTouchAttribution: null,
    });
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
