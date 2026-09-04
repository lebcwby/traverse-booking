/**
 * Find Guesty BEAPI listings by exact / partial nickname match.
 * Pulls the full active catalog (no date filter) and greps client-side.
 *
 * Run: npx tsx --env-file=.env.local scripts/find-listings-by-nickname.ts <nick1> [nick2 ...]
 */
import { searchListings } from "../src/lib/guesty-beapi";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.booktraverse.com";

async function main(): Promise<void> {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error("usage: find-listings-by-nickname <nickname>...");
    process.exit(1);
  }

  // BEAPI caps limit at 100. Query each market's city separately since the
  // Traverse catalog spans multiple towns.
  type ListingLite = {
    _id?: string;
    id?: string;
    nickname?: string | null;
    title?: string | null;
    address?: { city?: string | null } | null;
  };
  const cities = [
    "Crested Butte",
    "Leadville",
    "Twin Lakes",
    "Granby",
    "Vail",
    "Avon",
    "Mt Crested Butte",
    "Mount Crested Butte",
  ];
  const all: ListingLite[] = [];
  const seen = new Set<string>();
  for (const city of cities) {
    const res = (await searchListings({
      limit: 100,
      city,
      country: "United States",
    })) as { results?: ListingLite[]; listings?: ListingLite[] };
    const batch = res.results ?? res.listings ?? [];
    for (const l of batch) {
      const key = l._id ?? l.id ?? "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(l);
    }
    console.log(`  ${city.padEnd(20)} → ${batch.length}`);
  }
  console.log(`\nTotal unique listings: ${all.length}\n`);

  for (const target of targets) {
    const lc = target.toLowerCase().replace(/\s+/g, "");
    const matches = all.filter((l) => {
      const nick = (l.nickname ?? "").toLowerCase().replace(/\s+/g, "");
      const title = (l.title ?? "").toLowerCase().replace(/\s+/g, "");
      return nick.includes(lc) || title.includes(lc);
    });
    console.log(`── "${target}" → ${matches.length} match${matches.length === 1 ? "" : "es"}`);
    for (const m of matches) {
      const id = m._id ?? m.id ?? "?";
      console.log(`   ${(m.nickname ?? "(no nickname)").padEnd(40)} → ${SITE}/properties/${id}`);
    }
    console.log("");
  }

  // If any targets returned 0, dump nicknames containing Plaza-relevant tokens
  // so we can find the actual naming convention.
  console.log("── For reference: all nicknames containing 'Plaza', 'PLZ', or unit-number digits ──");
  const interesting = all.filter((l) => {
    const s = (l.nickname ?? l.title ?? "").toLowerCase();
    return (
      s.includes("plaza") ||
      s.includes("plz") ||
      /\b(134|239|439)\b/.test(s)
    );
  });
  for (const m of interesting) {
    const id = m._id ?? m.id ?? "?";
    console.log(`   ${(m.nickname ?? m.title ?? "(no name)").padEnd(45)} → ${SITE}/properties/${id}`);
  }
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
