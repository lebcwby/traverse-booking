"use client";
// src/components/plan/itinerary-map.tsx
// Mapbox view of every POI in the itinerary, pins colored by day.
// Mirrors the pattern in src/components/properties/property-detail/location-map.tsx.

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Monochrome dark-green palette — all days share the SP primary color so
// the map reads as one brand-aligned overlay. Numbered markers differentiate.
const DAY_HEX_PRIMARY = "#2b4a4e";

interface ItineraryMapProps {
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
}

export function ItineraryMap({ itinerary, poisById }: ItineraryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize the map once
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-122.676, 45.523], // downtown Portland
        zoom: 11,
        attributionControl: false,
      });
      mapRef.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right"
      );
    }

    const map = mapRef.current;

    // Clear prior markers (the itinerary can change between renders)
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    itinerary.days.forEach((day) => {
      const color = DAY_HEX_PRIMARY;
      for (const item of day.items) {
        const poi = poisById[item.poiId];
        if (!poi) continue;
        const lnglat: [number, number] = [poi.lng, poi.lat];

        const el = document.createElement("div");
        el.className =
          "flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md";
        el.style.backgroundColor = color;
        el.textContent = String(day.dayNumber);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(lnglat)
          .setPopup(
            new mapboxgl.Popup({ offset: 14, closeButton: false }).setHTML(
              `<div class="text-xs font-semibold">${escapeHtml(
                poi.name
              )}</div><div class="text-[11px] text-neutral-500">Day ${
                day.dayNumber
              }</div>`
            )
          )
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend(lnglat);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 500 });
    }

    return () => {
      // Only clean up markers on unmount — keep the map instance alive across
      // itinerary refreshes to avoid remounting the canvas.
    };
  }, [itinerary, poisById]);

  useEffect(
    () => () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
