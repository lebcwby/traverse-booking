import type { Pool } from "pg";
import { sendAlert } from "./alerts";

/**
 * Detects whether the payment-recording tracking columns added in
 * `20261113120000_add_payment_recording_tracking.sql` have been applied to
 * the connected database. The code paths that write or read those columns
 * branch on this result so an out-of-order deploy (code live before the
 * migration) still boots and still accepts bookings via the legacy
 * `resolveAmountVsBalance` path.
 *
 * Result is cached for the lifetime of the serverless instance — the schema
 * does not go backwards.
 *
 * On a false result, we emit a one-off alert (deduped 24h in Supabase KV via
 * `sendAlert`) so ops knows the migration is still pending.
 */
const REQUIRED_COLUMNS = [
  "payment_target_cents",
  "payment_recorded_cents",
  "payment_target_cents_set_at",
] as const;

let cached: Promise<boolean> | null = null;

export function resetPaymentTargetColumnsCacheForTests(): void {
  cached = null;
}

export async function paymentTargetColumnsExist(pool: Pool): Promise<boolean> {
  if (cached) return cached;
  cached = probe(pool);
  return cached;
}

async function probe(pool: Pool): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'reservations'
          AND column_name = ANY($1::text[])`,
      [REQUIRED_COLUMNS as unknown as string[]]
    );
    const present = new Set(rows.map((r) => r.column_name));
    const ok = REQUIRED_COLUMNS.every((c) => present.has(c));
    if (!ok) {
      await sendAlert(
        "Payment recording migration not applied yet; using legacy behavior",
        [
          "<p>The code has shipped with the payment-recording top-up protocol, but the matching Supabase migration has not been applied yet.</p>",
          "<p>Direct bookings continue to work via the legacy <code>resolveAmountVsBalance</code> fallback — shortfalls (e.g. $50 pet-fee ledger gap) will reappear until the migration lands.</p>",
          "<p><strong>Fix:</strong> apply <code>supabase/migrations/20261113120000_add_payment_recording_tracking.sql</code>.</p>",
          `<p>Missing columns: ${REQUIRED_COLUMNS.filter((c) => !present.has(c)).join(", ")}</p>`,
        ].join(""),
        "payment-recording-schema-missing"
      ).catch(() => {});
    }
    return ok;
  } catch (err) {
    // A probe failure is informational, not fatal. Treat as "unknown → false"
    // so the legacy path handles the booking and ops gets paged if the probe
    // cannot talk to the DB at all.
    console.warn(
      "[db-features] paymentTargetColumnsExist probe failed:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}
