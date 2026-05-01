import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/guesty-beapi";
import { getListings } from "@/lib/supabase";

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

    // Otherwise, use Supabase for browsing (faster, no API rate limit cost)
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
