"use client";
// src/components/plan/itinerary-timeline.tsx
// Redesigned day timeline: accordion cards, dark-green numbered pill,
// category-based activity icons on a vertical rail, time label on the left,
// POI content center, thumbnail right.

import { useState } from "react";
import type { Itinerary, ItineraryItem } from "@/lib/plan/schema";
import type { Poi, PoiCategory } from "@/lib/pois/types";
import { findFavoriteForPoi, getFavoritePill } from "@/lib/plan/favorites";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";
import { slotLabel } from "@/lib/plan/slot-label";
import {
  Beer,
  Building2,
  ChevronDown,
  Coffee,
  Footprints,
  Landmark,
  MapPin,
  Mountain,
  ShoppingBag,
  Sparkles,
  Star,
  Train,
  Trees,
  UtensilsCrossed,
  Utensils,
  type LucideIcon,
} from "lucide-react";

interface ItineraryTimelineProps {
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
  insertAfterDay?: number;
  insertNode?: React.ReactNode;
}

const CATEGORY_ICON: Record<PoiCategory, LucideIcon> = {
  coffee: Coffee,
  restaurant: UtensilsCrossed,
  bar: Beer,
  park: Trees,
  shop: ShoppingBag,
  museum: Landmark,
  viewpoint: Mountain,
  activity: Footprints,
  food_cart_pod: Utensils,
  transit: Train,
};

// Muted category tint — keeps the rail visually light but gives each stop a
// distinct vibe (coffee vs. food vs. outdoor vs. drinks) so the day scans fast.
const CATEGORY_TONE: Record<PoiCategory, { bg: string; text: string }> = {
  coffee: { bg: "bg-amber-100", text: "text-amber-700" },
  restaurant: { bg: "bg-rose-100", text: "text-rose-700" },
  food_cart_pod: { bg: "bg-rose-100", text: "text-rose-700" },
  bar: { bg: "bg-amber-100", text: "text-amber-600" },
  park: { bg: "bg-emerald-100", text: "text-emerald-700" },
  activity: { bg: "bg-emerald-100", text: "text-emerald-700" },
  viewpoint: { bg: "bg-sky-100", text: "text-sky-700" },
  museum: { bg: "bg-violet-100", text: "text-violet-700" },
  shop: { bg: "bg-pink-100", text: "text-pink-700" },
  transit: { bg: "bg-blue-100", text: "text-blue-700" },
};

export function ItineraryTimeline({
  itinerary,
  poisById,
  insertAfterDay,
  insertNode,
}: ItineraryTimelineProps) {
  // Accordion: first day open by default; users can collapse or expand others.
  const [openDays, setOpenDays] = useState<Set<number>>(
    () =>
      new Set(itinerary.days.length > 0 ? [itinerary.days[0]!.dayNumber] : [])
  );

  const toggleDay = (day: number) =>
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {itinerary.days.flatMap((day) => {
        const isOpen = openDays.has(day.dayNumber);
        const card = (
          <div
            key={day.dayNumber}
            data-plan-day-card
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggleDay(day.dayNumber)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {day.dayNumber}
              </div>
              <h3 className="flex-1 text-[15px] font-semibold leading-snug text-neutral-900">
                {day.label}
              </h3>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-neutral-100">
                <DayItems day={day} poisById={poisById} />
              </div>
            )}
          </div>
        );

        if (insertNode && day.dayNumber === (insertAfterDay ?? -1)) {
          return [
            card,
            <div key={`insert-${day.dayNumber}`}>{insertNode}</div>,
          ];
        }
        return [card];
      })}
    </div>
  );
}

function DayItems({
  day,
  poisById,
}: {
  day: Itinerary["days"][number];
  poisById: Record<string, Poi>;
}) {
  return (
    <ol className="flex flex-col px-5 py-3">
      {day.items.map((item, idx) => {
        const isLast = idx === day.items.length - 1;
        return (
          <POIRow
            key={`${day.dayNumber}-${idx}`}
            item={item}
            poi={poisById[item.poiId]}
            isLast={isLast}
          />
        );
      })}
    </ol>
  );
}

function POIRow({
  item,
  poi,
  isLast,
}: {
  item: ItineraryItem;
  poi: Poi | undefined;
  isLast: boolean;
}) {
  if (!poi) {
    return (
      <li className="py-3 text-sm text-neutral-500">
        Missing POI: {item.poiId}
      </li>
    );
  }

  const favorite = findFavoriteForPoi({ id: poi.id, name: poi.name });
  const Icon = CATEGORY_ICON[poi.category] ?? Sparkles;
  const tone = CATEGORY_TONE[poi.category] ?? {
    bg: "bg-primary/10",
    text: "text-primary",
  };
  const neighborhood = formatNeighborhood(poi.neighborhood);
  const label = slotLabel(item.timeSlot, poi.category);

  return (
    <li className="group relative flex gap-3 py-3.5 sm:gap-4">
      {/* Desktop-only label column (sm+). Mobile shows the label inline above
          the name so the content column gets the full width of the row. */}
      <div className="hidden w-[96px] shrink-0 pt-0.5 text-[12px] font-semibold text-neutral-500 sm:block">
        {label}
      </div>

      {/* Icon + rail */}
      <div className="relative flex w-6 shrink-0 justify-center">
        <div
          className={`z-10 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${tone.bg} ${tone.text}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && (
          <span
            aria-hidden
            className="absolute left-1/2 top-6 h-[calc(100%-0.5rem)] w-px -translate-x-1/2 bg-neutral-200"
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-1">
        {/* Mobile-only label above the name */}
        <div className="mb-1 text-[12px] font-semibold text-neutral-500 sm:hidden">
          {label}
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold leading-snug text-neutral-900">
                {poi.name}
              </span>
              {favorite && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Star className="h-2.5 w-2.5 fill-primary" />
                  {getFavoritePill(favorite)}
                </span>
              )}
              {neighborhood && (
                <span className="inline-flex items-center text-[12px] text-neutral-500">
                  <Building2 className="mr-0.5 hidden h-3 w-3 text-neutral-400" />
                  {neighborhood}
                </span>
              )}
            </div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-600">
              {item.reason}
            </p>
          </div>
          {poi.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poi.photoUrl}
              alt={poi.name}
              className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-[72px] sm:w-[96px]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-neutral-100 sm:h-[72px] sm:w-[96px]">
              <MapPin className="h-5 w-5 text-neutral-400" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
