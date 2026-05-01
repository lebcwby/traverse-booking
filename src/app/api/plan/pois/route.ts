// src/app/api/plan/pois/route.ts
// Server-side hydration endpoint. The client POSTs a list of POI ids (pulled
// from a generate_itinerary tool call) and gets back full Poi rows so the
// timeline/map/sidebar can render photos, addresses, and lat/lng.
//
// Also acts as the validation gate: if any id isn't in sp_pois, we return
// an error so the UI can show "itinerary references missing POIs" instead of
// silently rendering a partial trip.

import { NextResponse } from "next/server";
import { getPoisByIds } from "@/lib/pois/queries";
import { sanitizePoiForClient } from "@/lib/plan/poi-photo";
import {
  enforceRateLimit,
  rejectOversizedRequest,
} from "@/lib/plan/route-guards";

export const runtime = "edge";

interface RequestBody {
  ids?: string[];
}

export async function POST(req: Request) {
  const sizeError = rejectOversizedRequest(req, 8_192);
  if (sizeError) return sizeError;

  const limited = await enforceRateLimit(req, "plan:pois", {
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids[] required" }, { status: 400 });
  }

  if (body.ids.length > 50) {
    return NextResponse.json(
      { error: "too many ids (max 50)" },
      { status: 400 }
    );
  }

  const ids = body.ids.filter(
    (id): id is string =>
      typeof id === "string" && id.length > 0 && id.length <= 120
  );

  try {
    const pois = await getPoisByIds(ids);
    const foundIds = new Set(pois.map((p) => p.id));
    const missing = ids.filter((id) => !foundIds.has(id));

    return NextResponse.json({
      pois: pois.map(sanitizePoiForClient),
      missing: missing.length > 0 ? missing : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
