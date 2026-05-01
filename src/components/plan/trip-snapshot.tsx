"use client";
// src/components/plan/trip-snapshot.tsx
// Right-rail companion card under the map. Quick glance summary of the
// plan (dates, party, vibe, neighborhoods covered).

import { useMemo } from "react";
import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";
import { CalendarDays, MapPin, Star, Users } from "lucide-react";

interface TripSnapshotProps {
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
}

function formatShortRange(checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T12:00:00Z`);
  const end = new Date(`${checkOut}T12:00:00Z`);
  const startMonth = start.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

function tripLengthLabel(nights: number): string {
  if (nights <= 1) return "Quick stay";
  if (nights === 2) return "Weekend trip";
  if (nights === 3) return "Long weekend";
  if (nights <= 5) return "Short trip";
  return "Extended stay";
}

function partyLabel(adults: number, kids?: number): string {
  const adultLabel = `${adults} adult${adults === 1 ? "" : "s"}`;
  if (!kids) return adultLabel;
  return `${adultLabel} + ${kids} kid${kids === 1 ? "" : "s"}`;
}

function vibeLabel(vibe: Itinerary["party"]["vibe"]): string {
  if (vibe === "chill") return "Chill";
  if (vibe === "packed") return "Packed";
  return "Balanced";
}

export function TripSnapshot({ itinerary, poisById }: TripSnapshotProps) {
  const neighborhoodCount = useMemo(() => {
    const set = new Set<string>();
    for (const day of itinerary.days) {
      for (const item of day.items) {
        const poi = poisById[item.poiId];
        if (!poi) continue;
        const name = formatNeighborhood(poi.neighborhood);
        if (name) set.add(name);
      }
    }
    return set.size;
  }, [itinerary, poisById]);

  const hasDates = !itinerary.dates.isTentative;
  const dateLabel = hasDates
    ? formatShortRange(itinerary.dates.checkIn, itinerary.dates.checkOut)
    : "Flexible dates";

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
          Your trip snapshot
        </h3>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <SnapshotTile
            icon={CalendarDays}
            value={dateLabel}
            label={`${itinerary.dates.nights} night${itinerary.dates.nights === 1 ? "" : "s"}`}
          />
          <SnapshotTile
            icon={Users}
            value={partyLabel(itinerary.party.adults, itinerary.party.kids)}
            label={tripLengthLabel(itinerary.dates.nights)}
          />
          <SnapshotTile
            icon={Star}
            value={vibeLabel(itinerary.party.vibe)}
            label="Food, sights, and vibes"
          />
          <SnapshotTile
            icon={MapPin}
            value={
              neighborhoodCount > 4
                ? "5+"
                : String(neighborhoodCount || itinerary.days.length)
            }
            label="Neighborhoods explored"
          />
        </div>
      </section>
    </div>
  );
}

function SnapshotTile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof CalendarDays;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white">
        <Icon className="h-4 w-4 text-neutral-700" strokeWidth={1.75} />
      </div>
      <div className="mt-2 text-[12px] font-semibold leading-tight text-neutral-900">
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] leading-snug text-neutral-500">
        {label}
      </div>
    </div>
  );
}
