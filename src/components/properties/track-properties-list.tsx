"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { type Listing } from "@/lib/supabase";
import { trackViewedListingList, trackSearch } from "@/lib/tracking";

export function TrackPropertiesList({ listings }: { listings: Listing[] }) {
  const tracked = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (tracked.current || listings.length === 0) return;
    tracked.current = true;

    trackViewedListingList(
      listings.slice(0, 20).map((l, i) => ({
        id: l.guesty_id,
        title: l.title || l.nickname || "",
        nickname: l.nickname,
        price: l.prices?.basePrice || 0,
        propertyType: l.property_type || undefined,
        position: i + 1,
      }))
    );

    trackSearch({
      checkIn: searchParams.get("checkIn") || undefined,
      checkOut: searchParams.get("checkOut") || undefined,
      guests: searchParams.get("guests")
        ? Number(searchParams.get("guests"))
        : undefined,
      city: searchParams.get("tag") || undefined,
      resultCount: listings.length,
      resultIds: listings.slice(0, 20).map((l) => l.guesty_id),
      filters: {
        bedrooms: searchParams.get("bedrooms")
          ? Number(searchParams.get("bedrooms"))
          : undefined,
        beds: searchParams.get("beds")
          ? Number(searchParams.get("beds"))
          : undefined,
        bathrooms: searchParams.get("bathrooms")
          ? Number(searchParams.get("bathrooms"))
          : undefined,
        minPrice: searchParams.get("minPrice")
          ? Number(searchParams.get("minPrice"))
          : undefined,
        maxPrice: searchParams.get("maxPrice")
          ? Number(searchParams.get("maxPrice"))
          : undefined,
        pets: searchParams.get("pets") === "true" || undefined,
        propertyType: searchParams.get("propertyType") || undefined,
        amenities: searchParams.get("amenities") || undefined,
        filterTag: searchParams.get("filterTag") || undefined,
      },
    });
  }, [listings, searchParams]);

  return null;
}
