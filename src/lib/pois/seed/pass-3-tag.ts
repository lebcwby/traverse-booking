// src/lib/pois/seed/pass-3-tag.ts
import { completeJson } from "./claude-client";
import {
  intermediateExists,
  readIntermediate,
  writeIntermediate,
} from "./intermediate-files";
import {
  POI_CATEGORIES,
  POI_PARTY_TYPES,
  POI_TAGS,
  POI_TIME_SLOTS,
  type PoiCategory,
  type PoiPartyType,
  type PoiTag,
  type PoiTimeSlot,
} from "../types";
import type { EnrichedPoi } from "./pass-2-geocode";

export interface TaggedPoi extends EnrichedPoi {
  category: PoiCategory;
  neighborhood: string;
  description: string;
  tags: PoiTag[];
  timeSlots: PoiTimeSlot[];
  partyTypes: PoiPartyType[];
}

interface ClaudeTagResponse {
  category: string;
  neighborhood: string;
  description: string;
  tags: string[];
  time_slots: string[];
  party_types: string[];
}

const SYSTEM_PROMPT = `You are tagging a Portland point-of-interest for a trip planning tool. Given the place's name, address, original description, and Google data, output structured tags from a controlled vocabulary.

Return ONLY a JSON object — no prose, no markdown.

Schema:
{
  "category": one of [${POI_CATEGORIES.join(", ")}],
  "neighborhood": short slug like "pearl", "alberta", "division", "downtown", "se_industrial", "nob_hill", "hawthorne", "sellwood", "st_johns", "northwest", "north_portland", "lloyd", "kerns", "richmond", "buckman", "mt_tabor", or "other" if uncertain,
  "description": 1-2 sentence on-brand blurb (warm, specific, no clichés like "hidden gem" unless tagged as such),
  "tags": array, ONLY from [${POI_TAGS.join(", ")}] — pick 2-6 that genuinely apply,
  "time_slots": array, ONLY from [${POI_TIME_SLOTS.join(", ")}] — when this place is best visited,
  "party_types": array, ONLY from [${POI_PARTY_TYPES.join(", ")}] — who this place suits
}

Rules:
- Be conservative with tags. Don't tag "kid_friendly" unless it actually is. Don't tag "hidden_gem" for famous spots.
- "third_wave" is not a tag — if it's specialty coffee, just use category "coffee".
- "splurge" + "cheap_eats" never both apply.
- Description must NOT mention Book Traverse or rentals — focus only on the place itself.`;

const TAG_SET = new Set<string>(POI_TAGS);
const TIME_SET = new Set<string>(POI_TIME_SLOTS);
const PARTY_SET = new Set<string>(POI_PARTY_TYPES);
const CAT_SET = new Set<string>(POI_CATEGORIES);

function filterAllowed<T extends string>(
  values: string[],
  allowed: Set<string>
): T[] {
  return values.filter((v) => allowed.has(v)) as T[];
}

export async function tagOne(poi: EnrichedPoi): Promise<TaggedPoi | null> {
  const userPrompt = `Name: ${poi.resolvedName}
Address: ${poi.address}
Original mention: ${poi.whyMentioned}
Category guess: ${poi.categoryGuess}
Price level: ${poi.priceLevel ?? "unknown"}
Hours: ${poi.hoursSummary ?? "unknown"}`;

  try {
    const response = await completeJson<ClaudeTagResponse>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1024,
    });

    if (!CAT_SET.has(response.category)) {
      console.warn(
        `[pass-3] invalid category "${response.category}" for ${poi.resolvedName} — skipping`
      );
      return null;
    }

    return {
      ...poi,
      category: response.category as PoiCategory,
      neighborhood: response.neighborhood || "other",
      description: response.description,
      tags: filterAllowed<PoiTag>(response.tags, TAG_SET),
      timeSlots: filterAllowed<PoiTimeSlot>(response.time_slots, TIME_SET),
      partyTypes: filterAllowed<PoiPartyType>(response.party_types, PARTY_SET),
    };
  } catch (e) {
    console.warn(
      `[pass-3] tag failed for ${poi.resolvedName}: ${(e as Error).message}`
    );
    return null;
  }
}

export async function runPass3(): Promise<{
  tagged: TaggedPoi[];
  outputFile: string;
}> {
  const enriched = await readIntermediate<EnrichedPoi[]>(
    "pass-2-enriched.json"
  );

  // Resume from a prior partial run if pass-3-tagged.json already exists.
  // This is keyed on placesId so we don't re-tag POIs we already finished.
  const existing: TaggedPoi[] = (await intermediateExists("pass-3-tagged.json"))
    ? await readIntermediate<TaggedPoi[]>("pass-3-tagged.json")
    : [];
  const done = new Set(existing.map((t) => t.placesId));

  console.log(
    `[pass-3] tagging ${enriched.length} enriched POIs (resume: ${done.size} already done)`
  );
  // stderr is unbuffered when writing to a file, unlike stdout which is
  // block-buffered. Mirror progress there so `tail -f` actually shows it.
  process.stderr.write(
    `[pass-3] starting with ${done.size} already tagged, ${enriched.length - done.size} to go\n`
  );

  const tagged: TaggedPoi[] = [...existing];

  for (let i = 0; i < enriched.length; i++) {
    const poi = enriched[i]!;
    if (done.has(poi.placesId)) continue;

    const prefix = `[pass-3] (${i + 1}/${enriched.length}) ${poi.resolvedName}`;
    console.log(prefix);
    process.stderr.write(`${prefix}\n`);

    const result = await tagOne(poi);
    if (result) {
      tagged.push(result);
      // Checkpoint every 10 POIs so a crash doesn't lose the whole batch.
      if (tagged.length % 10 === 0) {
        await writeIntermediate("pass-3-tagged.json", tagged);
      }
    }
  }

  const outputFile = await writeIntermediate("pass-3-tagged.json", tagged);
  console.log(`[pass-3] tagged ${tagged.length}/${enriched.length}`);
  process.stderr.write(
    `[pass-3] done — tagged ${tagged.length}/${enriched.length}\n`
  );

  return { tagged, outputFile };
}
