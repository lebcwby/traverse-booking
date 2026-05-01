"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { type Listing } from "@/lib/supabase";
import { PropertyCard } from "./property-card";

export function PropertyGrid({
  listings,
  hidePrice,
  disableSwipe,
  maxPhotos,
  photoWidth,
  lazyCarousel,
}: {
  listings: Listing[];
  hidePrice?: boolean;
  disableSwipe?: boolean;
  maxPhotos?: number;
  photoWidth?: number;
  lazyCarousel?: boolean;
}) {
  const [animate, setAnimate] = useState(false);
  const prevIdsRef = useRef<string>("");
  const isFirstRef = useRef(true);

  useEffect(() => {
    const key = listings.map((l) => l.guesty_id).join(",");
    if (key !== prevIdsRef.current) {
      if (!isFirstRef.current) {
        // Trigger fade-in animation without re-mounting the grid
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 500);
        prevIdsRef.current = key;
        return () => clearTimeout(timer);
      }
      prevIdsRef.current = key;
      isFirstRef.current = false;
    }
  }, [listings]);

  if (listings.length === 0) {
    return (
      <div className="py-16 text-center">
        <h3 className="text-lg font-semibold text-foreground">
          No properties found
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your filters or dates to see more results.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/properties"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Clear all filters
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Browse all properties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${animate ? "animate-fade-in" : ""}`}
    >
      {listings.map((listing, i) => (
        <PropertyCard
          key={listing.guesty_id}
          listing={listing}
          hidePrice={hidePrice}
          priority={i < 4}
          disableSwipe={disableSwipe}
          maxPhotos={maxPhotos}
          photoWidth={photoWidth}
          lazyCarousel={lazyCarousel}
          position={i + 1}
        />
      ))}
    </div>
  );
}
