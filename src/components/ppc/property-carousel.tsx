"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface PropertyCarouselProps {
  children: React.ReactNode;
  /** "Explore more" link destination */
  exploreHref?: string;
}

export function PropertyCarousel({
  children,
  exploreHref,
}: PropertyCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth || 300;
    const gap = 16;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -(cardWidth + gap) : cardWidth + gap,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {/* Desktop navigation arrows */}
      <button
        onClick={() => scroll("left")}
        className="absolute -left-3 top-[35%] z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-md transition-opacity hover:shadow-lg md:flex"
        aria-label="Previous"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute -right-3 top-[35%] z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-white shadow-md transition-opacity hover:shadow-lg md:flex"
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Explore more */}
      {exploreHref && (
        <div className="mt-4">
          <Link
            href={exploreHref}
            className="inline-flex items-center rounded-lg border border-foreground px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Explore more
          </Link>
        </div>
      )}
    </div>
  );
}
