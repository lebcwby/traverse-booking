"use client";

import { Suspense } from "react";
import type { Listing } from "@/lib/supabase";
import { PropertyCard } from "@/components/properties/property-card";

interface SimilarPropertiesProps {
  listings: Listing[];
  neighborhoodName: string;
}

function SimilarPropertiesInner({
  listings,
  neighborhoodName,
}: SimilarPropertiesProps) {
  if (listings.length === 0) return null;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">
        Similar Properties in {neighborhoodName}
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {listings.map((listing) => (
          <PropertyCard
            key={listing.guesty_id}
            listing={listing}
            hidePrice
            disableSwipe
            maxPhotos={1}
            compact
            hideCity
          />
        ))}
      </div>
    </div>
  );
}

export function SimilarProperties(props: SimilarPropertiesProps) {
  return (
    <Suspense>
      <SimilarPropertiesInner {...props} />
    </Suspense>
  );
}
