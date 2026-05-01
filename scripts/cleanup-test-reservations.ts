/**
 * Delete test reservations from the shared DB.
 *
 * Targets rows whose guest email matches `testing@booktraverse.com` or
 * `testing+*@booktraverse.com`. Run this after a staging test session to
 * keep test bookings out of dashboards, owner statements, occupancy stats,
 * and the new cancellation lifecycle data.
 *
 * Default mode is dry-run: shows what would be deleted without changing anything.
 * Pass --apply to actually delete.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-reservations.ts             # dry run
 *   npx tsx scripts/cleanup-test-reservations.ts --apply     # delete for real
 */

import { Pool } from "pg";
import { readFileSync } from "fs";

// Load .env.local manually
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {
  // .env.local optional — fall back to ambient env
}

const APPLY = process.argv.includes("--apply");
const TEST_EMAIL_PATTERN = "testing+%@booktraverse.com";
const TEST_EMAIL_EXACT = "testing@booktraverse.com";

const databaseUrl =
  process.env.SHARED_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("[cleanup] No DATABASE_URL — set SHARED_DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  console.log(
    `[cleanup] Mode: ${APPLY ? "APPLY (will delete)" : "DRY RUN (no changes)"}`
  );
  console.log(
    `[cleanup] Matching guest emails: '${TEST_EMAIL_EXACT}' OR LIKE '${TEST_EMAIL_PATTERN}'\n`
  );

  // Find matching reservations
  const reservations = await pool.query(
    `SELECT
        guesty_id,
        confirmation_code,
        guest->>'email' AS email,
        guest->>'fullName' AS name,
        check_in,
        check_out,
        status,
        refund_status,
        canceled_at
       FROM reservations
      WHERE lower(guest->>'email') = lower($1)
         OR lower(guest->>'email') LIKE lower($2)
      ORDER BY check_in DESC`,
    [TEST_EMAIL_EXACT, TEST_EMAIL_PATTERN]
  );

  console.log(
    `[cleanup] Found ${reservations.rowCount} reservation row(s) matching test email pattern:`
  );
  for (const r of reservations.rows) {
    console.log(
      `  - ${r.guesty_id}  ${r.confirmation_code || "—"}  ${r.email || "—"}  ` +
        `${r.check_in} → ${r.check_out}  status=${r.status}` +
        (r.refund_status ? `  refund=${r.refund_status}` : "")
    );
  }

  // Find matching pending_checkouts
  const pending = await pool.query(
    `SELECT id, email, listing_id, created_at
       FROM pending_checkouts
      WHERE lower(email) = lower($1) OR lower(email) LIKE lower($2)
      ORDER BY created_at DESC`,
    [TEST_EMAIL_EXACT, TEST_EMAIL_PATTERN]
  );

  console.log(`\n[cleanup] Found ${pending.rowCount} pending_checkout row(s):`);
  for (const p of pending.rows) {
    console.log(
      `  - ${p.id}  ${p.email}  listing=${p.listing_id}  ${p.created_at}`
    );
  }

  if (!APPLY) {
    console.log(
      "\n[cleanup] Dry run complete. Re-run with --apply to delete these rows."
    );
    return;
  }

  if (reservations.rowCount === 0 && pending.rowCount === 0) {
    console.log("\n[cleanup] Nothing to delete.");
    return;
  }

  console.log("\n[cleanup] Deleting...");

  const resDel = await pool.query(
    `DELETE FROM reservations
      WHERE lower(guest->>'email') = lower($1)
         OR lower(guest->>'email') LIKE lower($2)`,
    [TEST_EMAIL_EXACT, TEST_EMAIL_PATTERN]
  );
  console.log(`  - reservations:     deleted ${resDel.rowCount}`);

  const pendingDel = await pool.query(
    `DELETE FROM pending_checkouts
      WHERE lower(email) = lower($1) OR lower(email) LIKE lower($2)`,
    [TEST_EMAIL_EXACT, TEST_EMAIL_PATTERN]
  );
  console.log(`  - pending_checkouts: deleted ${pendingDel.rowCount}`);

  console.log(
    "\n[cleanup] Done. Reminder: also cancel the matching reservations in Guesty if you haven't already."
  );
}

main()
  .catch((err) => {
    console.error("[cleanup] Failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
