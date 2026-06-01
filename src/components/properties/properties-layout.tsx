"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Map } from "lucide-react";
import { format, parse } from "date-fns";
import dynamic from "next/dynamic";
import { type Listing } from "@/lib/supabase";
import { PropertyGrid } from "./property-grid";
import { MapCardCarousel } from "./map-card-carousel";
import { CategoryPills } from "./category-pills";

const PropertyMap = dynamic(
  () => import("./property-map").then((m) => ({ default: m.PropertyMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-2xl bg-muted" />
    ),
  }
);

const PAGE_SIZE = 16;

// Bottom sheet snap points (percentage of viewport height from top)
const SNAP_MAP = 92; // sheet collapsed — full map visible, just handle + count showing
const SNAP_HALF = 55; // sheet covers bottom 45%
const SNAP_FULL = 0; // sheet covers full screen (behind header)

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
}

// Map-center coordinates for each Traverse market. Used as a hint to
// PropertyMap when an over-narrow filter returns 0 listings — without
// this the map can't fit-bounds to anything and would land on its
// hardcoded default (CB downtown), which is misleading for a "Leadville"
// or "Vail" search that returned empty. [lng, lat] order for Mapbox.
const MARKET_CENTERS: Record<string, [number, number]> = {
  "crested butte": [-106.9784, 38.8697],
  "mt. crested butte": [-106.9645, 38.9097],
  "mt crested butte": [-106.9645, 38.9097],
  leadville: [-106.2925, 39.2508],
  "twin lakes": [-106.3753, 39.0808],
  vail: [-106.3742, 39.6403],
  avon: [-106.5217, 39.6315],
  granby: [-105.9419, 40.0867],
};

function inferMarketCenter(
  cityParam: string | undefined | null,
  listings: Listing[]
): [number, number] | undefined {
  if (cityParam) {
    const key = cityParam.trim().toLowerCase();
    if (MARKET_CENTERS[key]) return MARKET_CENTERS[key];
  }
  // Fall back to the first listing's address if no city param matched.
  const first = listings.find((l) => l.address?.lat && l.address?.lng);
  if (first?.address) {
    return [first.address.lng, first.address.lat];
  }
  return undefined;
}

