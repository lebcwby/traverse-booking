import zipData from "./data/us-zip-centroids.json";

type ZipEntry = readonly [zip: string, lat: number, lng: number];

const ENTRIES: readonly ZipEntry[] = zipData as unknown as readonly ZipEntry[];

let grid: Map<string, ZipEntry[]> | null = null;

function buildGrid(): Map<string, ZipEntry[]> {
  const g = new Map<string, ZipEntry[]>();
  for (const entry of ENTRIES) {
    const key = `${Math.floor(entry[1])}:${Math.floor(entry[2])}`;
    let bucket = g.get(key);
    if (!bucket) {
      bucket = [];
      g.set(key, bucket);
    }
    bucket.push(entry);
  }
  return g;
}

export function nearestZip(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!grid) grid = buildGrid();

  const cellLat = Math.floor(lat);
  const cellLng = Math.floor(lng);

  for (let radius = 1; radius <= 4; radius++) {
    let bestZip: string | null = null;
    let bestDistSq = Infinity;

    for (let dLat = -radius; dLat <= radius; dLat++) {
      for (let dLng = -radius; dLng <= radius; dLng++) {
        if (radius > 1 && Math.abs(dLat) < radius && Math.abs(dLng) < radius) {
          continue;
        }
        const bucket = grid.get(`${cellLat + dLat}:${cellLng + dLng}`);
        if (!bucket) continue;
        for (const [zip, eLat, eLng] of bucket) {
          const dy = eLat - lat;
          const dx = (eLng - lng) * Math.cos((lat * Math.PI) / 180);
          const distSq = dy * dy + dx * dx;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestZip = zip;
          }
        }
      }
    }

    if (bestZip) return bestZip;
  }

  return null;
}
