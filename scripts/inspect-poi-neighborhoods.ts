// scripts/inspect-poi-neighborhoods.ts
// One-shot: pull the distinct neighborhood vocabulary from sp_pois and
// the distinct neighborhood-like tags from listings, so we can build an
// accurate POI-neighborhood → listing-tag mapping for the trip planner.
//
// Run: npx tsx --env-file=.env.local scripts/inspect-poi-neighborhoods.ts

import { Client } from "pg";

async function main() {
  const url = process.env.SHARED_DATABASE_URL;
  if (!url) throw new Error("SHARED_DATABASE_URL is required");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    console.log("=".repeat(70));
    console.log("sp_pois — neighborhood vocabulary");
    console.log("=".repeat(70));
    const pois = await client.query<{ neighborhood: string; n: string }>(
      `select neighborhood, count(*)::text as n
       from sp_pois
       where status = 'active'
       group by neighborhood
       order by count(*) desc, neighborhood`
    );
    console.log(`total distinct neighborhoods: ${pois.rowCount}`);
    for (const row of pois.rows) {
      console.log(`  ${row.n.padStart(4)}  ${row.neighborhood}`);
    }

    console.log("");
    console.log("=".repeat(70));
    console.log("listings — tag vocabulary (tags that appear on ≥1 listing)");
    console.log("=".repeat(70));
    const tags = await client.query<{ tag: string; n: string }>(
      `select tag, count(*)::text as n
       from listings, unnest(tags) as tag
       where active = true and is_listed = true
       group by tag
       order by count(*) desc, tag`
    );
    console.log(`total distinct tags: ${tags.rowCount}`);
    for (const row of tags.rows) {
      console.log(`  ${row.n.padStart(4)}  ${row.tag}`);
    }

    console.log("");
    console.log("=".repeat(70));
    console.log(
      "cross-check — POI neighborhoods that exactly match a listing tag"
    );
    console.log("=".repeat(70));
    const exactMatches = await client.query<{ neighborhood: string }>(
      `select distinct p.neighborhood
       from sp_pois p
       where p.status = 'active'
         and exists (
           select 1 from listings l
           where l.active = true and l.is_listed = true
             and p.neighborhood = any(l.tags)
         )
       order by p.neighborhood`
    );
    for (const row of exactMatches.rows) {
      console.log(`  ${row.neighborhood}`);
    }
    console.log(`(${exactMatches.rowCount} exact matches)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
