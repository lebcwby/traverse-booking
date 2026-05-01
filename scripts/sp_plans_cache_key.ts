// scripts/sp_plans_cache_key.ts
// Applies scripts/sp_plans_cache_key.sql to the shared DB.
// Run: npx tsx --env-file=.env.local scripts/sp_plans_cache_key.ts

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const scriptDir = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.SHARED_DATABASE_URL;
  if (!url) throw new Error("SHARED_DATABASE_URL is required");

  const sql = readFileSync(join(scriptDir, "sp_plans_cache_key.sql"), "utf-8");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='sp_plans' order by ordinal_position"
    );
    console.log("sp_plans columns:");
    for (const row of rows) {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
