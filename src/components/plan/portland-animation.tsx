"use client";

import { useEffect, useState, type ReactNode } from "react";

const SLIDES = [
  {
    src: "/markets/crested-butte.jpg",
    label: "Crested Butte",
    fact: "Mt. Crested Butte sits at 9,375 ft — the heart of Crested Butte Mountain Resort with three slope-side condo buildings.",
  },
  {
    src: "/markets/leadville.jpg",
    label: "Leadville",
    fact: "Leadville is the highest incorporated city in the U.S. at 10,152 ft — founded in 1859 as a silver boomtown.",
  },
  {
    src: "/featured/mountain-hideaway.jpg",
    label: "Group Homes",
    fact: "The Mountain Hideaway in Leadville sleeps 20 — one of dozens of group homes across the Traverse portfolio.",
  },
  {
    src: "/featured/hilltop-suite.jpg",
    label: "Mt. Massive Views",
    fact: "Leadville sits at the foot of Mt. Massive and Mt. Elbert — the two tallest peaks in Colorado, both over 14,400 ft.",
  },
  {
    src: "/markets/twin-lakes.jpg",
    label: "Twin Lakes",
    fact: "Twin Lakes is the gateway to Mt. Elbert (14,439 ft) and Independence Pass — Colorado's most scenic alpine drive.",
  },
  {
    src: "/markets/vail.jpg",
    label: "Vail",
    fact: "Vail Village and Lionshead form the largest single-mountain ski resort in North America — 5,317 acres of skiable terrain.",
  },
  {
    src: "/markets/avon.jpg",
    label: "Avon",
    fact: "Avon is the basecamp for Beaver Creek Resort — luxury skiing with a fraction of Vail's crowds.",
  },
  {
    src: "/markets/granby.jpg",
    label: "Granby",
    fact: "Granby sits at the gate to Rocky Mountain National Park and Winter Park Resort — Colorado's longest continuously operating ski area.",
  },
  {
    src: "/home/colorado-mountain-scene.jpg",
    label: "190+ rentals",
    fact: "Traverse manages 190+ vacation rentals across six Colorado mountain markets — book direct and save up to 15%.",
  },
  {
    src: "/home/managed-rental-interior.jpg",
    label: "Locally managed",
    fact: "Every Traverse property is locally managed in Crested Butte and Leadville — 24/7 support from the team that lives here.",
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
