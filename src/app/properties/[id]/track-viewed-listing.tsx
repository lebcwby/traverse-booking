"use client";

import { useEffect } from "react";
import { trackViewedListing } from "@/lib/tracking";

export function TrackViewedListing(props: {
  id: string;
  title: string;
  propertyType?: string;
  city?: string;
  basePrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  imageUrl?: string;
}) {
  useEffect(() => {
    trackViewedListing(props);
    // Set global so FloatingChatButton can pass listing context to Conduit
    window.__spCurrentListing = { id: props.id, title: props.title };
    return () => {
      window.__spCurrentListing = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
