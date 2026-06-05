"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";
import { SavingsPrice } from "@/components/properties/savings-price";

interface MapCardCarouselProps {
  listings: Listing[];
  selectedListingId: string;
  onSelectedChange: (listingId: string) => void;
  onClose: () => void;
  onDismissStart?: () => void;
  hidePrice?: boolean;
  dismissing?: boolean;
}

function PhotoCarousel({ photos, alt }: { photos: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const total = photos.length;

  if (total === 0) {
    return <div className="h-full w-full bg-gray-100" />;
  }

  if (total === 1) {
    return (
      <div className="relative h-full w-full">
        <Image
          src={getPhotoUrl(photos[0], 800)}
          alt={alt}
          fill
          className="object-cover"
          sizes="320px"
        />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {photos.map((src, i) => (
        <Image
          key={i}
          src={getPhotoUrl(src, 800)}
          alt={`${alt} ${i + 1}`}
          fill
          className="absolute inset-0 object-cover transition-opacity duration-250"
          style={{ opacity: i === current ? 1 : 0 }}
          sizes="320px"
        />
      ))}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCurrent((current - 1 + total) % total);
        }}
        className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 shadow active:scale-95"
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCurrent((current + 1) % total);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 shadow active:scale-95"
        aria-label="Next photo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
        {photos.slice(0, 5).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === current ? "bg-white" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function MapCardCarousel({
  listings,
  selectedListingId,
  onSelectedChange,
  onClose,
  onDismissStart,
  hidePrice,
  dismissing,
}: MapCardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingToRef = useRef(false);
  const [navigating, setNavigating] = useState(false);
  const searchParams = useSearchParams();

  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const guests = searchParams.get("guests") || "";

  const linkParams = new URLSearchParams();
  if (checkIn) linkParams.set("checkIn", checkIn);
  if (checkOut) linkParams.set("checkOut", checkOut);
  if (guests) linkParams.set("guests", guests);
  const qs = linkParams.toString() ? `?${linkParams.toString()}` : "";

  const navigateTo = useCallback((href: string) => {
    // Open the listing in a new tab so the map/search state is preserved.
    window.open(href, "_blank", "noopener,noreferrer");
  }, []);

  // Clear spinner when returning via browser back (bfcache restore)
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setNavigating(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const dismissCarousel = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      onClose();
      return;
    }
    onDismissStart?.();
    el.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out";
    el.style.transform = "translateY(100%)";
    el.style.opacity = "0";
    setTimeout(() => onClose(), 250);
  }, [onClose, onDismissStart]);

  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      scrollRef.current?.scrollTo({ left: 0 });
    }
    // After slide-up animation finishes, clear it so inline transform/opacity work
    const el = containerRef.current;
    if (el) {
      const onEnd = () => {
        el.style.animation = "none";
      };
      el.addEventListener("animationend", onEnd, { once: true });
      return () => el.removeEventListener("animationend", onEnd);
    }
  }, []);

  // Animate out when parent triggers dismissal (e.g. map pan)
  useEffect(() => {
    if (!dismissing) return;
    const el = containerRef.current;
    if (!el) {
      onClose();
      return;
    }
    onDismissStart?.();
    el.style.transition = "transform 0.25s ease-out, opacity 0.25s ease-out";
    el.style.transform = "translateY(100%)";
    el.style.opacity = "0";
    setTimeout(() => onClose(), 250);
  }, [dismissing, onClose, onDismissStart]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout>;

    function onScroll() {
      if (isScrollingToRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!container || isScrollingToRef.current) return;
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < container.children.length; i++) {
          const child = container.children[i] as HTMLElement;
          const childRect = child.getBoundingClientRect();
          const childCenter = childRect.left + childRect.width / 2;
          const dist = Math.abs(childCenter - centerX);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        if (listings[closestIdx]) {
          const id = listings[closestIdx].guesty_id;
          if (id !== selectedListingId) {
            onSelectedChange(id);
          }
        }
      }, 80);
    }

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      container.removeEventListener("scroll", onScroll);
    };
  }, [listings, selectedListingId, onSelectedChange]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 bottom-0 z-[70] animate-slide-up md:hidden"
    >
      {navigating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pl-4 pr-4 pb-8 pt-1 snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {listings.map((listing) => {
          const photos: string[] = [];
          if (listing.pictures && listing.pictures.length > 0) {
            photos.push(...listing.pictures.slice(0, 5));
          } else if (listing.picture) {
            photos.push(listing.picture);
          }
          const slug = getListingSlug(
            listing.title || listing.nickname,
            listing.guesty_id
          );
          const price = Math.round(
            listing.totalPrice || listing.prices?.basePrice || 0
          );
          const href = `/properties/${slug}${qs}`;

          return (
            <CardWithTap
              key={listing.guesty_id}
              href={href}
              onNavigate={navigateTo}
              onSwipeDown={dismissCarousel}
              containerRef={containerRef}
            >
              <div className="relative aspect-[16/10] w-full">
                <PhotoCarousel
                  photos={photos}
                  alt={listing.title || listing.nickname || "Property"}
                />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissCarousel();
                  }}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md active:scale-95"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              <div className="px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-base font-semibold text-gray-900">
                    {listing.title || listing.nickname || "Untitled"}
                  </p>
                  {listing.reviewAvg && listing.reviewTotal ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-gray-900">
                      <Star className="h-3 w-3 fill-current" />
                      {(listing.reviewAvg / 2).toFixed(2)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {listing.bedrooms || 0} bed &middot; {listing.bathrooms || 0}{" "}
                  bath &middot; {listing.accommodates || 0} guests
                </p>
                {!hidePrice && price > 0 && (
                  <SavingsPrice
                    className="mt-1"
                    directTotal={price}
                    suffix={
                      listing.totalPrice && listing.nightCount
                        ? `for ${listing.nightCount} night${listing.nightCount === 1 ? "" : "s"}`
                        : listing.totalPrice
                          ? "total"
                          : "/ night"
                    }
                  />
                )}
              </div>
            </CardWithTap>
          );
        })}
      </div>
    </div>
  );
}

