"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Listing } from "@/lib/supabase";
import { getListingSlug } from "@/lib/utils";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

type ClusteredGeoJSONSource = mapboxgl.GeoJSONSource & {
  getClusterExpansionZoom: (
    clusterId: number,
    callback: (error: Error | null | undefined, zoom: number) => void
  ) => void;
};

// Deterministic coordinate fuzzing (~100-200m offset) for privacy
// Uses a simple hash of the listing ID so the offset is always the same for a given listing
function fuzzCoords(lat: number, lng: number, id: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  // Convert hash to two pseudo-random values between -1 and 1
  const angle = ((hash & 0xffff) / 0xffff) * Math.PI * 2;
  const dist = 0.001 + (((hash >>> 16) & 0xffff) / 0xffff) * 0.001; // ~0.001-0.002 degrees ≈ 100-200m
  return [lat + Math.sin(angle) * dist, lng + Math.cos(angle) * dist];
}

interface PropertyMapProps {
  listings: Listing[];
  onVisibleListingsChange?: (visibleIds: Set<string>) => void;
  hidePrice?: boolean;
  bottomPadding?: number;
  onMarkerClick?: (listingId: string) => void;
  onMapInteraction?: () => void;
  selectedListingId?: string | null;
}

export function PropertyMap({
  listings,
  onVisibleListingsChange,
  hidePrice,
  bottomPadding = 0,
  onMarkerClick,
  onMapInteraction,
  selectedListingId,
}: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onVisibleRef = useRef(onVisibleListingsChange);
  onVisibleRef.current = onVisibleListingsChange;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
  const onMapInteractionRef = useRef(onMapInteraction);
  onMapInteractionRef.current = onMapInteraction;
  const bottomPaddingRef = useRef(bottomPadding);
  bottomPaddingRef.current = bottomPadding;
  const hidePriceRef = useRef(hidePrice);
  hidePriceRef.current = hidePrice;
  const isProgrammaticMoveRef = useRef(false);
  const listingToMarkerKeyRef = useRef<Map<string, string>>(new Map());
  const fuzzedCoordsRef = useRef<Map<string, [number, number]>>(new Map());

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    // Don't initialize without a Mapbox token
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;
    // Don't initialize in a zero-size container (e.g. hidden desktop map on mobile)
    if (
      mapContainer.current.offsetWidth === 0 ||
      mapContainer.current.offsetHeight === 0
    )
      return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.6765, 45.5231],
      zoom: 12,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoomRotate: true,
      attributionControl: false,
    });

    mapContainer.current.querySelector(".mapboxgl-ctrl-bottom-left")?.remove();
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    const m = map.current;

    m.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    // Fullscreen toggle button
    class FullscreenToggle {
      _container?: HTMLDivElement;
      _btn?: HTMLButtonElement;
      _expanded = false;
      _backdrop?: HTMLDivElement;
      _savedStyles?: string;
      _savedParent?: HTMLElement | null;
      _escHandler?: (e: KeyboardEvent) => void;

      _expandIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      _collapseIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      onAdd() {
        this._container = document.createElement("div");
        this._container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Toggle fullscreen";
        btn.setAttribute("aria-label", "Toggle fullscreen");
        btn.innerHTML = this._expandIcon;
        btn.style.cssText =
          "display:flex;align-items:center;justify-content:center;";
        btn.addEventListener("click", () => this._toggle());
        this._btn = btn;
        this._container.appendChild(btn);

        this._escHandler = (e: KeyboardEvent) => {
          if (e.key === "Escape" && this._expanded) this._toggle();
        };
        document.addEventListener("keydown", this._escHandler);

        return this._container;
      }

      _mapWrapper?: HTMLDivElement;

      _toggle() {
        const mapEl = mapContainer.current;
        if (!mapEl) return;
        this._expanded = !this._expanded;

        if (this._expanded) {
          // Create fixed overlay — backdrop fades in
          this._backdrop = document.createElement("div");
          this._backdrop.style.cssText =
            "position:fixed;top:64px;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0);transition:background 0.3s ease;";

          // Map wrapper at full size immediately, but scales up from 0.92 for a smooth feel
          const mapWrapper = document.createElement("div");
          mapWrapper.style.cssText = `
            position:absolute;top:12px;left:12px;right:12px;bottom:12px;
            border-radius:12px;overflow:hidden;
            transform:scale(0.92);opacity:0;
            transition:transform 0.3s ease,opacity 0.3s ease;
          `;
          this._mapWrapper = mapWrapper;

          // Save original parent
          this._savedParent = mapEl.parentElement;
          this._savedStyles = mapEl.style.cssText;

          // Move map into overlay at full size
          mapWrapper.appendChild(mapEl);
          this._backdrop.appendChild(mapWrapper);
          document.body.appendChild(this._backdrop);
          mapEl.style.cssText = "width:100%;height:100%;";

          // Resize immediately so Mapbox renders at full size
          m.resize();

          // Animate in on next frame
          requestAnimationFrame(() => {
            this._backdrop!.style.background = "rgba(0,0,0,0.5)";
            mapWrapper.style.transform = "scale(1)";
            mapWrapper.style.opacity = "1";
          });

          // Clicking backdrop closes
          this._backdrop.addEventListener("click", (e) => {
            if (e.target === this._backdrop) this._toggle();
          });

          document.body.style.overflow = "hidden";
          this._btn!.innerHTML = this._collapseIcon;
          this._btn!.title = "Exit fullscreen";
          this._btn!.setAttribute("aria-label", "Exit fullscreen");
        } else {
          // Move map back to original parent immediately (hidden behind fading overlay)
          const mapEl2 = mapContainer.current!;
          if (this._savedParent) {
            this._savedParent.appendChild(mapEl2);
          }
          mapEl2.style.cssText = this._savedStyles || "";
          m.resize();

          // Fade the whole overlay out smoothly
          if (this._backdrop) {
            this._backdrop.style.transition = "opacity 0.3s ease";
            this._backdrop.style.opacity = "0";
          }

          // Clean up after fade
          setTimeout(() => {
            this._backdrop?.remove();
            this._backdrop = undefined;
            this._mapWrapper = undefined;
            document.body.style.overflow = "";
          }, 300);

          this._btn!.innerHTML = this._expandIcon;
          this._btn!.title = "Toggle fullscreen";
          this._btn!.setAttribute("aria-label", "Toggle fullscreen");
        }
      }

      onRemove() {
        if (this._escHandler)
          document.removeEventListener("keydown", this._escHandler);
        if (this._expanded) {
          // Move map back before cleanup
          const mapEl = mapContainer.current;
          if (mapEl && this._savedParent) {
            this._savedParent.appendChild(mapEl);
            mapEl.style.cssText = this._savedStyles || "";
          }
          document.body.style.overflow = "";
        }
        this._backdrop?.remove();
        this._container?.remove();
      }
    }
    if (!window.matchMedia("(max-width: 767px)").matches) {
      const fullscreenCtrl = new FullscreenToggle();
      m.addControl(fullscreenCtrl as unknown as mapboxgl.IControl, "top-right");
    }

    const validListings = listings.filter(
      (l) => l.address?.lat && l.address?.lng
    );

    // Group listings by exact coordinates
    const coordGroups = new Map<string, Listing[]>();
    validListings.forEach((listing) => {
      const key = `${listing.address!.lat},${listing.address!.lng}`;
      const group = coordGroups.get(key) || [];
      group.push(listing);
      coordGroups.set(key, group);
    });

    // Pre-compute fuzzed coordinates for each listing (deterministic per ID)
    const fuzzedCoords = new Map<string, [number, number]>();
    validListings.forEach((listing) => {
      const [fLat, fLng] = fuzzCoords(
        listing.address!.lat,
        listing.address!.lng,
        listing.guesty_id
      );
      fuzzedCoords.set(listing.guesty_id, [fLng, fLat]); // [lng, lat] for mapbox
    });

    // Store fuzzed coords for external use (highlighting/panning)
    fuzzedCoordsRef.current = fuzzedCoords;

    // Compute a fuzzed center for each coordinate group (average of member fuzzed positions)
    const groupFuzzedCenter = new Map<string, [number, number]>();
    coordGroups.forEach((group, key) => {
      let sumLng = 0,
        sumLat = 0;
      group.forEach((l) => {
        const [lng, lat] = fuzzedCoords.get(l.guesty_id)!;
        sumLng += lng;
        sumLat += lat;
      });
      groupFuzzedCenter.set(key, [
        sumLng / group.length,
        sumLat / group.length,
      ]);
    });

    // Build GeoJSON for clustering (one feature per listing, with fuzzed coords)
    const features = validListings.map((listing) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: fuzzedCoords.get(listing.guesty_id)!,
      },
      properties: {
        id: listing.guesty_id,
        price: Math.round(listing.totalPrice || listing.prices?.basePrice || 0),
      },
    }));

    // Track the active popup so we close it before opening another
    let activePopup: mapboxgl.Popup | null = null;

    function getPhotos(listing: Listing): string[] {
      const photos: string[] = [];
      if (listing.pictures && listing.pictures.length > 0) {
        photos.push(...listing.pictures.slice(0, 6));
      } else if (listing.picture) {
        photos.push(listing.picture);
      }
      return photos;
    }

    function sanitizeImageUrl(src: string | null | undefined): string | null {
      if (!src) return null;

      try {
        const parsed = new URL(src, window.location.origin);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // Ignore malformed URLs from upstream listing data.
      }

      return null;
    }

    function createElement<K extends keyof HTMLElementTagNameMap>(
      tagName: K,
      options: { textContent?: string; style?: string } = {}
    ) {
      const element = document.createElement(tagName);
      if (options.textContent !== undefined) {
        element.textContent = options.textContent;
      }
      if (options.style) {
        element.style.cssText = options.style;
      }
      return element;
    }

    function createCarouselElement(
      photos: string[],
      height: string,
      borderRadius: string,
      altText: string
    ): HTMLElement | null {
      const safePhotos = photos
        .map((photo) => sanitizeImageUrl(photo))
        .filter((photo): photo is string => Boolean(photo));

      if (safePhotos.length === 0) return null;

      if (safePhotos.length === 1) {
        const img = createElement("img", {
          style: `width:100%;height:${height};object-fit:cover;border-radius:${borderRadius};`,
        });
        img.src = safePhotos[0];
        img.alt = altText;
        return img;
      }

      const wrapper = createElement("div", {
        style: `position:relative;width:100%;height:${height};border-radius:${borderRadius};overflow:hidden;`,
      });
      const imgs: HTMLImageElement[] = [];
      const dots: HTMLDivElement[] = [];
      let current = 0;

      safePhotos.forEach((src, index) => {
        const img = createElement("img", {
          style: `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${index === 0 ? 1 : 0};transition:opacity 0.25s;`,
        });
        img.src = src;
        img.alt = altText;
        imgs.push(img);
        wrapper.appendChild(img);
      });

      const controls = createElement("div", {
        style: "position:absolute;inset:0;pointer-events:none;",
      });

      const dotsWrap = createElement("div", {
        style:
          "position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2;",
      });

      function showSlide(index: number) {
        imgs.forEach((img, imgIndex) => {
          img.style.opacity = imgIndex === index ? "1" : "0";
        });
        dots.forEach((dot, dotIndex) => {
          dot.style.background =
            dotIndex === index ? "white" : "rgba(255,255,255,0.5)";
        });
        current = index;
      }

      function createCarouselButton(
        direction: "prev" | "next",
        label: string,
        symbol: string
      ) {
        const button = createElement("button", {
          textContent: symbol,
          style: `position:absolute;${direction === "prev" ? "left:6px;" : "right:6px;"}top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;cursor:pointer;font-size:18px;font-weight:600;line-height:26px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.15);z-index:2;pointer-events:auto;`,
        });
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          showSlide(
            direction === "next"
              ? (current + 1) % safePhotos.length
              : (current - 1 + safePhotos.length) % safePhotos.length
          );
        });
        return button;
      }

      controls.appendChild(createCarouselButton("prev", "Previous photo", "‹"));
      controls.appendChild(createCarouselButton("next", "Next photo", "›"));

      safePhotos.forEach((_, index) => {
        const dot = createElement("div", {
          style: `width:6px;height:6px;border-radius:50%;background:${index === 0 ? "white" : "rgba(255,255,255,0.5)"};transition:background 0.2s;`,
        });
        dots.push(dot);
        dotsWrap.appendChild(dot);
      });

      wrapper.appendChild(controls);
      wrapper.appendChild(dotsWrap);

      return wrapper;
    }

    function createListingCardElement(listing: Listing): HTMLAnchorElement {
      const price = Math.round(
        listing.totalPrice || listing.prices?.basePrice || 0
      );
      const slug = getListingSlug(
        listing.title || listing.nickname,
        listing.guesty_id
      );
      const thumb = sanitizeImageUrl(
        listing.picture || (listing.pictures && listing.pictures[0]) || ""
      );
      const link = createElement("a", {
        style:
          "text-decoration:none;color:inherit;display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #eee;",
      });
      link.href = `/properties/${slug}`;

      if (thumb) {
        const img = createElement("img", {
          style:
            "width:90px;height:68px;object-fit:cover;border-radius:6px;flex-shrink:0;",
        });
        img.src = thumb;
        img.alt = listing.title || listing.nickname || "Property photo";
        link.appendChild(img);
      } else {
        link.appendChild(
          createElement("div", {
            style:
              "width:90px;height:68px;background:#f0f0f0;border-radius:6px;flex-shrink:0;",
          })
        );
      }

      const content = createElement("div", {
        style: "min-width:0;flex:1;",
      });
      content.appendChild(
        createElement("div", {
          textContent: listing.title || listing.nickname || "",
          style:
            "font-weight:600;font-size:13px;color:#1c1c1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
        })
      );
      content.appendChild(
        createElement("div", {
          textContent: `${listing.bedrooms || 0} bed · ${listing.bathrooms || 0} bath · ${listing.accommodates || 0} guests`,
          style: "font-size:11px;color:#666;margin-top:2px;",
        })
      );

      if (!hidePriceRef.current) {
        content.appendChild(
          createElement("div", {
            textContent: `$${price}${listing.totalPrice ? " total" : "/night"}`,
            style:
              "font-weight:700;font-size:13px;color:#1c1c1c;margin-top:2px;",
          })
        );
      }

      link.appendChild(content);
      return link;
    }

    function openPopup(coords: [number, number], group: Listing[]) {
      if (activePopup) {
        activePopup.remove();
        activePopup = null;
      }

      const content = createElement("div");
      if (group.length === 1) {
        // Single listing popup
        const listing = group[0];
        const price = Math.round(
          listing.totalPrice || listing.prices?.basePrice || 0
        );
        const slug = getListingSlug(
          listing.title || listing.nickname,
          listing.guesty_id
        );
        const photos = getPhotos(listing);
        const title = listing.title || listing.nickname || "Property photo";
        const carousel = createCarouselElement(photos, "170px", "8px", title);
        if (carousel) {
          content.appendChild(carousel);
        }

        const link = createElement("a", {
          style:
            "text-decoration:none;color:inherit;display:block;margin-top:8px;",
        });
        link.href = `/properties/${slug}`;
        link.appendChild(
          createElement("div", {
            textContent: listing.title || listing.nickname || "",
            style:
              "font-weight:600;font-size:14px;margin-bottom:4px;color:#1c1c1c;",
          })
        );
        link.appendChild(
          createElement("div", {
            textContent: `${listing.bedrooms || 0} bed · ${listing.bathrooms || 0} bath · ${listing.accommodates || 0} guests`,
            style: `font-size:12px;color:#666;${hidePriceRef.current ? "" : "margin-bottom:4px;"}`,
          })
        );

        if (!hidePriceRef.current) {
          link.appendChild(
            createElement("div", {
              textContent: `$${price}${listing.totalPrice ? " total" : "/night"}`,
              style: "font-weight:700;font-size:14px;color:#1c1c1c;",
            })
          );
        }

        content.appendChild(link);
      } else {
        // Multiple listings — scrollable card list
        content.appendChild(
          createElement("div", {
            textContent: `${group.length} properties at this location`,
            style:
              "font-weight:700;font-size:13px;color:#1c1c1c;margin-bottom:6px;",
          })
        );
        const cardsWrap = createElement("div", {
          style:
            "max-height:300px;overflow-y:auto;overscroll-behavior:contain;",
        });
        group.forEach((listing) => {
          cardsWrap.appendChild(createListingCardElement(listing));
        });
        content.appendChild(cardsWrap);
      }

      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: true,
        maxWidth: group.length === 1 ? "280px" : "320px",
      })
        .setLngLat(coords)
        .setDOMContent(content)
        .addTo(m);

      const popupEl = popup.getElement();
      if (popupEl) {
        // Make links work reliably on mobile — use touchend since Mapbox
        // intercepts touch events for pan/zoom, making click unreliable
        popupEl
          .querySelectorAll<HTMLAnchorElement>("a[href]")
          .forEach((link) => {
            let startX = 0,
              startY = 0;
            link.addEventListener(
              "touchstart",
              (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
              },
              { passive: true }
            );
            link.addEventListener("touchend", (e) => {
              const dx = Math.abs(e.changedTouches[0].clientX - startX);
              const dy = Math.abs(e.changedTouches[0].clientY - startY);
              if (dx < 10 && dy < 10) {
                e.preventDefault();
                window.location.href = link.getAttribute("href")!;
              }
            });
            // Keep click handler for desktop
            link.addEventListener("click", (e) => {
              e.preventDefault();
              window.location.href = link.getAttribute("href")!;
            });
          });
      }

      activePopup = popup;
      popup.on("close", () => {
        if (activePopup === popup) activePopup = null;
      });
    }

    // Close popup when clicking the map background (not inside popup)
    m.on("click", (e) => {
      if (!activePopup) return;
      const popupEl = activePopup.getElement();
      if (popupEl && popupEl.contains(e.originalEvent.target as Node)) return;
      activePopup.remove();
      activePopup = null;
    });

    // Create one HTML marker per unique coordinate group
    // We track which coordinate key each marker belongs to, plus the member IDs
    const coordKeyToMarkerKey = new Map<string, string>(); // coordKey -> first guesty_id (used as marker map key)
    const markerMemberIds = new Map<string, string[]>(); // marker key -> all guesty_ids in group

    coordGroups.forEach((group, coordKey) => {
      const first = group[0];
      const coords: [number, number] = groupFuzzedCenter.get(coordKey)!;
      const markerKey = first.guesty_id;

      coordKeyToMarkerKey.set(coordKey, markerKey);
      markerMemberIds.set(
        markerKey,
        group.map((l) => l.guesty_id)
      );
      // Build reverse lookup for highlighting
      group.forEach((l) =>
        listingToMarkerKeyRef.current.set(l.guesty_id, markerKey)
      );

      const el = document.createElement("div");
      el.className = "property-marker";
      el.style.cssText = "display: none; cursor: pointer; outline: none;";

      const pill = document.createElement("div");

      pill.dataset.markerKey = markerKey;

      if (group.length > 1) {
        // Grouped marker — show count
        pill.dataset.grouped = "true";
        pill.innerHTML = `${group.length}`;
        pill.style.cssText = `
          background: #3d6b66;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          white-space: nowrap;
          border: 2px solid white;
          transition: transform 0.15s, box-shadow 0.15s;
        `;
      } else if (hidePriceRef.current) {
        pill.dataset.hidePrice = "true";
        pill.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        pill.style.cssText = `
          background: white;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3d6b66;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          border: 1px solid rgba(0,0,0,0.08);
          transition: transform 0.15s, box-shadow 0.15s;
        `;
      } else {
        const price = Math.round(
          first.totalPrice || first.prices?.basePrice || 0
        );
        pill.innerHTML = `$${price}`;
        pill.style.cssText = `
          background: white;
          border-radius: 20px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #1c1c1c;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          white-space: nowrap;
          border: 1px solid rgba(0,0,0,0.08);
          transition: transform 0.15s, box-shadow 0.15s;
        `;
      }
      el.appendChild(pill);

      pill.addEventListener("mouseenter", () => {
        pill.style.transform = "scale(1.1)";
        pill.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
        el.style.zIndex = "10";
      });
      pill.addEventListener("mouseleave", () => {
        pill.style.transform = "scale(1)";
        pill.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
        el.style.zIndex = "1";
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        if (isMobile && group.length === 1 && onMarkerClickRef.current) {
          onMarkerClickRef.current(first.guesty_id);
        } else {
          openPopup(coords, group);
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(coords)
        .addTo(m);
      markersRef.current.set(markerKey, marker);
    });

    m.on("load", () => {
      m.addSource("properties", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 60,
      });

      // Cluster circles
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "properties",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3d6b66",
            10,
            "#2d5550",
            30,
            "#1d3f3b",
          ],
          "circle-radius": ["step", ["get", "point_count"], 22, 10, 28, 30, 36],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster count labels
      m.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "properties",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });

      // Invisible unclustered layer for querying
      m.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "properties",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });

      // Click clusters to zoom
      m.on("click", "clusters", (e) => {
        const clusterFeatures = m.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        if (!clusterFeatures.length) return;
        const clusterId = Number(clusterFeatures[0].properties?.cluster_id);
        if (!Number.isFinite(clusterId)) return;
        const source = m.getSource("properties") as ClusteredGeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const geo = clusterFeatures[0].geometry;
          if (geo.type === "Point") {
            m.easeTo({ center: geo.coordinates as [number, number], zoom });
          }
        });
      });
      m.on("mouseenter", "clusters", () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "clusters", () => {
        m.getCanvas().style.cursor = "";
      });

      // Dismiss carousel on user map interaction (but not programmatic pans or initial fitBounds)
      let mapSettled = false;
      const interactionEvents = ["dragstart", "zoomstart"] as const;
      interactionEvents.forEach((evt) => {
        m.on(evt, () => {
          if (mapSettled && !isProgrammaticMoveRef.current) {
            onMapInteractionRef.current?.();
          }
        });
      });

      function updateMarkerVisibility() {
        if (!map.current) return;
        const canvas = m.getCanvas();
        if (!canvas) return;
        const sw: mapboxgl.PointLike = [0, canvas.height];
        const ne: mapboxgl.PointLike = [canvas.width, 0];
        const rendered = m.queryRenderedFeatures([sw, ne], {
          layers: ["unclustered-point"],
        });
        const visibleIds = new Set<string>();
        rendered.forEach((f) => {
          if (f.properties?.id) visibleIds.add(f.properties.id);
        });

        // Show/hide grouped markers: show if ANY member ID is visible
        markersRef.current.forEach((marker, markerKey) => {
          const memberIds = markerMemberIds.get(markerKey) || [markerKey];
          const anyVisible = memberIds.some((id) => visibleIds.has(id));
          marker.getElement().style.display = anyVisible ? "" : "none";
        });

        // Report visible IDs to parent based on map viewport
        if (userInteracted) {
          const allVisibleIds = new Set<string>();
          // Use container dimensions (CSS pixels) to match m.project() output
          // Subtract bottomPadding to exclude area behind the mobile bottom sheet
          const container = m.getContainer();
          const w = container.clientWidth;
          const h = container.clientHeight - (bottomPaddingRef.current || 0);
          validListings.forEach((listing) => {
            const fuzzed = fuzzedCoords.get(listing.guesty_id);
            if (!fuzzed) return;
            const pt = m.project(fuzzed as [number, number]);
            if (pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h) {
              allVisibleIds.add(listing.guesty_id);
            }
          });
          onVisibleRef.current?.(allVisibleIds);
        }
      }

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      let userInteracted = false;

      function debouncedUpdate() {
        if (!settled) return;
        userInteracted = true;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateMarkerVisibility, 300);
      }
      m.on("moveend", debouncedUpdate);
      m.on("zoomend", debouncedUpdate);

      // Fit bounds, then settle
      const coords = features.map(
        (f) => f.geometry.coordinates as [number, number]
      );
      if (coords.length > 1) {
        const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
        coords.forEach((c) => bounds.extend(c));
        m.fitBounds(bounds, {
          padding: {
            top: 50,
            left: 50,
            right: 50,
            bottom: 50 + (bottomPaddingRef.current || 0),
          },
          maxZoom: 14,
        });
      }

      // After fitBounds settles, show markers and report visible listings
      setTimeout(() => {
        if (!map.current) return;
        settled = true;
        mapSettled = true;
        userInteracted = true;
        try {
          updateMarkerVisibility();
        } catch {
          // Map was removed before timeout fired
        }
      }, 1800);
    });

    const currentMarkers = markersRef.current;
    return () => {
      if (activePopup) activePopup.remove();
      currentMarkers.forEach((marker) => marker.remove());
      currentMarkers.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [listings]);

  // Highlight selected marker and pan map to it
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach((marker, markerKey) => {
      const pill = marker
        .getElement()
        .querySelector("[data-marker-key]") as HTMLElement | null;
      if (!pill || pill.dataset.grouped === "true") return;

      if (
        selectedListingId &&
        listingToMarkerKeyRef.current.get(selectedListingId) === markerKey
      ) {
        pill.style.background = "#1c1c1c";
        pill.style.color = "white";
        pill.style.borderColor = "#1c1c1c";
        marker.getElement().style.zIndex = "10";
      } else {
        pill.style.background = "white";
        pill.style.color =
          pill.dataset.hidePrice === "true" ? "#3d6b66" : "#1c1c1c";
        pill.style.borderColor = "rgba(0,0,0,0.08)";
        marker.getElement().style.zIndex = "1";
      }
    });

    // Pan to selected marker if near edge of viewport
    if (selectedListingId && map.current) {
      const coords = fuzzedCoordsRef.current.get(selectedListingId);
      if (coords) {
        const m = map.current;
        const point = m.project(coords as [number, number]);
        const canvas = m.getCanvas();
        const padding = 60;
        const needsPan =
          point.x < padding ||
          point.x > canvas.width - padding ||
          point.y < padding ||
          point.y > canvas.height - padding;

        if (needsPan) {
          isProgrammaticMoveRef.current = true;
          m.easeTo({ center: coords as [number, number], duration: 300 });
          setTimeout(() => {
            isProgrammaticMoveRef.current = false;
          }, 400);
        }
      }
    }
  }, [selectedListingId]);

  // When bottomPadding changes (sheet expand/collapse), refit to currently visible properties
  const prevBottomPaddingRef = useRef(bottomPadding);
  useEffect(() => {
    if (prevBottomPaddingRef.current === bottomPadding) return;
    const prevPadding = prevBottomPaddingRef.current;
    prevBottomPaddingRef.current = bottomPadding;
    const m = map.current;
    if (!m) return;
    // Collect properties that were visible with the previous padding
    const container = m.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight - (prevPadding || 0);
    const visibleCoords: [number, number][] = [];
    fuzzedCoordsRef.current.forEach((coords) => {
      const pt = m.project(coords as [number, number]);
      if (pt.x >= 0 && pt.x <= w && pt.y >= 0 && pt.y <= h) {
        visibleCoords.push(coords);
      }
    });
    if (visibleCoords.length < 2) return;
    // Refit to just those properties, centered in the new space
    const bounds = new mapboxgl.LngLatBounds(
      visibleCoords[0],
      visibleCoords[0]
    );
    visibleCoords.forEach((c) => bounds.extend(c));
    isProgrammaticMoveRef.current = true;
    m.fitBounds(bounds, {
      padding: { top: 50, left: 50, right: 50, bottom: 50 + bottomPadding },
      maxZoom: 14,
      duration: 500,
    });
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 600);
  }, [bottomPadding]);

  return (
    <>
      <style jsx global>{`
        .mapboxgl-ctrl-top-right {
          top: 10px !important;
          right: 10px !important;
        }
        .mapboxgl-ctrl-group {
          background: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          border: none !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
        }
        .mapboxgl-ctrl-group button {
          width: 40px !important;
          height: 40px !important;
          background: white !important;
          border: none !important;
          border-radius: 10px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
          cursor: pointer !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background: #f5f5f5 !important;
        }
        .mapboxgl-ctrl-group button + button {
          border-top: none !important;
          margin-top: 0 !important;
        }
        .mapboxgl-ctrl-group button svg {
          display: block;
          margin: auto;
        }
        .mapboxgl-marker {
          outline: none !important;
        }
        .mapboxgl-marker:focus {
          outline: none !important;
        }
        .mapboxgl-popup {
          z-index: 50 !important;
        }
        .mapboxgl-popup-content {
          border-radius: 12px !important;
          padding: 12px !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2) !important;
          background: white !important;
        }
        .mapboxgl-popup-close-button {
          font-size: 20px !important;
          padding: 2px 8px !important;
          color: #666 !important;
          z-index: 1 !important;
          background: rgba(255, 255, 255, 0.8) !important;
          border-radius: 50% !important;
          right: 4px !important;
          top: 4px !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
        @media (max-width: 767px) {
          .mapboxgl-ctrl-bottom-left,
          .mapboxgl-ctrl-bottom-right {
            display: none !important;
          }
        }
      `}</style>
      <div className="h-full w-full p-0 md:p-4">
        <div
          ref={mapContainer}
          className="h-full w-full overflow-hidden rounded-none md:rounded-2xl"
        />
      </div>
    </>
  );
}
