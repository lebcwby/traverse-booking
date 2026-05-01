// One-off audit: re-check every active sp_pois row against Google Places
// businessStatus. Writes /tmp/sp-pois-audit.json with findings.
//
// Run: node --env-file=/Users/haydenlaverty/Desktop/stay-portland/.env.local \
//        /tmp/audit-sp-pois-business-status.mjs
//
// No DB writes. Auto-draft happens from a follow-up step after review.

import pg from "pg";
import { writeFileSync } from "fs";

const { Client } = pg;

const PLACES_BASE = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.businessStatus",
].join(",");

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_PLACES_API_KEY missing in env");
  process.exit(1);
}

async function searchPlace(query) {
  const r = await fetch(PLACES_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!r.ok) {
    throw new Error(`Places ${r.status}: ${await r.text()}`);
  }
  const data = await r.json();
  return data.places?.[0] ?? null;
}

// Haversine distance in meters
function distMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = new Client({ connectionString: process.env.SHARED_DATABASE_URL });
  await db.connect();

  const { rows } = await db.query(`
    SELECT id, name, category, neighborhood, address, lat, lng
    FROM sp_pois
    WHERE status='active'
    ORDER BY category, name
  `);
  console.log(`Auditing ${rows.length} active rows...`);

  const findings = {
    closedPermanently: [],
    closedTemporarily: [],
    locationMismatch: [], // operational but >500m from stored lat/lng
    noMatch: [],
    errors: [],
    ok: 0,
  };

  let i = 0;
  for (const row of rows) {
    i++;
    // Skip rows without a usable address — name-only query gets noisy.
    // Fall back to name + neighborhood + Portland OR.
    const query = row.address
      ? `${row.name} ${row.address}`
      : `${row.name} ${row.neighborhood} Portland OR`;

    try {
      const place = await searchPlace(query);
      if (!place) {
        findings.noMatch.push({ id: row.id, name: row.name, query });
        console.log(`[${i}/${rows.length}] ${row.id} — NO MATCH`);
      } else {
        const status = place.businessStatus ?? "OPERATIONAL";
        const hasStoredLoc = row.lat != null && row.lng != null;
        const dist = hasStoredLoc
          ? distMeters(
              Number(row.lat),
              Number(row.lng),
              place.location.latitude,
              place.location.longitude
            )
          : null;

        if (status === "CLOSED_PERMANENTLY") {
          findings.closedPermanently.push({
            id: row.id,
            name: row.name,
            category: row.category,
            neighborhood: row.neighborhood,
            storedAddress: row.address,
            resolvedName: place.displayName?.text,
            resolvedAddress: place.formattedAddress,
            placeId: place.id,
            distMeters: dist,
          });
          console.log(`[${i}/${rows.length}] ${row.id} — CLOSED_PERMANENTLY`);
        } else if (status === "CLOSED_TEMPORARILY") {
          findings.closedTemporarily.push({
            id: row.id,
            name: row.name,
            category: row.category,
            neighborhood: row.neighborhood,
            storedAddress: row.address,
            resolvedName: place.displayName?.text,
            resolvedAddress: place.formattedAddress,
            placeId: place.id,
            distMeters: dist,
          });
          console.log(`[${i}/${rows.length}] ${row.id} — CLOSED_TEMPORARILY`);
        } else if (dist != null && dist > 500) {
          findings.locationMismatch.push({
            id: row.id,
            name: row.name,
            storedAddress: row.address,
            resolvedName: place.displayName?.text,
            resolvedAddress: place.formattedAddress,
            distMeters: Math.round(dist),
          });
          // Don't log every mismatch — noisy
        } else {
          findings.ok++;
        }
      }
    } catch (e) {
      findings.errors.push({ id: row.id, error: e.message });
      console.error(`[${i}/${rows.length}] ${row.id} — ERROR: ${e.message}`);
    }

    // Rate limit: 5 req/sec is safe for Places API. 200ms = 5/s.
    await sleep(220);

    // Flush progress every 50 rows
    if (i % 50 === 0) {
      writeFileSync(
        "/tmp/sp-pois-audit.json",
        JSON.stringify(findings, null, 2)
      );
    }
  }

  writeFileSync("/tmp/sp-pois-audit.json", JSON.stringify(findings, null, 2));
  await db.end();

  console.log("\n=== Summary ===");
  console.log(`OK:                   ${findings.ok}`);
  console.log(`CLOSED_PERMANENTLY:   ${findings.closedPermanently.length}`);
  console.log(`CLOSED_TEMPORARILY:   ${findings.closedTemporarily.length}`);
  console.log(`Location mismatch:    ${findings.locationMismatch.length}`);
  console.log(`No match:             ${findings.noMatch.length}`);
  console.log(`Errors:               ${findings.errors.length}`);
  console.log("\nFull results: /tmp/sp-pois-audit.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
