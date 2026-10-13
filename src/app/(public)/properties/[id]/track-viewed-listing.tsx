"use client";

import { useEffect } from "react";
import { trackViewedListing } from "@/lib/tracking";

export function TrackViewedListing(props: {
  id: string;
  title: string;
  /** Listing nickname — surfaces in GA4 Ecommerce reports as Item variant. */
  nickname?: string | null;
  propertyType?: string;
  city?: string;
  basePrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  imageUrl?: string;
}) {
  useEffect(() => {
    trackViewedListing(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
