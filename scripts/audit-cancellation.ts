import { searchListings, getListingDetail } from "../src/lib/guesty-beapi";

async function paginate(opts: Parameters<typeof searchListings>[0]) {
  const all: Array<{ _id: string; nickname?: string }> = [];
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
  console.log(`Sampling cancellation policies across ${all.length} listings\n`);

  const counts: Record<string, number> = {};
  for (const l of all) {
    const detail = await getListingDetail(l._id);
    const policy = detail.terms?.cancellation || "(none)";
    counts[policy] = (counts[policy] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [policy, n] of sorted) {
    console.log(`  ${String(n).padStart(4)}  ${policy}`);
  }
}

main().catch(console.error);
