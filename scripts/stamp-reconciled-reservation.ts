/**
 * Link a stuck pending_checkouts row to a Guesty reservation that ops
 * created by hand. --dry-run by default.
 *
 * Why this exists: when ops makes a reservation in Guesty to get a stuck
 * guest in, `pending_checkouts.reservation_id` is still NULL, so:
 *   * `/api/cron/recover-checkouts` retries every 10 min and emails,
 *   * `/api/cron/orphan-sweep` fires every 2h ("REFUND NEEDED"), because
 *     there is no row in our `reservations` table for the Stripe PI.
 *
 * Both stop the moment `reservation_id` is stamped on pending_checkouts
 * AND there is a matching `reservations` row. This script does both
 * writes in one transaction, after verifying every field (listingId,
 * check-in, check-out, guest email, money within 1¢) against Guesty's
 * own record of the reservation.
 *
 * Guardrails this enforces for you:
 *   * Dry-run is the default. Pass --apply to actually write.
 *   * `ON CONFLICT (guesty_id) DO UPDATE SET` on reservations — never
 *     clobbers an existing synced row.
 *   * `AND reservation_id IS NULL` on pending_checkouts — never
 *     overrides an existing stamp.
 *   * READ ONLY against Guesty and Stripe. No Guesty or Stripe writes.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/stamp-reconciled-reservation.ts \
 *     --pi=pi_3UZX3uFlSHWQrCQq1wzui10S \
 *     --reservation=GY-364GzPhs
 *
 *   (default is dry-run)
 *
 *   npx tsx --env-file=.env.local scripts/stamp-reconciled-reservation.ts \
 *     --pi=pi_3UZX3uFlSHWQrCQq1wzui10S \
 *     --reservation=GY-364GzPhs \
 *     --apply
 */

import { getPool } from "@/lib/db";
import { getPendingCheckout } from "@/lib/pending-checkouts";
import { getOpenAPIReservation } from "@/lib/guesty-openapi";
import { getStripeServer } from "@/lib/stripe";
import {
  buildReconcilePlan,
  describeReconcileFailure,
  type GuestyReservationLike,
  type PendingCheckoutLike,
} from "@/lib/pending-checkout-reconcile";

interface Args {
  paymentIntentId: string;
  reservationId: string;
  apply: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let pi: string | null = null;
  let res: string | null = null;
  let apply = false;
  for (const arg of argv) {
    if (arg.startsWith("--pi=")) pi = arg.slice("--pi=".length);
    else if (arg.startsWith("--reservation="))
      res = arg.slice("--reservation=".length);
    else if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
  }
  if (!pi || !res) {
    throw new Error(
      "Usage: --pi=<pi_...> --reservation=<GY-...> [--apply|--dry-run]\n" +
        "Default is --dry-run."
    );
  }
  return { paymentIntentId: pi, reservationId: res, apply };
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("─".repeat(72));
  console.log(
    `stamp-reconciled-reservation — ${args.apply ? "APPLY" : "DRY RUN"}`
  );
  console.log(`  paymentIntentId:  ${args.paymentIntentId}`);
  console.log(`  reservationId:    ${args.reservationId}`);
  console.log("─".repeat(72));

  // 1. Local pending_checkouts row.
  const pending = await getPendingCheckout(args.paymentIntentId);
  if (!pending) {
    console.error(
      `\nABORT: no pending_checkouts row for payment_intent_id=${args.paymentIntentId}`
    );
    process.exit(2);
  }
  console.log("\nLOCAL pending_checkouts");
  console.log(`  status:         ${pending.status}`);
  console.log(
    `  reservation_id: ${pending.reservationId ?? "(null — stamp needed)"}`
  );
  console.log(`  listingId:      ${pending.tracking.listingId}`);
  console.log(
    `  stay:           ${pending.tracking.checkIn} → ${pending.tracking.checkOut}, ${pending.tracking.guests} guest(s)`
  );
  console.log(`  guest.email:    ${pending.guest.email || "(none)"}`);
  console.log(
    `  guest.name:     ${[pending.guest.firstName, pending.guest.lastName].filter(Boolean).join(" ") || "(none)"}`
  );

