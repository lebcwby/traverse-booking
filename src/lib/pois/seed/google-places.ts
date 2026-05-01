// src/lib/pois/seed/google-places.ts
// Minimal Google Places API (New, v1) client for POI seeding.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const PLACES_BASE = "https://places.googleapis.com/v1/places:searchText";

export type BusinessStatus =
  | "OPERATIONAL"
  | "CLOSED_TEMPORARILY"
  | "CLOSED_PERMANENTLY";

export interface PlacesResult {
  id: string;
  // Places API (New) returns displayName as a localized object, not a plain string.
  displayName: { text: string; languageCode?: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  priceLevel?: string; // "PRICE_LEVEL_INEXPENSIVE" | ... | "PRICE_LEVEL_VERY_EXPENSIVE"
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name: string }>;
  businessStatus?: BusinessStatus;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.priceLevel",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.photos.name",
  "places.businessStatus",
].join(",");

export async function searchPlace(
  query: string,
  locationBias = "Portland, Oregon"
): Promise<PlacesResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required");

  const response = await fetch(PLACES_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${query} in ${locationBias}`,
      maxResultCount: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places API ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { places?: PlacesResult[] };
  return data.places?.[0] ?? null;
}

export function priceLevelToInt(level?: string): number | null {
  if (!level) return null;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[level] ?? null;
}

export function photoUrl(photoName: string, maxPx = 800): string {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxPx}&key=${apiKey}`;
}
