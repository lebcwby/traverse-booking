"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { NEIGHBORHOODS, type NeighborhoodData } from "@/lib/where-to-stay-data";

const PORTLAND_CENTER = { lat: 45.523, lng: -122.676 };
const DEFAULT_ZOOM = 12;
const NEIGHBORHOOD_ZOOM = 14.5;

export function NeighborhoodExplorer() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [activeNeighborhood, setActiveNeighborhood] =
    useState<NeighborhoodData | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const selectNeighborhood = useCallback((n: NeighborhoodData | null) => {
    setActiveNeighborhood(n);
    if (!googleMapRef.current) return;

    if (n) {
      googleMapRef.current.panTo({ lat: n.lat, lng: n.lng });
      googleMapRef.current.setZoom(NEIGHBORHOOD_ZOOM);
    } else {
      googleMapRef.current.panTo(PORTLAND_CENTER);
      googleMapRef.current.setZoom(DEFAULT_ZOOM);
    }
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({
      apiKey,
      version: "weekly",
    });

    let cancelled = false;

    async function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Map } = await (loader as any).importLibrary("maps");
      if (cancelled || !mapRef.current) return;

      const map = new Map(mapRef.current, {
        center: PORTLAND_CENTER,
        zoom: DEFAULT_ZOOM,
        mapId: "book-traverse-neighborhoods",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
      });

      googleMapRef.current = map;
      setMapLoaded(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { AdvancedMarkerElement } = await (loader as any).importLibrary(
        "marker"
      );
      if (cancelled) return;

      for (const n of NEIGHBORHOODS) {
        const pin = document.createElement("div");
        pin.style.cssText = `
          width: 36px;
          height: 36px;
          background: ${n.color};
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        `;
        // Safe: n.name is from static constants, not user input
        const label = document.createElement("span");
        label.style.cssText = "color:white;font-size:11px;font-weight:700;";
        label.textContent = n.name.charAt(0);
        pin.appendChild(label);

        pin.addEventListener("mouseenter", () => {
          pin.style.transform = "scale(1.2)";
        });
        pin.addEventListener("mouseleave", () => {
          pin.style.transform = "scale(1)";
        });

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: n.lat, lng: n.lng },
          content: pin,
          title: n.name,
        });

        marker.addListener("click", () => selectNeighborhood(n));
        markersRef.current.push(marker);
      }
    }

    init();

    return () => {
      cancelled = true;
      for (const m of markersRef.current) {
        m.map = null;
      }
      markersRef.current = [];
      googleMapRef.current = null;
    };
  }, [selectNeighborhood]);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full">
      {/* Map */}
      <div ref={mapRef} className="h-full w-full" />

      {/* Loading state */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}

      {/* Neighborhood sidebar cards — desktop */}
      <div className="absolute left-4 top-4 z-10 hidden max-h-[calc(100vh-96px)] w-[320px] overflow-y-auto rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur-sm lg:block">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Portland Neighborhoods
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Click a neighborhood to explore restaurants, bars &amp; more
          </p>
        </div>

        <div className="p-2">
          {NEIGHBORHOODS.map((n) => (
            <button
              key={n.id}
              onClick={() =>
                selectNeighborhood(activeNeighborhood?.id === n.id ? null : n)
              }
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                activeNeighborhood?.id === n.id
                  ? "bg-primary/10 ring-1 ring-primary/20"
                  : "hover:bg-muted"
              }`}
            >
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: n.color }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{n.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {n.bestFor.join(", ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile bottom bar — neighborhood pills */}
      <div className="absolute bottom-0 left-0 right-0 z-10 lg:hidden">
        {!activeNeighborhood && (
          <div className="overflow-x-auto px-3 pb-4">
            <div className="flex gap-2">
              {NEIGHBORHOODS.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNeighborhood(n)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur-sm"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: n.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {n.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active neighborhood detail card */}
      {activeNeighborhood && (
        <div className="absolute bottom-4 left-4 right-4 z-20 mx-auto max-w-lg rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur-sm lg:bottom-auto lg:left-auto lg:right-4 lg:top-4 lg:w-[380px]">
          <div className="relative">
            <div className="aspect-[2/1] overflow-hidden rounded-t-xl">
              <Image
                src={activeNeighborhood.image}
                alt={activeNeighborhood.imageAlt}
                width={760}
                height={380}
                className="h-full w-full object-cover"
                sizes="380px"
              />
            </div>
            <button
              onClick={() => selectNeighborhood(null)}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: activeNeighborhood.color }}
              />
              <h3 className="text-lg font-bold text-foreground">
                {activeNeighborhood.name}
              </h3>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Best for: {activeNeighborhood.bestFor.join(", ")}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {activeNeighborhood.description[0]}
            </p>

            <div className="mt-3 flex gap-2">
              <div className="rounded-md border border-border px-2 py-1 text-xs">
                <span className="text-muted-foreground">Walk </span>
                <span className="font-semibold">
                  {activeNeighborhood.scores.walkability}/10
                </span>
              </div>
              <div className="rounded-md border border-border px-2 py-1 text-xs">
                <span className="text-muted-foreground">Dining </span>
                <span className="font-semibold">
                  {activeNeighborhood.scores.dining}/10
                </span>
              </div>
              <div className="rounded-md border border-border px-2 py-1 text-xs">
                <span className="text-muted-foreground">Nightlife </span>
                <span className="font-semibold">
                  {activeNeighborhood.scores.nightlife}/10
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href={getLandingPagePath(activeNeighborhood.slug)}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse Properties
              </Link>
              <Link
                href="/guide/where-to-stay-in-portland"
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Read Guide
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
