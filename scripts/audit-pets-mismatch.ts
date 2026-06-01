/**
 * Audit pet-friendly mismatches across the entire portfolio.
 * Lists every listing where the "pet friendly" tag is set but the
 * houseRules.petsAllowed.enabled flag is false (or vice versa).
 */
import { searchListings, getListingDetail } from "../src/lib/guesty-beapi";

async function paginate(opts: Parameters<typeof searchListings>[0]) {
  const all: Array<{ _id: string; nickname?: string; tags?: string[] }> = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await searchListings({ ...opts, limit: 100, cursor });
    all.push(...(r.results || []));
    cursor = r.pagination?.cursor?.next;
    if (!cursor) break;
  }
  return all;
}

async function main() {
  const all = await paginate({});
  console.log(`Loaded ${all.length} listings`);
  const haveTag = all.filter((l) =>
    l.tags?.some((t) => t.toLowerCase().includes("pet"))
  );
  console.log(`Listings with pet-related tag: ${haveTag.length}`);

  let tagOnly = 0;
  let flagOnly = 0;
  let both = 0;
  let neither = 0;
  const tagOnlyList: string[] = [];
  const flagOnlyList: string[] = [];

  for (const l of all) {
    const detail = await getListingDetail(l._id);
    const flag =
      detail.unitTypeHouseRules?.houseRules?.petsAllowed?.enabled === true;
    // Exact match (case-insensitive). BEAPI's tag query is exact too, so a
    // substring check would falsely match "not pet friendly".
    const tag =
      l.tags?.some((t) => t.toLowerCase().trim() === "pet friendly") ?? false;
    if (tag && flag) both++;
    else if (tag && !flag) {
      tagOnly++;
      tagOnlyList.push(l.nickname || l._id);
    } else if (!tag && flag) {
      flagOnly++;
      flagOnlyList.push(l.nickname || l._id);
    } else neither++;
  }
  console.log(`\nBoth tag + flag:     ${both}`);
  console.log(`Tag only (no flag):  ${tagOnly}`);
  console.log(`Flag only (no tag):  ${flagOnly}`);
  console.log(`Neither:             ${neither}`);
  if (tagOnlyList.length) {
    console.log(`\nTag-only listings:`);
    tagOnlyList.forEach((n) => console.log(`  ${n}`));
  }
  if (flagOnlyList.length) {
    console.log(`\nFlag-only listings:`);
    flagOnlyList.forEach((n) => console.log(`  ${n}`));
  }
}

main().catch(console.error);
