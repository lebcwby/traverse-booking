// src/lib/pois/types.ts
// Types and controlled vocabularies for sp_pois.
// Keep this in sync with the migration constraints.

export const POI_CATEGORIES = [
  "restaurant",
  "coffee",
  "bar",
  "park",
  "shop",
  "museum",
  "viewpoint",
  "activity",
  "food_cart_pod",
  "transit",
] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

export const POI_TIME_SLOTS = [
  "morning",
  "midday",
  "afternoon",
  "evening",
  "late",
] as const;
export type PoiTimeSlot = (typeof POI_TIME_SLOTS)[number];

export const POI_PARTY_TYPES = ["couple", "family", "solo", "friends"] as const;
export type PoiPartyType = (typeof POI_PARTY_TYPES)[number];

// Controlled tag vocabulary — locked for v1.
// Adding new tags requires a code change + a Pass 3 reseed.
export const POI_TAGS = [
  // Audience
  "kid_friendly",
  "dog_friendly",
  "romantic",
  "group_friendly",
  "solo_friendly",
  // Price
  "cheap_eats",
  "mid_range",
  "splurge",
  // Setting
  "outdoor",
  "indoor",
  "rooftop",
  "waterfront",
  "walkable_from_transit",
  // Diet
  "vegan_options",
  "gluten_free_options",
  // Vibe
  "live_music",
  "hidden_gem",
  "local_legend",
  "instagrammable",
  "view",
] as const;
export type PoiTag = (typeof POI_TAGS)[number];

export const POI_STATUSES = ["active", "closed", "draft"] as const;
export type PoiStatus = (typeof POI_STATUSES)[number];

export interface Poi {
  id: string;
  name: string;
  category: PoiCategory;
  neighborhood: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  tags: PoiTag[];
  timeSlots: PoiTimeSlot[];
  partyTypes: PoiPartyType[];
  priceLevel: number | null;
  hoursSummary: string | null;
  photoUrl: string | null;
  sourceUrl: string | null;
  sourceGuideSlug: string | null;
  status: PoiStatus;
  createdAt: string;
  updatedAt: string;
}

// The shape stored in the DB row (snake_case to match Postgres columns).
export interface PoiRow {
  id: string;
  name: string;
  category: PoiCategory;
  neighborhood: string;
  description: string;
  address: string;
  lat: string; // numeric returns as string from pg
  lng: string;
  tags: PoiTag[];
  time_slots: PoiTimeSlot[];
  party_types: PoiPartyType[];
  price_level: number | null;
  hours_summary: string | null;
  photo_url: string | null;
  source_url: string | null;
  source_guide_slug: string | null;
  status: PoiStatus;
  created_at: string;
  updated_at: string;
}

export function rowToPoi(row: PoiRow): Poi {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    neighborhood: row.neighborhood,
    description: row.description,
    address: row.address,
    lat: Number(row.lat),
    lng: Number(row.lng),
    tags: row.tags,
    timeSlots: row.time_slots,
    partyTypes: row.party_types,
    priceLevel: row.price_level,
    hoursSummary: row.hours_summary,
    photoUrl: row.photo_url,
    sourceUrl: row.source_url,
    sourceGuideSlug: row.source_guide_slug,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