export function PropertiesLayout({
  listings,
  dateFiltered,
  checkIn,
  checkOut,
  showCachedPricing,
  cityParam,
}: {
  listings: Listing[];
  dateFiltered?: boolean;
  checkIn?: string;
  checkOut?: string;
  showCachedPricing?: boolean;
  /** Pass-through of the `?city=` URL param so the map can hint-center
   *  on that market when listings is empty. */
  cityParam?: string;
}) {
  // Resolve the initial map center from the URL hint, with a safe fallback.
  const initialCenter = inferMarketCenter(cityParam, listings);
  // On mobile, hide the footer since this page uses a fixed full-screen layout.
  // Without this, the footer renders in flow behind the fixed map and is visible
  // through the header gap.
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || window.matchMedia("(min-width: 768px)").matches) return;
    footer.style.display = "none";
    return () => {
      footer.style.display = "";
    };
  }, []);

  // Stable key that changes when the listing set changes, forcing map remount
  const mapKey = listings.map((l) => l.guesty_id).join(",");

  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);
  const [page, setPage] = useState(1);
  const [mobileLimit, setMobileLimit] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track the bottom nav's rendered height so the Map button always clears it.
  // Uses ResizeObserver to handle late safe-area-inset application and orientation changes.
  const [navHeight, setNavHeight] = useState(72);
  useEffect(() => {
    const nav = document.getElementById("mobile-bottom-nav");
    if (!nav) return;
    const update = () => setNavHeight(nav.getBoundingClientRect().height + 12);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Bottom sheet state (mobile only)
  const [sheetTop, setSheetTop] = useState(SNAP_HALF);
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Map card carousel state (mobile only)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null
  );
  const [carouselListings, setCarouselListings] = useState<Listing[]>([]);
  const [carouselDismissing, setCarouselDismissing] = useState(false);

  const visibleListingsRef = useRef<Listing[]>([]);

  const handleMarkerClick = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
    // Build carousel order: tapped listing first, rest after (use map-visible listings)
    const vl = visibleListingsRef.current;
    const idx = vl.findIndex((l) => l.guesty_id === listingId);
    if (idx > 0) {
      setCarouselListings([...vl.slice(idx), ...vl.slice(0, idx)]);
    } else {
      setCarouselListings([...vl]);
    }
    // Hide bottom sheet + bottom nav
    if (sheetRef.current) {
      sheetRef.current.style.transition = "top 0.3s ease-out";
      sheetRef.current.style.top = "100%";
    }
    window.dispatchEvent(new Event("map-visible"));
  }, []);

  const handleMapInteraction = useCallback(() => {
    setSelectedListingId((prev) => {
      if (prev) {
        // Trigger fade-out animation, then clean up
        setCarouselDismissing(true);
      }
      return null;
    });
  }, []);

  const handleCarouselSelectedChange = useCallback((listingId: string) => {
    setSelectedListingId(listingId);
  }, []);

  const handleCarouselDismissStart = useCallback(() => {
    // Start restoring the sheet immediately when carousel begins its fade-out
    if (sheetRef.current) {
      sheetRef.current.style.transition = "top 0.3s ease-out";
      sheetRef.current.style.top = `${SNAP_MAP}%`;
    }
  }, []);

  const handleCarouselClose = useCallback(() => {
    setSelectedListingId(null);
    setCarouselListings([]);
    setCarouselDismissing(false);
    setTimeout(() => setSheetTop(SNAP_MAP), 50);
  }, []);

  const handleVisibleListingsChange = useCallback((ids: Set<string>) => {
    setVisibleIds((prev) => {
      if (prev && prev.size === ids.size) {
        let same = true;
        const idsArr = Array.from(ids);
        for (let i = 0; i < idsArr.length; i++) {
          if (!prev.has(idsArr[i])) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return ids;
    });
  }, []);

  // Filter listings to only those visible on the map.
  //
  // Defensive: when the `listings` prop changes (URL/filter change → new
  // server response), the prior visibleIds set still holds map-viewport
  // ids from the OLD listings. The useEffect below clears visibleIds, but
  // the first render after the prop change happens BEFORE that effect
  // fires — so visibleIds.has(...) matches none of the new listings and
  // we'd render an empty grid for one frame ("No properties found" flash
  // when changing the location dropdown). Falling back to the full
  // listings array when the filter wipes everything avoids the flash.
  // The map's next viewport change repopulates visibleIds with current
  // ids; if the user genuinely panned off all listings, we'd rather show
  // them everything than a "no results" panel.
  const filteredByMap = visibleIds
    ? listings.filter((l) => visibleIds.has(l.guesty_id))
    : listings;
  const visibleListings =
    visibleIds && filteredByMap.length === 0 ? listings : filteredByMap;
  visibleListingsRef.current = visibleListings;

  // Reset visibleIds when the listings prop changes (new search)
  const prevListingsRef = useRef(listings);
  useEffect(() => {
    if (prevListingsRef.current !== listings) {
      setVisibleIds(null);
      setPage(1);
      setMobileLimit(PAGE_SIZE);
      setSelectedListingId(null);
      setCarouselListings([]);
    }
    prevListingsRef.current = listings;
  }, [listings]);

  // Reset to page 1 when visible listings change (desktop pagination only)
  const prevVisibleRef = useRef(visibleListings.length);
  useEffect(() => {
    if (prevVisibleRef.current !== visibleListings.length) {
      setPage(1);
      // Don't reset mobileLimit here — the map fires visibility changes
      // while scrolling on mobile, which would reset infinite scroll progress
    }
    prevVisibleRef.current = visibleListings.length;
  }, [visibleListings.length]);

  // Paginate (desktop)
  const totalPages = Math.ceil(visibleListings.length / PAGE_SIZE);
  const pagedListings = visibleListings.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // Infinite scroll (mobile)
  const mobileListings = visibleListings.slice(0, mobileLimit);
  const hasMoreMobile = mobileLimit < visibleListings.length;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMobileLimit((prev) =>
            Math.min(prev + PAGE_SIZE, visibleListings.length)
          );
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleListings.length]);

  const goToPage = (p: number) => {
    setPage(p);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Prevent mobile viewport from scrolling/pull-to-refresh when sheet is open
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, []);

  const isFullScreen = sheetTop <= SNAP_FULL + 2;
  const listingsRef = useRef<HTMLDivElement>(null);
  const pullDownRef = useRef(false); // true when we've hijacked a scroll-down into a sheet drag
  const startXRef = useRef(0);
  const directionLocked = useRef<"vertical" | "horizontal" | null>(null);

  // Track the live drag position without re-renders
  const liveTopRef = useRef(sheetTop);
  liveTopRef.current = sheetTop;

  // Touch handlers for bottom sheet drag — uses direct DOM updates during drag
  function onTouchStart(e: React.TouchEvent) {
    dragRef.current = {
      startY: e.touches[0].clientY,
      startTop: liveTopRef.current,
    };
    startXRef.current = e.touches[0].clientX;
    pullDownRef.current = false;
    directionLocked.current = null;
    // Disable CSS transition during drag for instant response
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragRef.current) return;

    const dy = e.touches[0].clientY - dragRef.current.startY;
    const dx = e.touches[0].clientX - startXRef.current;

    // Lock direction on first significant movement to avoid conflicts
    // between horizontal photo swipe and vertical sheet drag
    if (!directionLocked.current) {
      const absDy = Math.abs(dy);
      const absDx = Math.abs(dx);
      if (absDy < 8 && absDx < 8) return; // not enough movement yet
      directionLocked.current = absDy > absDx ? "vertical" : "horizontal";
    }

    // If gesture is horizontal, let the photo carousel handle it
    if (directionLocked.current === "horizontal") return;

    // When full screen, only start dragging sheet if:
    // - swiping down AND listings are scrolled to top
    // - or we already started a pull-down drag
    if (isFullScreen && !pullDownRef.current) {
      const scrollTop = listingsRef.current?.scrollTop ?? 0;
      if (dy > 0 && scrollTop <= 0) {
        pullDownRef.current = true;
        // Lock the listings scroll so browser doesn't rubber-band it
        // while we drag the whole sheet down
        if (listingsRef.current) {
          listingsRef.current.style.overflowY = "hidden";
          listingsRef.current.style.touchAction = "none";
          listingsRef.current.style.pointerEvents = "none";
        }
        dragRef.current.startY = e.touches[0].clientY;
        dragRef.current.startTop = liveTopRef.current;
      } else {
        return;
      }
    }

    // Not full screen or pulling down — prevent scroll and move sheet via DOM
    if (!isFullScreen || pullDownRef.current) {
      e.preventDefault();
      const vh = window.innerHeight;
      const deltaPercent = (dy / vh) * 100;
      const newTop = Math.max(
        SNAP_FULL,
        Math.min(SNAP_MAP + 5, dragRef.current.startTop + deltaPercent)
      );
      liveTopRef.current = newTop;
      // Direct DOM update — no React re-render
      if (sheetRef.current) {
        sheetRef.current.style.top = `${newTop}%`;
      }
    }
  }

  function restoreListingsScroll(snapTarget: number) {
    if (!listingsRef.current) return;
    const willBeFullScreen = snapTarget <= SNAP_FULL + 2;
    listingsRef.current.style.overflowY = willBeFullScreen ? "auto" : "hidden";
    listingsRef.current.style.touchAction = willBeFullScreen ? "pan-y" : "none";
    listingsRef.current.style.pointerEvents = willBeFullScreen
      ? "auto"
      : "none";
  }

  function onTouchEnd() {
    if (!dragRef.current) return;
    pullDownRef.current = false;

    // If sheet barely moved, don't snap — just restore to start position
    if (Math.abs(liveTopRef.current - dragRef.current.startTop) < 2) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = "top 0.15s ease-out";
        sheetRef.current.style.top = `${dragRef.current.startTop}%`;
      }
      liveTopRef.current = dragRef.current.startTop;
      restoreListingsScroll(dragRef.current.startTop);
      dragRef.current = null;
      return;
    }

    // Snap to nearest point
    const snapPoints = [SNAP_FULL, SNAP_HALF, SNAP_MAP];
    let closest = snapPoints[0];
    let closestDist = Math.abs(liveTopRef.current - closest);
    for (const sp of snapPoints) {
      const dist = Math.abs(liveTopRef.current - sp);
      if (dist < closestDist) {
        closest = sp;
        closestDist = dist;
      }
    }

    // Animate snap via DOM first (no re-render), then sync React state after
    liveTopRef.current = closest;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "top 0.3s ease-out";
      sheetRef.current.style.top = `${closest}%`;
    }
    restoreListingsScroll(closest);
    dragRef.current = null;

    // Tell bottom nav to hide/show based on whether map is exposed
    window.dispatchEvent(
      new Event(closest >= SNAP_MAP - 5 ? "map-visible" : "map-hidden")
    );

    // Sync React state after animation completes to avoid blocking the transition
    setTimeout(() => setSheetTop(closest), 320);
  }

  const countText =
    visibleListings.length === listings.length
      ? `${listings.length} properties${dateFiltered ? " available" : ""}`
      : `${visibleListings.length} of ${listings.length} properties${dateFiltered ? " available" : ""}`;

  const dateText =
    dateFiltered && checkIn && checkOut
      ? ` for ${format(parse(checkIn, "yyyy-MM-dd", new Date()), "MMM d")} – ${format(parse(checkOut, "yyyy-MM-dd", new Date()), "MMM d, yyyy")}`
      : "";

  return (
    <>
      {/* ===== DESKTOP: side-by-side (unchanged) ===== */}
      <div className="hidden md:contents">
        {/* Left: listings */}
        <div
          ref={scrollRef}
          className="w-1/2 overflow-y-auto px-4 pt-8 pb-8 sm:px-6"
        >
          <p className="mb-4 text-base font-medium text-foreground">
            {countText}
            {dateText && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {dateText}
              </span>
            )}
          </p>
          <CategoryPills />
          <div className="mt-4" />
          <PropertyGrid
            listings={pagedListings}
            hidePrice={!dateFiltered && !showCachedPricing}
          />

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-1">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                aria-label="Previous page"
              >
                &#8249;
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="flex h-10 w-10 items-center justify-center text-sm text-muted-foreground"
                  >
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-foreground text-white"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                aria-label="Next page"
              >
                &#8250;
              </button>
            </div>
          )}
        </div>

        {/* Right: map */}
        <div className="sticky top-16 h-[calc(100vh-64px)] w-1/2">
          <PropertyMap
            listings={listings}
            onVisibleListingsChange={handleVisibleListingsChange}
            hidePrice={!dateFiltered}
            initialCenter={initialCenter}
            initialZoom={cityParam ? 11 : undefined}
            key={mapKey}
          />
        </div>
      </div>

      {/* ===== MOBILE: map + bottom sheet ===== */}
      <div
        className="md:hidden fixed inset-x-0 top-16 bottom-0"
        style={{ overscrollBehavior: "none" }}
      >
        {/* Full-screen map behind */}
        <div className="absolute inset-0">
          <PropertyMap
            listings={listings}
            onVisibleListingsChange={handleVisibleListingsChange}
            hidePrice={!dateFiltered}
            initialCenter={initialCenter}
            initialZoom={cityParam ? 11 : undefined}
            key={`mobile-${mapKey}`}
            bottomPadding={
              selectedListingId || sheetTop >= SNAP_MAP - 5
                ? 50
                : Math.round((1 - SNAP_HALF / 100) * 800)
            }
            onMarkerClick={handleMarkerClick}
            onMapInteraction={handleMapInteraction}
            selectedListingId={selectedListingId}
          />
        </div>

        {/* Bottom sheet */}
        <div
          ref={sheetRef}
          className="absolute inset-x-0 bottom-0 z-[60] flex flex-col bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
          style={{
            top: `${sheetTop}%`,
            transition: dragRef.current ? "none" : "top 0.3s ease-out",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Drag handle */}
          <div
            data-sheet-handle
            className="flex flex-col items-center pt-3 pb-5 cursor-grab"
          >
            <div className="h-1 w-10 rounded-full bg-border" />
            <p className="mt-3 text-base font-semibold text-foreground">
              {countText}
            </p>
          </div>

          {/* Scrollable listings — only scrolls when sheet is full screen */}
          <div
            ref={listingsRef}
            className="flex-1 px-4 pb-8"
            style={{
              overflowY: isFullScreen ? "auto" : "hidden",
              touchAction: isFullScreen ? "pan-y" : "none",
              pointerEvents: isFullScreen ? "auto" : "none",
              overscrollBehavior: "none",
            }}
          >
            <PropertyGrid
              listings={mobileListings}
              hidePrice={!dateFiltered && !showCachedPricing}
              disableSwipe={!isFullScreen}
              lazyCarousel
            />

            {hasMoreMobile && <div ref={sentinelRef} className="h-1" />}
          </div>

          {/* Floating Map button */}
          <button
            onClick={() => {
              if (sheetRef.current) {
                sheetRef.current.style.transition = "top 0.3s ease-out";
                sheetRef.current.style.top = `${SNAP_MAP}%`;
              }
              listingsRef.current?.scrollTo({ top: 0 });
              window.dispatchEvent(new Event("map-visible"));
              setTimeout(() => setSheetTop(SNAP_MAP), 320);
            }}
            className="fixed left-1/2 z-[65] flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white shadow-lg active:scale-95 transition-all duration-300 ease-out"
            style={{
              bottom: `${navHeight}px`,
              opacity: isFullScreen ? 1 : 0,
              transform: `translateX(-50%) translateY(${isFullScreen ? "0px" : "16px"})`,
              pointerEvents: isFullScreen ? "auto" : "none",
            }}
          >
            Map
            <Map className="h-4 w-4" />
          </button>
        </div>

        {/* Map card carousel (shows when marker is tapped) */}
        {(selectedListingId || carouselDismissing) &&
          carouselListings.length > 0 && (
            <MapCardCarousel
              listings={carouselListings}
              selectedListingId={
                selectedListingId || carouselListings[0].guesty_id
              }
              onSelectedChange={handleCarouselSelectedChange}
              onClose={handleCarouselClose}
              onDismissStart={handleCarouselDismissStart}
              hidePrice={!dateFiltered}
              dismissing={carouselDismissing}
            />
          )}
      </div>
    </>
  );
}
