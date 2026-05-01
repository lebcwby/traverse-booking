"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { X, ChevronRight } from "lucide-react";
import { NearbyAttractions } from "./nearby-attractions";
import type { NearbyPoi } from "@/lib/portland-pois";

const LocationMap = dynamic(
  () => import("./location-map").then((m) => ({ default: m.LocationMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-xl bg-muted" />
    ),
  }
);

interface WhereYoullBeProps {
  lat?: number;
  lng?: number;
  listingId: string;
  city?: string;
  state?: string;
  country?: string;
  neighborhood: string;
  transit: string;
  nearbyPois?: NearbyPoi[];
}

export function WhereYoullBe({
  lat,
  lng,
  listingId,
  city,
  state,
  country,
  neighborhood,
  transit,
  nearbyPois,
}: WhereYoullBeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const locationText = [city, state, country].filter(Boolean).join(", ");
  const hasDetails =
    neighborhood || transit || (nearbyPois && nearbyPois.length > 0);

  const closeDialog = useCallback(() => setDialogOpen(false), []);

  // Lock body scroll + escape key
  useEffect(() => {
    if (!dialogOpen) return;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [dialogOpen, closeDialog]);

  return (
    <>
      <h2 className="mb-2 text-xl font-semibold">Where you&apos;ll be</h2>
      {locationText && (
        <p className="mb-4 text-sm text-foreground">{locationText}</p>
      )}
      {lat && lng && (
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] rounded-xl overflow-hidden mb-4">
          <LocationMap lat={lat} lng={lng} listingId={listingId} />
        </div>
      )}
      {nearbyPois && nearbyPois.length > 0 && (
        <NearbyAttractions pois={nearbyPois} />
      )}
      {neighborhood && (
        <div className="mt-4">
          <h3 className="mb-2 text-base font-semibold">
            Neighborhood highlights
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground line-clamp-3">
            {neighborhood}
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
          >
            Show more <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {!neighborhood && transit && (
        <div className="mt-4">
          <h3 className="mb-2 text-base font-semibold">Getting around</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground line-clamp-3">
            {transit}
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
          >
            Show more <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Fullscreen dialog */}
      {dialogOpen && hasDetails && (
        <div className="fixed inset-0 z-[100] bg-background">
          <div className="flex h-full">
            {/* Left sidebar */}
            <div className="w-full md:w-[320px] shrink-0 overflow-y-auto border-r border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Where you&apos;ll be</h2>
                <button
                  onClick={closeDialog}
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-background border border-border shadow-sm hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>

              {nearbyPois && nearbyPois.length > 0 && (
                <div className="mb-6">
                  <NearbyAttractions pois={nearbyPois} />
                </div>
              )}

              {neighborhood && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-2">
                    Neighborhood highlights
                  </h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {neighborhood}
                  </p>
                </div>
              )}

              {transit && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Getting around</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {transit}
                  </p>
                </div>
              )}
            </div>

            {/* Map area */}
            {lat && lng && (
              <div className="hidden md:block flex-1 relative m-4 rounded-2xl overflow-hidden">
                <LocationMap lat={lat} lng={lng} listingId={listingId} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
