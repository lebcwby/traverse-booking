"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Deterministic coordinate fuzzing (~100-200m offset) for privacy
// Same algorithm as property-map.tsx so the pin position is consistent
function fuzzCoords(lat: number, lng: number, id: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const angle = ((hash & 0xffff) / 0xffff) * Math.PI * 2;
  const dist = 0.001 + (((hash >>> 16) & 0xffff) / 0xffff) * 0.001;
  return [lat + Math.sin(angle) * dist, lng + Math.cos(angle) * dist];
}

// Static SVG for the home icon — no dynamic content
const HOME_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

interface LocationMapProps {
  lat: number;
  lng: number;
  listingId: string;
}

export function LocationMap({ lat, lng, listingId }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;

    const [fLat, fLng] = fuzzCoords(lat, lng, listingId);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [fLng, fLat],
      zoom: 14,
      scrollZoom: false,
      attributionControl: false,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    // Home marker with static SVG icon
    const markerEl = document.createElement("div");
    markerEl.style.cssText = `
      width: 40px;
      height: 40px;
      background: hsl(var(--primary));
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    // Safe: HOME_SVG is a static constant, not user input
    markerEl.innerHTML = HOME_SVG;

    new mapboxgl.Marker({ element: markerEl })
      .setLngLat([fLng, fLat])
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, listingId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
