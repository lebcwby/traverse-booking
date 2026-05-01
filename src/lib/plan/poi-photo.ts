// src/lib/plan/poi-photo.ts
// Helper for rewriting sp_pois.photo_url values before they're sent to the
// browser. Upstream rows contain Google Places URLs with an embedded API key;
// see src/app/api/plan/poi-photo/route.ts for the proxy that resolves them.

import type { Poi } from "@/lib/pois/types";

export function publicPoiPhotoUrl(poiId: string): string {
  return `/api/plan/poi-photo?id=${encodeURIComponent(poiId)}`;
}

export function sanitizePoiForClient(poi: Poi): Poi {
  if (!poi.photoUrl) return poi;
  return { ...poi, photoUrl: publicPoiPhotoUrl(poi.id) };
}