// Card that handles: tap → navigate, horizontal swipe → carousel scroll, vertical swipe down → dismiss
function CardWithTap({
  href,
  onNavigate,
  onSwipeDown,
  containerRef,
  children,
}: {
  href: string;
  onNavigate: (href: string) => void;
  onSwipeDown: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const touchRef = useRef<{
    x: number;
    y: number;
    t: number;
    direction: "vertical" | "horizontal" | null;
    dragging: boolean;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use native touchmove listener so we can call preventDefault (React synthetic events are passive)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    function onTouchMove(e: TouchEvent) {
      if (!touchRef.current) return;
      const dx = e.touches[0].clientX - touchRef.current.x;
      const dy = e.touches[0].clientY - touchRef.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Lock direction after enough movement — require 2:1 horizontal ratio for horizontal lock
      if (!touchRef.current.direction) {
        if (absDy < 12 && absDx < 12) return;
        touchRef.current.direction =
          absDx > absDy * 2 ? "horizontal" : "vertical";
      }

      if (touchRef.current.direction === "horizontal") return;

      // Vertical swipe — prevent scroll container from scrolling horizontally
      e.preventDefault();

      if (dy > 0) {
        touchRef.current.dragging = true;
        const container = containerRef.current;
        if (container) {
          container.style.transition = "none";
          container.style.transform = `translateY(${dy}px)`;
          container.style.opacity = `${Math.max(0.2, 1 - dy / 150)}`;
        }
      }
    }

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [containerRef]);

  return (
    <div
      ref={cardRef}
      className="w-[calc(100vw-48px)] flex-shrink-0 snap-center snap-always overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.15)]"
      onTouchStart={(e) => {
        touchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          t: Date.now(),
          direction: null,
          dragging: false,
        };
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = Math.abs(e.changedTouches[0].clientX - touchRef.current.x);
        const dy = e.changedTouches[0].clientY - touchRef.current.y;
        const dt = Date.now() - touchRef.current.t;
        const wasDragging = touchRef.current.dragging;
        touchRef.current = null;

        if (wasDragging) {
          if (dy > 60) {
            onSwipeDown();
          } else {
            const container = containerRef.current;
            if (container) {
              container.style.transition =
                "transform 0.2s ease-out, opacity 0.2s ease-out";
              container.style.transform = "translateY(0)";
              container.style.opacity = "1";
              setTimeout(() => {
                if (container) container.style.transition = "";
              }, 200);
            }
          }
          return;
        }

        // Tap detection
        if (dx < 12 && Math.abs(dy) < 12 && dt < 400) {
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          onNavigate(href);
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        onNavigate(href);
      }}
      role="link"
      style={{ cursor: "pointer", touchAction: "pan-x" }}
    >
      {children}
    </div>
  );
}
