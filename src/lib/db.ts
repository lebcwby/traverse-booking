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
  const client = new Client({
    connectionString: getDirectConnectionString(),
    ssl: { rejectUnauthorized: false },
  });
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
