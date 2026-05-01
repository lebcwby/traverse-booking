// src/lib/pois/seed/pass-2-geocode.ts
import { readIntermediate, writeIntermediate } from "./intermediate-files";
import { photoUrl, priceLevelToInt, searchPlace } from "./google-places";
import type { CandidatePoi } from "./pass-1-extract";

export interface EnrichedPoi extends CandidatePoi {
  placesId: string;
  resolvedName: string;
  address: string;
  lat: number;
  lng: number;
  priceLevel: number | null;
  hoursSummary: string | null;
  photoUrl: string | null;
}

export async function enrichOne(
  candidate: CandidatePoi
): Promise<EnrichedPoi | null> {
  try {
    const result = await searchPlace(candidate.name);
    if (!result) return null;

    return {
      ...candidate,
      placesId: result.id,
      resolvedName: result.displayName.text,
      address: result.formattedAddress,
      lat: result.location.latitude,
      lng: result.location.longitude,
      priceLevel: priceLevelToInt(result.priceLevel),
      hoursSummary:
        result.regularOpeningHours?.weekdayDescriptions?.join("; ") ?? null,
      photoUrl: result.photos?.[0]?.name
        ? photoUrl(result.photos[0].name)
        : null,
    };
  } catch (e) {
    console.warn(
      `[pass-2] enrich failed for "${candidate.name}": ${(e as Error).message}`
    );
    return null;
  }
}

export async function runPass2(): Promise<{
  enriched: EnrichedPoi[];
  misses: CandidatePoi[];
  outputFile: string;
  missesFile: string;
}> {
  const candidates = await readIntermediate<CandidatePoi[]>(
    "pass-1-extracted.json"
  );
  console.log(`[pass-2] enriching ${candidates.length} candidates`);

  const enriched: EnrichedPoi[] = [];
  const misses: CandidatePoi[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    console.log(`[pass-2] (${i + 1}/${candidates.length}) ${candidate.name}`);
    const result = await enrichOne(candidate);
    if (result) {
      enriched.push(result);
    } else {
      misses.push(candidate);
    }
    // Light throttle to avoid rate limits (Google Places allows ~600 QPM)
    await new Promise((r) => setTimeout(r, 100));
  }

  const outputFile = await writeIntermediate("pass-2-enriched.json", enriched);
  const missesFile = await writeIntermediate("pass-2-misses.json", misses);
  console.log(`[pass-2] enriched ${enriched.length}, missed ${misses.length}`);
  console.log(`[pass-2] review misses at: ${missesFile}`);

  return { enriched, misses, outputFile, missesFile };
}
