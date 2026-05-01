import { Pool } from "pg";
import { FAVORITES } from "@/lib/plan/favorites";

const pool = new Pool({ connectionString: process.env.SHARED_DATABASE_URL });

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

(async () => {
  const multiLoc = FAVORITES.filter(
    (f) => f.neighborhoods && f.neighborhoods.length > 1
  );
  console.log(`${multiLoc.length} multi-location favorites to audit.\n`);

  const all = await pool.query(
    `SELECT id, name, neighborhood, address, status FROM sp_pois WHERE status = 'active' ORDER BY name`
  );

  for (const fav of multiLoc) {
    const favNorm = normalize(fav.nameMatch);
    const matches = all.rows.filter((p: any) => {
      const pNorm = normalize(p.name);
      if (pNorm === favNorm) return true;
      // containsAsWords approx
      const idx = pNorm.indexOf(favNorm);
      if (idx === -1) return false;
      const startsCleanly = idx === 0 || pNorm[idx - 1] === " ";
      const endsCleanly =
        idx + favNorm.length === pNorm.length ||
        pNorm[idx + favNorm.length] === " ";
      return startsCleanly && endsCleanly;
    });

    console.log(`--- ${fav.nameMatch} [${fav.category}]`);
    console.log(`   declared: ${fav.neighborhoods!.join(" / ")}`);
    console.log(
      `   sp_pois:  ${matches.length} row${matches.length === 1 ? "" : "s"}`
    );
    for (const m of matches) {
      console.log(
        `      • ${m.name} — ${m.neighborhood} — ${m.address ?? "(no address)"}`
      );
    }
    const gap = fav.neighborhoods!.length - matches.length;
    if (gap > 0)
      console.log(
        `   GAP: ~${gap} location${gap === 1 ? "" : "s"} likely missing`
      );
    console.log();
  }

  await pool.end();
})();
