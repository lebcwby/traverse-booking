import { NextRequest, NextResponse } from "next/server";
import { getOpenAPIListing } from "@/lib/guesty-openapi";
import { extractOtaLinksFromIntegrations } from "@/lib/ota-links";

// Returns the same listing's Airbnb / Vrbo / Booking.com URLs (from Guesty's
// listing `integrations[].externalUrl`) so the property page can deep-link a
// guest to verify our direct price is lower on the OTA's own page. Channel URLs
// rarely change → cache hard at the edge (1 day) to avoid an OpenAPI call per
// page load. Read-only.
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "listing id required" }, { status: 400 });
  }
  try {
    const listing = (await getOpenAPIListing(id)) as {
      integrations?: Array<{ platform?: string; externalUrl?: string | null }>;
    };
    const links = extractOtaLinksFromIntegrations(listing.integrations ?? null);
    return NextResponse.json(links, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch OTA links",
      },
      { status: 502 }
    );
  }
}
