"use client";
// src/components/plan/itinerary-view.tsx
// Center + right-rail of the plan workspace. Renders the itinerary timeline
// in the center column and map + trip-snapshot + properties sidebar in the
// right rail (desktop). Mobile collapses to a single scrolling column with
// properties interleaved after day 2.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";
import { ItineraryTimeline } from "./itinerary-timeline";
import { ItineraryMap } from "./itinerary-map";
import { PropertySidebar } from "./property-sidebar";
import { TripSnapshot } from "./trip-snapshot";
import { SaveItinerary } from "./save-itinerary";
import { ShareItinerary } from "./share-itinerary";
import {
  DatePill,
  PartyPill,
  VibePill,
  NeighborhoodPill,
} from "./editable-pills";
import { ArrowRight, Map, Sparkles } from "lucide-react";

interface ItineraryViewProps {
  itinerary: Itinerary | null;
  status: UseChatHelpers<UIMessage>["status"];
  onRefine: (prompt: string) => void;
}

export function ItineraryView({
  itinerary,
  status,
  onRefine,
}: ItineraryViewProps) {
  const [hydrated, setHydrated] = useState<{
    itinerary: Itinerary;
    pois: Record<string, Poi>;
  } | null>(null);
  const [hydrationError, setHydrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!itinerary) {
      setHydrated(null);
      setHydrationError(null);
      return;
    }

    if (!Array.isArray(itinerary.days) || itinerary.days.length === 0) {
      setHydrationError("Itinerary is still being generated…");
      return;
    }

    const poiIds = Array.from(
      new Set(
        itinerary.days.flatMap((d) =>
          Array.isArray(d.items) ? d.items.map((i) => i.poiId) : []
        )
      )
    );

    if (poiIds.length === 0) {
      setHydrationError("Itinerary has no POI items");
      return;
    }

    let cancelled = false;
    setHydrationError(null);

    fetch("/api/plan/pois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: poiIds }),
    })
      .then((res) => res.json())
      .then((data: { pois?: Poi[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setHydrationError(data.error);
          return;
        }
        const byId: Record<string, Poi> = {};
        for (const p of data.pois ?? []) {
          byId[p.id] = p;
        }
        setHydrated({ itinerary, pois: byId });
      })
      .catch((err) => {
        if (cancelled) return;
        setHydrationError(
          err instanceof Error ? err.message : "Failed to load POI details"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [itinerary]);

  if (!itinerary) {
    if (status === "submitted" || status === "streaming") {
      return <LoadingState />;
    }
    return <EmptyHero />;
  }

  if (hydrationError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Couldn&rsquo;t load itinerary details: {hydrationError}
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return <LoadingState />;
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── Center column: title + timeline ── */}
        <main className="min-w-0 flex-1">
          <header className="mb-5">
            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-neutral-900 sm:text-2xl">
              {hydrated.itinerary.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-neutral-600">
              {hydrated.itinerary.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <DatePill
                itinerary={hydrated.itinerary}
                onRefine={onRefine}
                busy={busy}
              />
              <PartyPill
                itinerary={hydrated.itinerary}
                onRefine={onRefine}
                busy={busy}
              />
              <VibePill
                itinerary={hydrated.itinerary}
                onRefine={onRefine}
                busy={busy}
              />
              <NeighborhoodPill
                itinerary={hydrated.itinerary}
                onRefine={onRefine}
                busy={busy}
              />
            </div>

            {/* Mobile-only: primary Email CTA + Share — desktop has these in PlanTopBar */}
            <div className="mt-4 flex flex-col gap-2.5 lg:hidden">
              <SaveItinerary itinerary={hydrated.itinerary} />
              <ShareItinerary itinerary={hydrated.itinerary} variant="mobile" />
            </div>
          </header>

          {/* Mobile: interleave properties after day 2 */}
          <div className="flex flex-col gap-4 lg:hidden">
            <ItineraryTimeline
              itinerary={hydrated.itinerary}
              poisById={hydrated.pois}
              insertAfterDay={2}
              insertNode={
                <div className="flex flex-col gap-4">
                  <div data-plan-properties>
                    <PropertySidebar itinerary={hydrated.itinerary} />
                  </div>
                  <BookingCTA itinerary={hydrated.itinerary} />
                </div>
              }
            />
            <div data-plan-map>
              <ItineraryMap
                itinerary={hydrated.itinerary}
                poisById={hydrated.pois}
              />
            </div>
            <TripSnapshot
              itinerary={hydrated.itinerary}
              poisById={hydrated.pois}
            />
          </div>

          {/* Desktop: timeline only in center, rail on right */}
          <div className="hidden lg:block" data-plan-timeline-grid>
            <ItineraryTimeline
              itinerary={hydrated.itinerary}
              poisById={hydrated.pois}
            />
          </div>

          {hydrated.itinerary.notes && hydrated.itinerary.notes.length > 0 && (
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-neutral-900">
                Practical notes
              </h3>
              <ul className="mt-2 space-y-1 text-[13px] text-neutral-700">
                {hydrated.itinerary.notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-neutral-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>

        {/* ── Right rail (desktop only): map + snapshot + booking CTA + rentals ── */}
        <aside className="hidden w-full shrink-0 flex-col gap-3 lg:flex lg:w-[380px] lg:self-start xl:w-[400px]">
          <div data-plan-map>
            <ItineraryMap
              itinerary={hydrated.itinerary}
              poisById={hydrated.pois}
            />
          </div>
          <TripSnapshot
            itinerary={hydrated.itinerary}
            poisById={hydrated.pois}
          />
          <BookingCTA itinerary={hydrated.itinerary} />
          <div data-plan-properties>
            <PropertySidebar itinerary={hydrated.itinerary} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-neutral-900">
        Your Colorado trip starts here
      </h2>
      <p className="mt-2 max-w-sm text-sm text-neutral-600">
        Tell us when you&rsquo;re visiting and what you&rsquo;re into.
        We&rsquo;ll put together a day-by-day plan with real places, a map, and
        vacation rentals that match your dates.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
        <Map className="h-5 w-5 animate-pulse text-neutral-600" />
      </div>
      <div className="mt-4 text-sm text-neutral-600">Building your trip…</div>
    </div>
  );
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

function BookingCTA({ itinerary }: { itinerary: Itinerary }) {
  const hasDates = !itinerary.dates.isTentative;
  const guests = itinerary.party.adults + (itinerary.party.kids ?? 0);
  const href = `/properties${
    hasDates
      ? `?checkIn=${itinerary.dates.checkIn}&checkOut=${itinerary.dates.checkOut}&guests=${guests}`
      : ""
  }`;
  const label = hasDates
    ? `See rentals for ${formatShortRange(
        itinerary.dates.checkIn,
        itinerary.dates.checkOut
      )}`
    : "See my Colorado rentals";

  return (
    <div className="flex flex-col items-center gap-2">
      <Link
        href={href}
        className="group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 py-3.5 text-[14.5px] font-semibold tracking-tight text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-lg hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 active:translate-y-0"
      >
        {label}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
      <p className="text-[11px] text-neutral-500">
        No booking fees · Free cancel 14 days out
      </p>
    </div>
  );
}
