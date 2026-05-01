"use client";

import { useEffect, useState, type ReactNode } from "react";

const SLIDES = [
  {
    src: "/images/home/fact-brewery.jpg",
    label: "Portland brewery",
    fact: "Portland has more breweries per capita than any other city in the world.",
  },
  {
    src: "/images/home/fact-warehouse.jpg",
    label: "Pearl District",
    fact: "The Pearl District was a rail yard and warehouse district until the 1990s.",
  },
  {
    src: "/images/home/fact-autumn-maple.jpg",
    label: "Portland neighborhoods",
    fact: "Portland has 95 officially recognized neighborhoods across 5 quadrants.",
  },
  {
    src: "/images/home/fact-mural.jpg",
    label: "Alberta Arts District",
    fact: "Alberta Street hosts Last Thursday — a free monthly art walk with live music and street vendors.",
  },
  {
    src: "/images/home/fact-bookstore.jpg",
    label: "Powell's on Hawthorne",
    fact: "Hawthorne Blvd is home to the original Powell's Books on Hawthorne, open since 1979.",
  },
  {
    src: "/images/home/fact-mt-hood.jpg",
    label: "Mt. Hood",
    fact: "Mt. Hood is visible from Portland on clear days — an 11,250 ft volcano just 60 miles east.",
  },
  {
    src: "/images/home/poi-nw23rd.jpg",
    label: "NW 23rd Avenue",
    fact: "NW 23rd is nicknamed Trendy-Third — Portland's most walkable shopping street.",
  },
  {
    src: "/images/home/poi-mississippi.jpg",
    label: "Mississippi Ave",
    fact: "Mississippi Avenue went from overlooked to one of Portland's hottest food streets in under a decade.",
  },
  {
    src: "/images/home/fact-antique-shop.jpg",
    label: "Sellwood antiques",
    fact: "Sellwood is Portland's antique capital — over a dozen vintage shops in a 6-block stretch.",
  },
  {
    src: "/images/home/fact-food-truck.jpg",
    label: "Food cart pods",
    fact: "SE Portland has more food cart pods than any other part of the city — over 500 carts total.",
  },
];

const INTERVAL = 5000;

interface PortlandAnimationProps {
  // When provided, replaces the default "Your personalized itinerary…"
  // footer text. Used during active building to show live progress pills
  // instead of a static empty-state caption.
  footerSlot?: ReactNode;
}

export function PortlandAnimation({ footerSlot }: PortlandAnimationProps = {}) {
  const [current, setCurrent] = useState(0);
  const [zoomIn, setZoomIn] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
      setZoomIn((prev) => !prev);
    }, INTERVAL);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[current]!;
  const isBuilding = Boolean(footerSlot);

  return (
    // `overflow-y-auto` + `justify-start` means if the progress card grows
    // the layout scrolls instead of compressing the photo/fact above.
    <div className="flex h-full flex-col items-center justify-start gap-4 overflow-y-auto bg-[#f4f1ec] px-6 py-8 sm:gap-5 sm:px-8 sm:py-10">
      {/* Photo slideshow — shrinks during building to give the progress card
          prominence, expands back when empty. */}
      <div
        className={`relative w-full max-w-2xl shrink-0 overflow-hidden rounded-2xl bg-neutral-200 shadow-xl ring-1 ring-black/5 ${
          isBuilding ? "aspect-[16/7]" : "aspect-[16/10]"
        }`}
      >
        {SLIDES.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.label}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: i === current ? 1 : 0,
              transform:
                i === current
                  ? zoomIn
                    ? "scale(1.08)"
                    : "scale(1.0)"
                  : "scale(1.04)",
              transitionProperty: "opacity, transform",
              transitionDuration:
                i === current ? "1200ms, 5000ms" : "1200ms, 1200ms",
              transitionTimingFunction: "ease-in-out",
            }}
            loading={i < 2 ? "eager" : "lazy"}
          />
        ))}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Label + dots */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-4">
          <span className="text-sm font-medium text-white/90">
            {slide.label}
          </span>
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCurrent(i);
                  setZoomIn((p) => !p);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Book Traverse logo — top left */}
        <div className="absolute left-4 top-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/book-traverse-wordmark-white.png"
            alt="Book Traverse"
            className="h-5 drop-shadow-md"
          />
        </div>
      </div>

      {/* Inline fun fact — one short line, can't collapse because it
          has no fixed height and no sibling competing for space. */}
      <p className="w-full max-w-2xl shrink-0 text-center text-xs leading-relaxed text-neutral-600 sm:text-sm">
        <span className="font-semibold uppercase tracking-wider text-[#2b4a4e]">
          Did you know?
        </span>{" "}
        {slide.fact}
      </p>

      {/* Footer slot — during building this holds the stage progress card.
          When empty, shows the default caption. */}
      {footerSlot ? (
        <div className="flex w-full shrink-0 justify-center">{footerSlot}</div>
      ) : (
        <p className="shrink-0 text-center text-sm text-[#8a8279]">
          Your personalized itinerary, map, and rental picks will appear here.
        </p>
      )}
    </div>
  );
}
