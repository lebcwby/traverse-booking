/**
 * List all listings in a given city with their nicknames + URLs.
 * Run: npx tsx --env-file=.env.local scripts/list-by-city.ts "Twin Lakes"
 */
import { searchListings } from "../src/lib/guesty-beapi";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.booktraverse.com";

async function main(): Promise<void> {
  const city = process.argv[2];
  if (!city) {
    console.error("usage: list-by-city <city>");
    process.exit(1);
  }
  const res = (await searchListings({
    limit: 100,
    city,
    country: "United States",
  })) as {
    results?: Array<{
      _id?: string;
      id?: string;
      nickname?: string | null;
      title?: string | null;
      bedrooms?: number;
      accommodates?: number;
    }>;
    listings?: Array<{
      _id?: string;
      id?: string;
      nickname?: string | null;
      title?: string | null;
      bedrooms?: number;
      accommodates?: number;
    }>;
  };
  const all = res.results ?? res.listings ?? [];
  console.log(`\n${city}: ${all.length} listings\n`);
  for (const l of all) {
    const id = l._id ?? l.id ?? "?";
    const nick = (l.nickname ?? "").padEnd(35);
    const bed = l.bedrooms ? `${l.bedrooms}BR` : "?BR";
    const sleeps = l.accommodates ? `sleeps ${l.accommodates}` : "";
    console.log(`  ${nick} ${bed.padEnd(5)} ${sleeps.padEnd(12)} → ${SITE}/properties/${id}`);
  }
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
