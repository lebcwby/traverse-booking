"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { format, parse } from "date-fns";
import {
  Users,
  Bed,
  Bath,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";
import { readSearchSelection, buildSearchQuery } from "@/lib/search-selection";
import { WishlistButton } from "@/components/wishlist-button";
import { SavingsPrice } from "@/components/properties/savings-price";
import { trackSelectListing } from "@/lib/tracking";

export function PropertyCard({
  listing,
  hidePrice,
  priority = false,
  disableSwipe = false,
  photoWidth = 800,
  maxPhotos,
  lazyCarousel = false,
  displayTitle,
  compact = false,
  hideCity = false,
  position,
}: {
  listing: Listing;
  hidePrice?: boolean;
  priority?: boolean;
  disableSwipe?: boolean;
  photoWidth?: number;
  maxPhotos?: number;
  lazyCarousel?: boolean;
  displayTitle?: string;
  compact?: boolean;
  hideCity?: boolean;
  position?: number;
}) {
  const rawPhotos = listing.pictures?.length
    ? listing.pictures.map((url) => getPhotoUrl(url, photoWidth))
    : [getPhotoUrl(listing.picture || "", photoWidth)];
  const cappedPhotos = maxPhotos ? rawPhotos.slice(0, maxPhotos) : rawPhotos;
  const [carouselActivated, setCarouselActivated] = useState(!lazyCarousel);
  // Only render first photo until user interacts (saves memory on mobile)
  const allPhotos = carouselActivated ? cappedPhotos : cappedPhotos.slice(0, 1);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const indexAtTouchStart = useRef(0);
  const didSwipeRef = useRef(false);
  const didMoveRef = useRef(false);

  // Pass date/guest params through to the detail page
  const detailParams = new URLSearchParams();
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = searchParams.get("guests");
  // Use cached dates if no search dates are set
  const linkCheckIn = checkIn || listing.cachedCheckIn;
  const linkCheckOut = checkOut || listing.cachedCheckOut;
  if (linkCheckIn) detailParams.set("checkIn", linkCheckIn);
  if (linkCheckOut) detailParams.set("checkOut", linkCheckOut);
  if (guests) detailParams.set("guests", guests);
  const qs = detailParams.toString();
  const slug = getListingSlug(
    listing.title || listing.nickname,
    listing.guesty_id
  );
  // Fall back to the persisted hero selection when this card has no dates of its
  // own (URL or cached) — upgraded post-mount to avoid a hydration mismatch.
  const hasDates = !!(linkCheckIn && linkCheckOut);
  const [storedQs, setStoredQs] = useState("");
  useEffect(() => {
    if (hasDates) return;
    const s = buildSearchQuery(readSearchSelection());
    if (s) setStoredQs(s);
  }, [hasDates]);
  const effectiveQs = hasDates ? qs : storedQs || qs;
  const detailHref = `/properties/${slug}${effectiveQs ? `?${effectiveQs}` : ""}`;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const newIndex = Math.round(scrollLeft / clientWidth);
    setActiveIndex(Math.max(0, Math.min(newIndex, allPhotos.length - 1)));
  }, [allPhotos.length]);

  function goTo(e: React.MouseEvent, dir: -1 | 1) {
    e.preventDefault();
    e.stopPropagation();
    if (!carouselActivated) setCarouselActivated(true);
    if (!scrollRef.current) return;
    const newIndex = Math.max(
      0,
      Math.min(activeIndex + dir, allPhotos.length - 1)
    );
    scrollRef.current.scrollTo({
      left: newIndex * scrollRef.current.clientWidth,
      behavior: "smooth",
    });
  }

  function onPhotoTouchStart(e: React.TouchEvent) {
    if (!carouselActivated) setCarouselActivated(true);
    touchStartXRef.current = e.touches[0].clientX;
    indexAtTouchStart.current = activeIndex;
    didSwipeRef.current = false;
  }

  function onPhotoTouchEnd() {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const dx = scrollLeft / clientWidth - indexAtTouchStart.current;
    // Clamp to at most 1 photo in either direction from where we started
    let target = indexAtTouchStart.current;
    if (dx > 0.15) target = indexAtTouchStart.current + 1;
    else if (dx < -0.15) target = indexAtTouchStart.current - 1;
    target = Math.max(0, Math.min(target, allPhotos.length - 1));
    didSwipeRef.current = target !== indexAtTouchStart.current;
    const targetLeft = target * clientWidth;
    // Force snap back — disable snap temporarily for reliable scroll from overscroll positions
    scrollRef.current.style.scrollSnapType = "none";
    scrollRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.style.scrollSnapType = "x mandatory";
        // Ensure final position is exact
        scrollRef.current.scrollLeft = targetLeft;
      }
    }, 350);
  }

  return (
    <Link
      href={detailHref}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
        didMoveRef.current = false;
      }}
      onTouchMove={(e) => {
        const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
        const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
        if (dx > 10 || dy > 10) didMoveRef.current = true;
      }}
      onClick={(e) => {
        if (didMoveRef.current) {
          e.preventDefault();
          didMoveRef.current = false;
          return;
        }
        trackSelectListing({
          id: listing.guesty_id,
          title: listing.nickname || listing.title || "",
          position,
          price: listing.totalPrice || listing.prices?.basePrice || 0,
          propertyType: listing.property_type || undefined,
        });
      }}
    >
      {/* Photo carousel */}
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <div
          ref={scrollRef}
          className={`flex h-full ${disableSwipe ? "overflow-hidden" : "snap-x snap-mandatory overflow-x-auto"}`}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: disableSwipe ? "pan-y" : "pan-x pan-y",
            overscrollBehaviorX: "contain",
          }}
          onScroll={handleScroll}
          onTouchStart={disableSwipe ? undefined : onPhotoTouchStart}
          onTouchEnd={disableSwipe ? undefined : onPhotoTouchEnd}
          onClick={(e) => {
            if (didSwipeRef.current) {
              e.preventDefault();
              didSwipeRef.current = false;
              return;
            }
            if (scrollRef.current) {
              const { scrollLeft } = scrollRef.current;
              if (
                Math.abs(
                  scrollLeft - activeIndex * scrollRef.current.clientWidth
                ) > 5
              ) {
                e.preventDefault();
              }
            }
          }}
        >
          {allPhotos.map((src, i) => (
            <div
              key={i}
              className="relative h-full min-w-full flex-none snap-start"
            >
              <Image
                src={src}
                alt={listing.title || "Colorado vacation rental"}
                fill
                className="object-cover"
                sizes="(max-width: 639px) 100vw, (max-width: 768px) 50vw, 25vw"
                priority={i === 0 && priority}
                loading={priority && i < 4 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>

        {/* Desktop arrows */}
        {allPhotos.length > 1 && (
          <>
            <button
              onClick={(e) => goTo(e, -1)}
              className={`absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition-opacity h-7 w-7 sm:group-hover:flex ${activeIndex === 0 ? "opacity-0" : "opacity-100"}`}
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={(e) => goTo(e, 1)}
              className={`absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition-opacity h-7 w-7 sm:group-hover:flex ${activeIndex >= allPhotos.length - 1 ? "opacity-0" : "opacity-100"}`}
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </>
        )}

        {/* Dot indicators — use full count so dots show before carousel is activated */}
        {cappedPhotos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {cappedPhotos.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i === activeIndex
                    ? "h-1.5 w-1.5 bg-white"
                    : "h-1.5 w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Traverse Favorite badge — fir 4.8+, rose 4.85+, bridge 4.95+ */}
        {listing.reviewAvg && listing.reviewAvg / 2 >= 4.8 && (
          <span
            className={`absolute left-2 top-2 z-10 flex items-center whitespace-nowrap rounded-full bg-white font-semibold text-[#1c1d1d] shadow-md ${compact ? "gap-1 py-1 pl-1.5 pr-2 text-[10px]" : "gap-1.5 py-1.5 pl-2.5 pr-3 text-xs"}`}
          >
            {listing.reviewAvg / 2 >= 4.95 ? (
              <img
                src="/badges/bridge-gold.png"
                alt=""
                className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0`}
                aria-hidden="true"
              />
            ) : listing.reviewAvg / 2 >= 4.85 ? (
              <svg
                viewBox="0 0 128 128"
                className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0`}
                aria-hidden="true"
              >
                <path
                  fill="#307D31"
                  d="M56.81,85.29l21.86,0.17c0,0-1.74,5.65-3.18,7.87c-2.35,3.6-3.52,5.44-4.52,9.13c-1.55,5.68-1.42,10.05-1.42,10.05s1.21-0.42,2.68,0c1.79,0.51,2.76,1.7,2.6,2.43c-0.15,0.65-2.14,0.21-3.52,1.59c-1.09,1.09-1.51,3.02-1.68,4.27c-0.17,1.26-0.34,2.85-2.68,3.18c-2.35,0.34-5.86,0.59-6.62-0.59c-0.75-1.17-0.34-21.61-0.34-21.61L56.81,85.29z"
                />
                <path
                  fill="#5C9823"
                  d="M56.56,80.76c-0.42,0.75-10.32,2.53-10.32,2.53s-3.31,1.77-4.56,7.55c-0.68,3.13-0.53,9.47-1.12,11.69c-0.84,3.18-4.36,5.03-4.19,5.78c0.17,0.75,3.24,0.7,5.61-0.34c5.36-2.35,6.3-7.21,8.04-11.39c1.68-4.02,4.86-6.13,4.86-6.13s-0.75,2.92-0.43,6.14c0.27,2.77,1.14,6.3,0,9.73c-1.09,3.27-2.62,5.24-2.01,5.54c0.46,0.22,5.92-0.33,8.1-5.11c2.41-5.28,2.58-9.61,4.02-12.71c1.59-3.43,4.62-4.89,4.62-4.89s2.15,1.26,4.78,4.94c2.93,4.1,5.38,7.55,6.96,9.67c3.7,4.98,8.83,6.55,8.99,5.71c0.25-1.34-2.47-3.49-3.02-6.11c-1.35-6.45,0.5-9.54-1.03-14.49c-2.2-7.15-7.39-7.28-9.19-7.62C76.25,81.19,56.56,80.76,56.56,80.76z"
                />
                <path
                  fill="#96010C"
                  d="M47.31,44.34c-1.13-1.01-17.87-13.21-17.87-13.21l-0.25-7.42c0,0-4.1-7.75,0.62-13.52c4.1-5.01,9.57-3.59,9.57-3.59s2.74-3.45,7.52-3.69c6.11-0.31,9.09,4.83,9.09,4.83l27.55,4.53l15.47,10.06c0,0,2.29-0.74,4.19,0.6c1.98,1.39,1.33,4.31,1.11,5.62c-0.21,1.25-20.65,17.56-20.65,17.56l2.14,31.96l-7.14,7.97c0,0-1,0.98-3.05,1.24c-1.19,0.15-2.72-0.33-2.72-0.33l-4.45-12.78L47.31,44.34z"
                />
                <path
                  fill="#AF0C1B"
                  d="M83.15,6.86l-3.72,0.28l-2.61,2.19l0.93,4.21c0,0,0.12,3.15-2.36,4.66c-2.48,1.51-7.35,3.99-7.35,3.99l-3.36,5.56c0,0-2.16-0.71-5.68-2.52c-3.29-1.7-7.5-5.58-7.5-5.58l-7.53-0.51c0,0-1.44-0.13-2.65,1.15c-1.74,1.86-1.12,5.8,2.29,9.41c3.28,3.47,10.38,7.7,11.96,8.87c1.58,1.17,3.99,2.67,5.36,3.44c1.32,0.74,2.9,1.8,3.59,1.67c0.69-0.14,1.71-2.49,4.94-4.76c3.23-2.27,6.39-4.19,11.55-5.98c5.16-1.79,10.11-3.85,11.62-4.81c1.51-0.96-0.55-7.49-2.41-11.48S83.28,6.45,83.15,6.86z"
                />
                <path
                  fill="#DB132C"
                  d="M65.07,23.98c-1.27,1.68-1.03,3.64-1.03,3.64s2.77,1.66,5.5,2.61c4.95,1.72,16.09,1.24,21.45-1.17s7.98-4.49,8.8-7.01c0.96-2.96,1.76-8.94-4-13.55c-6.6-5.29-16.56-2.4-16.56-1.02s3.99,0.28,3.99,5.29s-4.4,8.04-8.87,8.66C69.88,22.05,66.99,21.43,65.07,23.98z"
                />
                <path
                  fill="#F71538"
                  d="M42.24,19.65c0,0-0.51-2.02,1.17-3.64c2.54-2.48,5.78-3.78,7.63-5.78s4.48-5.79,10.93-6.67c9.56-1.31,15.74,2.27,17.12,6.67s-1.24,5.91-3.92,5.98c-2.68,0.07-4.17-1.19-9.08-0.34c-8.32,1.44-11.21,5.91-11.96,6.33c-0.76,0.41-3.23-1.03-6.6-1.93C45.1,19.62,43.34,19.78,42.24,19.65z"
                />
                <path
                  fill="#CD0E1F"
                  d="M69.62,48.38c0,0,1.7-5.65,7.25-9.23c5.56-3.58,9.61-3.67,16.68-6.88s9.51-5.32,10.64-6.06c1.16-0.76,2.21-1.45,3.02-0.12c0.52,0.86-0.38,4.38-2.77,7.8c-2.44,3.49-4.84,5.41-6.66,11.42c-2.41,7.93,2.22,15.14-2.72,27.88c-1.6,4.12-5.35,7.89-8.84,10.34c-3.49,2.45-8.52,3-8.52,3s1.79-1.25,2.77-5.85c0.48-2.26,1.2-6.27,0.65-10.54C79.55,57.93,69.62,48.38,69.62,48.38z"
                />
                <path
                  fill="#E2122D"
                  d="M31.74,46.68c0.12,2.68-1.14,12.43,0.49,20.26c1.28,6.16,7.62,17.05,19.49,20.25c10.92,2.95,22.61-0.09,22.61-0.09s4.41-7.45,2.18-18.31c-2.43-11.84-14.26-20.64-27.9-27.38c-16.39-8.1-19.36-17.86-19.36-17.86s-5.39-1.41-6.74,3.44C20.44,34.43,31.56,42.63,31.74,46.68z"
                />
              </svg>
            ) : (
              <img
                src="/badges/fir.png"
                alt=""
                className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0`}
                aria-hidden="true"
              />
            )}
            {listing.reviewAvg / 2 >= 4.95
              ? "Top Rated"
              : listing.reviewAvg / 2 >= 4.85
                ? "Traverse Favorite"
                : "Guest Approved"}
          </span>
        )}

        {/* Wishlist heart */}
        <WishlistButton
          listingId={listing.guesty_id}
          className={`absolute z-20 ${compact ? "right-1.5 top-1.5 h-7 w-7" : "right-3 top-3 h-8 w-8"}`}
        />
      </div>

      {/* Info */}
      <div className="mt-2">
        {compact ? (
          <>
            <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
              {displayTitle || listing.title || listing.nickname}
            </h3>
            <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              {listing.accommodates && (
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {listing.accommodates}
                </span>
              )}
              {listing.beds && (
                <span className="flex items-center gap-0.5">
                  <Bed className="h-3 w-3" />
                  {listing.beds}
                </span>
              )}
              {listing.bathrooms && (
                <span className="flex items-center gap-0.5">
                  <Bath className="h-3 w-3" />
                  {listing.bathrooms}
                </span>
              )}
              {listing.reviewAvg && listing.reviewTotal ? (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-current" />
                  {(listing.reviewAvg / 2).toFixed(2)}
                </span>
              ) : null}
            </div>
            {!hidePrice && listing.totalPrice && listing.nightCount ? (
              <SavingsPrice
                className="mt-0.5"
                compact
                directTotal={listing.totalPrice}
                suffix={`for ${listing.nightCount} night${listing.nightCount === 1 ? "" : "s"}`}
              />
            ) : null}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {listing.address?.city && !hideCity && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {listing.address.city}, {listing.address.state}
                  </p>
                )}
                <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
                  {displayTitle || listing.title || listing.nickname}
                </h3>
              </div>
              {listing.reviewAvg && listing.reviewTotal ? (
                <span className="flex shrink-0 items-center gap-1 text-xs text-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {(listing.reviewAvg / 2).toFixed(2)} ({listing.reviewTotal})
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {listing.accommodates && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {listing.accommodates}
                </span>
              )}
              {listing.beds && (
                <span className="flex items-center gap-1">
                  <Bed className="h-3.5 w-3.5" />
                  {listing.beds}
                </span>
              )}
              {listing.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />
                  {listing.bathrooms}
                </span>
              )}
            </div>
            {hidePrice ? null : listing.totalPrice ? (
              <div className="mt-1">
                {listing.cachedCheckIn && listing.cachedCheckOut && (
                  <p className="text-xs text-muted-foreground">
                    {format(
                      parse(listing.cachedCheckIn, "yyyy-MM-dd", new Date()),
                      "MMM d"
                    )}{" "}
                    –{" "}
                    {format(
                      parse(listing.cachedCheckOut, "yyyy-MM-dd", new Date()),
                      "MMM d"
                    )}
                  </p>
                )}
                <SavingsPrice
                  directTotal={listing.totalPrice}
                  suffix={
                    listing.nightCount
                      ? `for ${listing.nightCount} night${listing.nightCount === 1 ? "" : "s"}`
                      : "total"
                  }
                />
                {checkIn && (
                  <p className="text-xs text-muted-foreground">
                    before taxes & fees
                  </p>
                )}
                <span className="inline-block rounded-md bg-muted/75 px-1 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Free cancellation
                </span>
              </div>
            ) : listing.prices?.basePrice ? (
              <>
                <SavingsPrice
                  className="mt-1"
                  directTotal={listing.prices.basePrice}
                  suffix="/ night"
                />
                <span className="inline-block rounded-md bg-muted/75 px-1 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Free cancellation
                </span>
              </>
            ) : null}
          </>
        )}
      </div>
    </Link>
  );
}
