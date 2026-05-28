"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { PropertyCard } from "./property-card";

/** Most properties have a 3-night minimum (especially in CB during peak
 * season). When a search returns 0 results with a shorter stay picked, the
 * empty state suggests extending — a major drop-off otherwise. */
const COMMON_MIN_NIGHTS = 3;

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00Z`).getTime();
  const b = new Date(`${checkOut}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
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
    const checkIn = searchParams.get("checkIn") || undefined;
    const checkOut = searchParams.get("checkOut") || undefined;
    const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
    // Heuristic: if the user picked dates AND the stay is shorter than the
    // typical 3-night minimum, that's almost certainly why nothing matched.
    // Suggest extending without making them dig through filter UI.
    const suggestExtend = !!checkIn && nights > 0 && nights < COMMON_MIN_NIGHTS;

    function buildExtendedUrl(targetNights: number): string {
      if (!checkIn) return "/properties";
      const newCheckOut = addDays(checkIn, targetNights);
      const next = new URLSearchParams(searchParams.toString());
      next.set("checkIn", checkIn);
      next.set("checkOut", newCheckOut);
      return `/properties?${next.toString()}`;
    }

    return (
      <div className="py-16 text-center">
        {suggestExtend ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <CalendarPlus className="h-5 w-5 text-amber-700" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Most of our properties have a 3-night minimum
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              You picked a {nights}-night stay
              {checkIn ? ` (${formatShort(checkIn)}–${formatShort(checkOut!)})` : ""}{" "}
              — many of our Colorado mountain rentals require 3+ nights,
              especially during peak ski and summer seasons. Try extending and
              we&apos;ll show you what&apos;s available.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push(buildExtendedUrl(3))}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Try a 3-night stay ({checkIn ? formatShort(checkIn) : ""}–
                {checkIn ? formatShort(addDays(checkIn, 3)) : ""})
              </button>
              <Link
                href="/properties"
                className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Clear dates
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Need a shorter stay? Call{" "}
              <a
                href="tel:+17207592013"
                className="font-medium text-primary hover:underline"
              >
                (720) 759-2013
              </a>{" "}
              — we sometimes have flexibility on min-nights for last-minute
              dates.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
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
