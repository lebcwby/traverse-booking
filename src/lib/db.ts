import { Pool, Client } from "pg";
import { createHash } from "crypto";

let pool: Pool | null = null;

// Trim trailing whitespace/newlines — Vercel's env var storage has been
// observed to preserve stray \n at the end of values, which makes pg
// treat the database name as "postgres\n" and fail to connect.
function getPooledConnectionString(): string {
  const raw =
    process.env.SHARED_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  const connectionString = raw?.trim();
  if (!connectionString) {
    throw new Error(
      "SHARED_DATABASE_URL (or DATABASE_URL/POSTGRES_URL) must be set"
    );
  }
  return connectionString;
}

// Session-mode connection for features that transaction-pooling breaks:
// pg_advisory_lock, SET statement_timeout, LISTEN/NOTIFY. Falls back to the
// pooled URL if the direct var isn't set (dev convenience — local Postgres
// supports session features on the same URL).
function getDirectConnectionString(): string {
  const raw =
    process.env.SHARED_DATABASE_URL_DIRECT ||
    process.env.SHARED_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  const connectionString = raw?.trim();
  if (!connectionString) {
    throw new Error(
      "SHARED_DATABASE_URL_DIRECT (or SHARED_DATABASE_URL fallback) must be set"
    );
  }
  return connectionString;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getPooledConnectionString(),
      ssl: { rejectUnauthorized: false },
      // Keep this small: Next.js prerender spawns one worker process per
      // CPU core, and each worker instantiates its own singleton Pool. Even
      // with Supabase's transaction pooler fronting the DB, each process
      // opening many connections multiplies pointlessly — max=1 per process
      // is enough because queries within a worker run sequentially anyway.
      max: 1,
    });
  }
  return pool;
}

/**
 * True when the connection this lock would use goes through Supabase's
 * TRANSACTION pooler (port 6543), where pg_advisory_lock buys nothing:
 * statements are handed to whichever backend is free, so the lock and the
 * work it is meant to protect can land on different sessions, and the unlock
 * can release a lock nobody is holding.
 *
 * This is not hypothetical. Production ran for months with no
 * SHARED_DATABASE_URL_DIRECT, so getDirectConnectionString() fell back to
 * DATABASE_URL on :6543 and every withAdvisoryLock call was a no-op. That is
 * how GY-ty5Dgqzs / GY-8RHBqLsm — one payment, two confirmed reservations for
 * the same stay — got created 117ms apart by the webhook and the frontend
 * racing each other. The cart coordinator relies on the same helper.
 *
 * A lock that silently does nothing is worse than no lock, because the code
 * above it is written as if the race were impossible. So: say so, loudly and
 * once per instance. We do NOT throw — failing a booking outright would be a
 * worse outcome than the race, and the
 * reservations_one_active_per_stay_idx unique index now backstops the
 * single-listing path regardless of connection mode.
 *
 * Fix: set SHARED_DATABASE_URL_DIRECT to the session-mode URL (port 5432).
 */
let warnedAboutPooledLocking = false;
function locksAreEffective(connectionString: string): boolean {
  const pooled = /:6543(\/|\?|$)/.test(connectionString);
  if (pooled && !warnedAboutPooledLocking) {
    warnedAboutPooledLocking = true;
    console.error(
      "[withAdvisoryLock] Advisory locks are INEFFECTIVE: the connection uses " +
        "the transaction pooler (:6543). Concurrent work is NOT serialised. " +
        "Set SHARED_DATABASE_URL_DIRECT to the session-mode URL (:5432)."
    );
  }
  return !pooled;
}

/** Whether advisory locking actually works in this environment. Exposed so a
 *  health check can report the degraded state rather than it being invisible. */
export function advisoryLocksEffective(): boolean {
  try {
    return locksAreEffective(getDirectConnectionString());
  } catch {
    return false;
  }
}

// Serializes concurrent work keyed on an arbitrary string. Uses a dedicated
// pg.Client (not the shared max=1 pool) so the caller can still run queries
// through the shared pool inside `fn` without deadlocking on the held session.
// The lock is session-scoped; if the process dies the lock is released on
// disconnect. Collision probability on a 64-bit hash is negligible at our
// scale.
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = createHash("sha256")
    .update(key)
    .digest()
    .readBigInt64BE(0)
    .toString();
  const connectionString = getDirectConnectionString();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  locksAreEffective(connectionString);
  await client.connect();
  try {
    // Abort the lock wait before Vercel's 60s maxDuration so stuck locks
    // surface as a clean error instead of a 504.
    await client.query("SET statement_timeout = '45s'");
    await client.query("SELECT pg_advisory_lock($1::bigint)", [lockKey]);
    try {
      return await fn();
    } finally {
      await client
        .query("SELECT pg_advisory_unlock($1::bigint)", [lockKey])
        .catch(() => {});
    }
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Prove — not assume — that advisory locking actually serialises work.
 *
 * The port heuristic in locksAreEffective() catches the known-bad case, but a
 * URL that merely *looks* right is what let this go unnoticed for months: the
 * code read as though the race were impossible while pg_advisory_lock was
 * doing nothing on the transaction pooler. So this takes the lock on one
 * connection and tries to take the SAME lock on a second. If the second
 * succeeds, mutual exclusion does not work, whatever the connection string
 * says.
 *
 * Used by /api/health/db. Cheap, and safe to run against production: it locks
 * a random key nothing else uses, and releases it.
 */
export async function probeAdvisoryLock(): Promise<{
  effective: boolean;
  detail: string;
  target: string;
}> {
  const connectionString = getDirectConnectionString();
  // Host and port only — never the password. Without this a bad value is a
  // guessing game: the first attempt at SHARED_DATABASE_URL_DIRECT resolved to
  // a host literally called "base", and nothing could say so.
  let target = "unparseable";
  try {
    const u = new URL(connectionString);
    target = `${u.hostname}:${u.port || "(default)"}${u.pathname}`;
  } catch {
    target = `unparseable (${connectionString.length} chars)`;
  }
  const probeKey = createHash("sha256")
    .update(`advisory-probe:${Date.now()}:${Math.random()}`)
    .digest()
    .readBigInt64BE(0)
    .toString();

  const holder = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  const contender = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await holder.connect();
    await contender.connect();
    await holder.query("SELECT pg_advisory_lock($1::bigint)", [probeKey]);
    const res = await contender.query(
      "SELECT pg_try_advisory_lock($1::bigint) AS got",
      [probeKey]
    );
    const contenderGotIt = res.rows[0]?.got === true;
    if (contenderGotIt) {
      // Release what the contender wrongly acquired before reporting.
      await contender
        .query("SELECT pg_advisory_unlock($1::bigint)", [probeKey])
        .catch(() => {});
    }
    await holder
      .query("SELECT pg_advisory_unlock($1::bigint)", [probeKey])
      .catch(() => {});
    return contenderGotIt
      ? {
          effective: false,
          target,
          detail:
            "A second connection acquired a lock already held — concurrent " +
            "finalizers are NOT serialised. Point SHARED_DATABASE_URL_DIRECT " +
            "at the session-mode URL (:5432).",
        }
      : {
          effective: true,
          target,
          detail: "A second connection was correctly refused the held lock.",
        };
  } catch (err) {
    return {
      effective: false,
      target,
      detail: `Probe failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    await holder.end().catch(() => {});
    await contender.end().catch(() => {});
  }
}
