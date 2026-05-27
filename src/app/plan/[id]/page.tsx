// src/app/plan/[id]/page.tsx
// Two personalities for one route:
//   1. Known SEO slug (e.g. "portland-food-weekend") → SSR a static,
//      indexable trip plan page rendered from the pre-seeded cache.
//   2. UUID → hydrate the interactive chat client with a persisted plan.
// Anything else → 404.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { PlanClient } from "@/components/plan/plan-client";
import { StaticPlanPage } from "@/components/plan/static-plan-page";
import { NoFeesHeader } from "@/components/no-fees/no-fees-header";
import { TripPlanSchema } from "@/components/plan/trip-plan-schema";
import { getPlanSlug, allPlanSlugs } from "@/lib/plan/slug-map";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPoisByIds } from "@/lib/pois/queries";
import { sanitizePoiForClient } from "@/lib/plan/poi-photo";
import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";
import type { Listing } from "@/lib/supabase";
import { getListings } from "@/lib/supabase";
import { rankListings } from "@/lib/ranking";
import {
  matchItineraryNeighborhood,
  boostListingsByNeighborhood,
} from "@/lib/plan/neighborhood-match";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

// Statically render the 4 known SEO slugs; UUIDs fall through to dynamic.
export function generateStaticParams() {
  return allPlanSlugs().map((s) => ({ id: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const entry = getPlanSlug(id);
  if (entry) {
    const canonical = `https://www.booktraverse.com/plan/${entry.slug}`;
    return {
      title: entry.metaTitle,
      description: entry.metaDescription,
      keywords: entry.keywords,
      alternates: { canonical },
      openGraph: {
        title: entry.metaTitle,
        description: entry.metaDescription,
        url: canonical,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: entry.metaTitle,
        description: entry.metaDescription,
      },
      robots: { index: true, follow: true },
    };
  }
  // UUID case — noindex persisted user plans.
  return {
    title: "Your Colorado Trip",
    description:
      "Your saved Colorado itinerary — built with the Book Traverse Trip Planner.",
    robots: { index: false, follow: true },
  };
}

// Extract the latest generate_itinerary tool output from a plan's messages.
function extractItinerary(messages: UIMessage[]): Itinerary | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant") continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j] as unknown as {
        type?: string;
        state?: string;
        output?: { ok?: boolean; itinerary?: Itinerary };
      };
      if (part?.type !== "tool-generate_itinerary") continue;
      if (part.state !== "output-available") continue;
      const it = part.output?.itinerary;
      if (it && Array.isArray(it.days) && it.days.length > 0) return it;
    }
  }
  return null;
}

async function loadSeoPlan(cacheKey: string): Promise<{
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
  listings: Listing[];
} | null> {
  const supa = getSupabaseAdmin();
  const { data: row } = await supa
    .from("sp_plans")
    .select("messages")
    .eq("cache_key", cacheKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const messages = (row?.messages ?? []) as UIMessage[];
  const itinerary = extractItinerary(messages);
  if (!itinerary) return null;

  // Hydrate POIs
  const poiIds = Array.from(
    new Set(itinerary.days.flatMap((d) => d.items.map((i) => i.poiId)))
  );
  const pois = await getPoisByIds(poiIds);
  const poisById: Record<string, Poi> = {};
  for (const p of pois) {
    poisById[p.id] = sanitizePoiForClient(p);
  }

  // Neighborhood-matched listings (Supabase only — no BEAPI here, this is
  // an evergreen SEO surface, not a booking quote)
  const guests = itinerary.party.adults + (itinerary.party.kids ?? 0);
  const allListings = await getListings({ limit: 200 });
  const poisMap = new Map(Object.entries(poisById));
  const match = matchItineraryNeighborhood(itinerary, poisMap);
  const ranked = rankListings(allListings, "guests", {
    searchedGuests: guests,
  });
  const boosted = boostListingsByNeighborhood(ranked, match).slice(0, 8);

  return { itinerary, poisById, listings: boosted };
}

export default async function PlanByIdPage({ params }: Props) {
  const { id } = await params;

  // SEO slug branch
  const entry = getPlanSlug(id);
  if (entry) {
    const loaded = await loadSeoPlan(entry.cacheKey);
    if (!loaded) notFound();
    return (
      <>
        <TripPlanSchema
          entry={entry}
          itinerary={loaded.itinerary}
          poisById={loaded.poisById}
        />
        {/* Wrap header in data-no-fees-layout so plan.css's body-level
            header-hiding rule (`body:has([data-plan-chrome]) > header`) does
            NOT match — and so the global Tailwind cascade is unaffected on
            the rest of this static page. */}
        <div data-no-fees-layout className="relative z-50">
          <NoFeesHeader />
        </div>
        <StaticPlanPage
          entry={entry}
          itinerary={loaded.itinerary}
          poisById={loaded.poisById}
          listings={loaded.listings}
        />
      </>
    );
  }

  // UUID branch (interactive chat with saved plan)
  if (!UUID_RE.test(id)) notFound();

  const { data, error } = await getSupabaseAdmin()
    .from("sp_plans")
    .select("id,messages")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  return (
    <PlanClient
      initialPlanId={data.id as string}
      initialMessages={(data.messages ?? []) as UIMessage[]}
    />
  );
}
