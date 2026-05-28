/**
 * Inspect a single BEAPI listing's full payload to discover where the
 * license number and "other things to note" copy live.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/inspect-listing-fields.ts
 *
 * Pass a listing nickname/code (e.g. "CB:GL267") via env LISTING_CODE,
 * or omit to inspect the first listing returned by /api/listings.
 */
import { getListingDetail, searchListings } from "../src/lib/guesty-beapi";

async function main() {
  const code = process.env.LISTING_CODE;

  let id: string | undefined;
  let nickname: string | undefined;

  if (code) {
    let results: Array<{
      _id: string;
      nickname?: string;
      title?: string;
      tags?: string[];
    }> = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const search = await searchListings({ limit: 100, cursor });
      results = results.concat(search?.results ?? []);
      cursor = search?.pagination?.cursor?.next;
      if (!cursor) break;
    }
    const match = results.find(
      (r) =>
        r.nickname === code ||
        r.title?.includes(code) ||
        r.nickname?.includes(code)
    );
    if (!match) {
      console.error(
        `Could not find listing with code/nickname "${code}" across ${results.length} listings`
      );
      process.exit(1);
    }
    id = match._id;
    nickname = match.nickname;
    if (match.tags) {
      console.log(`Listing tags from search:`, match.tags);
    }
  } else {
    const search = await searchListings({ limit: 1 });
    const first = search?.results?.[0];
    if (!first) {
      console.error("No listings returned");
      process.exit(1);
    }
    id = first._id;
    nickname = first.nickname;
  }

  console.log(`Inspecting listing ${nickname} (id: ${id})\n`);

  const detail = await getListingDetail(id!);
  console.log("Top-level keys:", Object.keys(detail));

  console.log("\n--- terms ---");
  console.log(JSON.stringify(detail.terms, null, 2));

  console.log("\n--- publicDescription keys ---");
  if (detail.publicDescription) {
    console.log(Object.keys(detail.publicDescription));
    console.log(
      "\npublicDescription.notes:",
      detail.publicDescription.notes
    );
    console.log(
      "\npublicDescription.houseManual:",
      detail.publicDescription.houseManual
    );
    console.log(
      "\npublicDescription.houseRules:",
      detail.publicDescription.houseRules
    );
  }

  console.log("\n--- unitTypeHouseRules ---");
  console.log(JSON.stringify(detail.unitTypeHouseRules, null, 2));

  // Look for license-like substrings
  const json = JSON.stringify(detail);
  const matches = json.match(/license[^"]{0,80}/gi);
  if (matches) {
    console.log("\n--- license-substring matches ---");
    matches.slice(0, 20).forEach((m) => console.log(m));
  } else {
    console.log("\nNo 'license' substring found in returned payload.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
