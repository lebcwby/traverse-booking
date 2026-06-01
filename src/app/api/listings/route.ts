import { NextRequest, NextResponse } from "next/server";
import { searchListings, searchListingsCached } from "@/lib/guesty-beapi";
import { getListings } from "@/lib/supabase";

// Minimal subset of the BEAPI listing object we touch when normalising into
// the legacy snake_case shape that downstream callers (PropertySidebar etc.)
// already expect.
interface BeapiListing {
  _id?: string;
  id?: string;
  title?: string | null;
  nickname?: string | null;
  bedrooms?: number | null;
  accommodates?: number | null;
  amenities?: string[] | null;
  tags?: string[] | null;
  propertyType?: string | null;
  pictures?: { original?: string | null; thumbnail?: string | null }[] | null;
  picture?: { thumbnail?: string | null; large?: string | null } | string | null;
}

function toLegacyListing(l: BeapiListing) {
  const guesty_id = l._id ?? l.id ?? "";
  const pics = (l.pictures ?? [])
    .map((p) => p?.thumbnail ?? p?.original ?? null)
    .filter((s): s is string => !!s);
  const primaryPic =
    typeof l.picture === "string"
      ? l.picture
      : (l.picture?.thumbnail ?? l.picture?.large ?? pics[0] ?? null);
  return {
    id: guesty_id,
    guesty_id,
    title: l.title ?? null,
    nickname: l.nickname ?? null,
    bedrooms: l.bedrooms ?? null,
    accommodates: l.accommodates ?? null,
    property_type: l.propertyType ?? null,
    picture: primaryPic,
    pictures: pics,
    amenities: l.amenities ?? null,
    tags: l.tags ?? null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const q = searchParams.get("q");
  const guests = searchParams.get("guests");
  const bedrooms = searchParams.get("bedrooms");
  const propertyType = searchParams.get("propertyType");
  const limit = searchParams.get("limit");
  const skip = searchParams.get("skip");
  const cursor = searchParams.get("cursor");

  try {
    // If dates provided, use BEAPI for real-time availability + pricing
    if (checkIn && checkOut) {
      const data = await searchListings({
        checkIn,
        checkOut,
        minOccupancy: guests ? Number(guests) : undefined,
        numberOfBedrooms: bedrooms ? Number(bedrooms) : undefined,
        propertyType: propertyType || undefined,
        limit: limit ? Number(limit) : 20,
        cursor: cursor || undefined,
      });
      return NextResponse.json(data);
    }

    // No dates: prefer BEAPI when only catalog filters are passed (guests/
    // bedrooms/propertyType). The local `listings` Supabase mirror is empty,
    // so the Supabase path was returning zero rows for callers like the
    // /plan PropertySidebar broad fallback. BEAPI accepts no-date queries
    // and returns active inventory; cached for 5min to keep the rate hit
    // off the hot path.
    if (!q && !skip) {
      const data = (await searchListingsCached({
        minOccupancy: guests ? Number(guests) : undefined,
        numberOfBedrooms: bedrooms ? Number(bedrooms) : undefined,
        propertyType: propertyType || undefined,
        limit: limit ? Number(limit) : 24,
      })) as { results?: BeapiListing[]; listings?: BeapiListing[] };
      const rows = (data.results ?? data.listings ?? []).map(toLegacyListing);
      return NextResponse.json(
        { results: rows },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Free-text search or paginated browse → Supabase (preserves original
    // semantics for callers that still rely on it).
    const listings = await getListings({
      limit: limit ? Number(limit) : 24,
      offset: skip ? Number(skip) : 0,
      search: q || undefined,
      guests: guests ? Number(guests) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      propertyType: propertyType || undefined,
    });
    return NextResponse.json(
      { results: listings },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch listings",
      },
      { status: 500 }
    );
  }
}