  // 2. Authoritative Stripe amount.
  const stripe = getStripeServer();
  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId);
  console.log("\nSTRIPE payment intent");
  console.log(`  status:  ${pi.status}`);
  console.log(
    `  amount:  ${money((pi.amount ?? 0) / 100)} ${pi.currency?.toUpperCase() || ""}`
  );
  if (pi.status !== "succeeded") {
    console.error(
      `\nABORT: PI status is "${pi.status}" — only "succeeded" is safe to stamp against.`
    );
    process.exit(3);
  }

  // 3. The Guesty record.
  const guestyRaw = (await getOpenAPIReservation(
    args.reservationId
  )) as GuestyReservationLike;
  console.log("\nGUESTY reservation");
  console.log(`  _id:              ${guestyRaw._id ?? "(none)"}`);
  console.log(`  confirmationCode: ${guestyRaw.confirmationCode ?? "(none)"}`);
  console.log(`  status:           ${guestyRaw.status ?? "(none)"}`);
  console.log(`  listingId:        ${guestyRaw.listingId ?? "(none)"}`);
  console.log(
    `  stay:             ${guestyRaw.checkIn ?? "?"} → ${guestyRaw.checkOut ?? "?"}, ${guestyRaw.guestsCount ?? "?"} guest(s)`
  );
  console.log(`  guest.email:      ${guestyRaw.guest?.email ?? "(none)"}`);
  console.log(
    `  guest.name:       ${guestyRaw.guest?.fullName ?? [guestyRaw.guest?.firstName, guestyRaw.guest?.lastName].filter(Boolean).join(" ") ?? "(none)"}`
  );
  const money$ = guestyRaw.money ?? {};
  console.log(
    `  money.hostPayout: ${typeof money$.hostPayout === "number" ? money(money$.hostPayout) : "(none)"}`
  );
  console.log(
    `  money.totalPaid:  ${typeof money$.totalPaid === "number" ? money(money$.totalPaid) : "(none)"}`
  );

  // 4. Verify.
  const pendingAsLike: PendingCheckoutLike = {
    paymentIntentId: pending.paymentIntentId,
    reservationId: pending.reservationId,
    tracking: {
      listingId: pending.tracking.listingId,
      listingTitle: pending.tracking.listingTitle,
      checkIn: pending.tracking.checkIn,
      checkOut: pending.tracking.checkOut,
      guests: pending.tracking.guests,
    },
    guest: {
      email: pending.guest.email,
      firstName: pending.guest.firstName,
      lastName: pending.guest.lastName,
      phone: pending.guest.phone,
    },
  };
  const decision = buildReconcilePlan({
    pending: pendingAsLike,
    stripePaymentIntent: { id: pi.id, amount: pi.amount ?? 0 },
    guestyReservation: guestyRaw,
  });

  if (!decision.ok) {
    console.error(
      `\nABORT: match verification FAILED — ${describeReconcileFailure(decision.reason)}`
    );
    process.exit(4);
  }

  console.log("\nMATCH ✓  (every field verified)");
  console.log(`  reservationId:      ${decision.reservationId}`);
  console.log(`  confirmationCode:   ${decision.confirmationCode ?? "(none)"}`);
  console.log(`  listingId:          ${decision.listingId}`);
  console.log(
    `  stay:               ${decision.checkIn} → ${decision.checkOut}`
  );
  console.log(`  guest.email:        ${decision.guestEmail}`);
  console.log(`  guests:             ${decision.guestsCount}`);
  console.log(
    `  amount:             Stripe=${money(decision.chargedAmount)} ≈ Guesty=${money(decision.guestyMoneyMatched)} (within 1¢)`
  );

  console.log("\nSQL that WILL run:");
  console.log("  1. UPDATE pending_checkouts …");
  console.log(
    `     params: [reservation_id=${decision.updates.pendingCheckoutUpdate.params[0]}, payment_intent_id=${decision.updates.pendingCheckoutUpdate.params[1]}]`
  );
  console.log(
    "  2. INSERT INTO reservations … ON CONFLICT (guesty_id) DO UPDATE …"
  );

  if (!args.apply) {
    console.log(
      "\n[DRY RUN] No writes performed. Re-run with --apply to execute."
    );
    process.exit(0);
  }

  // 5. Apply — one transaction so a half-applied state can't exist.
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updateRes = await client.query(
      decision.updates.pendingCheckoutUpdate.sql,
      decision.updates.pendingCheckoutUpdate.params
    );
    await client.query(
      decision.updates.reservationsUpsert.sql,
      decision.updates.reservationsUpsert.params
    );
    await client.query("COMMIT");
    console.log(`\nAPPLIED ✓`);
    console.log(`  pending_checkouts: ${updateRes.rowCount} row(s) updated`);
    console.log(`  reservations:      upsert complete`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(
      `\nABORT: write failed, rolled back — ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(5);
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nUnexpected error:", err);
    process.exit(99);
  });
