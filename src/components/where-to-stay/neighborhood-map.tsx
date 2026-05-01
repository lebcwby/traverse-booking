"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { NeighborhoodData } from "@/lib/where-to-stay-data";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function NeighborhoodMap({
  neighborhoods,
}: {
  neighborhoods: NeighborhoodData[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [activeId, setActiveId] = useState<string>(neighborhoods[0]?.id ?? "");

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const markers = markersRef.current;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.676, 45.523],
      zoom: 11.5,
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

    for (const n of neighborhoods) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 16px;
        height: 16px;
        background: ${n.color};
        border-radius: 50%;
        border: 2.5px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.2s, width 0.2s, height 0.2s;
      `;
      el.addEventListener("click", () => {
        const section = document.getElementById(n.id);
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([n.lng, n.lat])
        .addTo(map);

      markers.set(n.id, marker);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [neighborhoods]);

  // Scroll-sync: observe neighborhood sections
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setActiveId(id);

            const n = neighborhoods.find((nb) => nb.id === id);
            if (n && mapRef.current) {
              mapRef.current.flyTo({
                center: [n.lng, n.lat],
                zoom: 13,
                duration: 800,
              });
            }
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    for (const n of neighborhoods) {
      const el = document.getElementById(n.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [neighborhoods]);

  // Update marker sizes based on active neighborhood
  useEffect(() => {
    for (const [id, marker] of Array.from(markersRef.current)) {
      const el = marker.getElement();
      if (id === activeId) {
        el.style.width = "24px";
        el.style.height = "24px";
        el.style.zIndex = "10";
      } else {
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.zIndex = "1";
      }
    }
  }, [activeId]);

  return (
    <div className="sticky top-24">
      <div
        ref={containerRef}
        className="h-[300px] w-full overflow-hidden rounded-xl"
      />

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Jump to
        </h4>
        <nav className="space-y-1">
          {neighborhoods.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                const el = document.getElementById(n.id);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                activeId === n.id
                  ? "bg-primary/5 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: n.color }}
              />
              {n.name}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
