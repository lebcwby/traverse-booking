// src/lib/pois/seed/pass-4-csv-import.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "../normalize";
import {
  POI_CATEGORIES,
  POI_PARTY_TYPES,
  POI_TAGS,
  POI_TIME_SLOTS,
} from "../types";

interface CsvRow {
  name: string;
  category: string;
  neighborhood: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  tags: string;
  time_slots: string;
  party_types: string;
  price_level: string;
  hours_summary: string;
  photo_url: string;
  source_url: string;
}

const VALID_CATEGORIES = new Set<string>(POI_CATEGORIES);
const VALID_TAGS = new Set<string>(POI_TAGS);
const VALID_TIME_SLOTS = new Set<string>(POI_TIME_SLOTS);
const VALID_PARTY_TYPES = new Set<string>(POI_PARTY_TYPES);

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateRow(row: CsvRow, index: number): void {
  const errors: string[] = [];
  if (!row.name) errors.push("name required");
  if (!VALID_CATEGORIES.has(row.category)) {
    errors.push(`invalid category: ${row.category}`);
  }
  if (!row.neighborhood) errors.push("neighborhood required");
  if (!row.address) errors.push("address required");
  if (Number.isNaN(parseFloat(row.lat))) errors.push("lat must be numeric");
  if (Number.isNaN(parseFloat(row.lng))) errors.push("lng must be numeric");

  for (const tag of splitList(row.tags)) {
    if (!VALID_TAGS.has(tag)) errors.push(`invalid tag: ${tag}`);
  }
  for (const slot of splitList(row.time_slots)) {
    if (!VALID_TIME_SLOTS.has(slot)) errors.push(`invalid time_slot: ${slot}`);
  }
  for (const party of splitList(row.party_types)) {
    if (!VALID_PARTY_TYPES.has(party)) {
      errors.push(`invalid party_type: ${party}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `CSV row ${index + 2} (${row.name || "unnamed"}): ${errors.join(", ")}`
    );
  }
}

export async function runPass4(): Promise<number> {
  const csvPath = path.resolve(process.cwd(), "docs/seed-pois/manual-pois.csv");
  const content = await fs.readFile(csvPath, "utf8");
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  console.log(`[pass-4] parsed ${rows.length} rows from ${csvPath}`);

  const dbRows = rows.map((row, i) => {
    validateRow(row, i);
    return {
      id: slugify(row.name, row.neighborhood),
      name: row.name,
      category: row.category,
      neighborhood: row.neighborhood,
      description: row.description,
      address: row.address,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      tags: splitList(row.tags),
      time_slots: splitList(row.time_slots),
      party_types: splitList(row.party_types),
      price_level: row.price_level ? parseInt(row.price_level, 10) : null,
      hours_summary: row.hours_summary || null,
      photo_url: row.photo_url || null,
      source_url: row.source_url || null,
      source_guide_slug: null,
      status: "draft" as const,
    };
  });

  if (dbRows.length === 0) return 0;

  const { error, count } = await getSupabaseAdmin()
    .from("sp_pois")
    .upsert(dbRows, { onConflict: "id", count: "exact" });

  if (error) throw new Error(`Pass 4 upsert failed: ${error.message}`);
  console.log(`[pass-4] imported ${count ?? dbRows.length} CSV rows`);
  return count ?? dbRows.length;
}
