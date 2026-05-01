"use client";
// src/components/plan/property-sidebar.tsx
// "Where you can stay" block. Surfaces up to 3 Book Traverse rentals matched
// to the itinerary's party size + dates. Card design mirrors the 2026-04-22
// trip-planner reference: horizontal photo+content split per card, rating
// badge, neighborhood pill, 3 benefit rows, best-price footer strip.
//
// Listings are fetched client-side after the itinerary arrives so the chat
// API doesn't need to know about guesty-beapi (which is Node-only).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Itinerary } from "@/lib/plan/schema";
import {
  BadgeCheck,
  Bed,
  CalendarDays,
  ChevronRight,
  Footprints,
  Home,
  MapPin,
  ShieldCheck,
  Star,
  Tag,
  Users,
} from "lucide-react";
import {
  getVariant,
  trackABExposure,
  PLAN_RENTAL_CTA_TEST,
} from "@/lib/ab-testing";

const CTA_COPY: Record<string, string> = {
  view_details: "View details",
  see_price_dates: "See price & dates",
  stay_here: "Stay here",
};

// Match the real `listings` table shape (see Listing interface in
// src/lib/supabase.ts).
interface Listing {
  id?: string | number;
  guesty_id?: string;
  title?: string | null;
  nickname?: string | null;
  bedrooms?: number | null;
  accommodates?: number | null;
  property_type?: string | null;
  picture?: string | null;
  pictures?: string[] | null;
  amenities?: string[] | null;
  tags?: string[] | null;
  reviewAvg?: number | null;
  reviewTotal?: number | null;
}

type ListingsFallbackReason =
  | "agent-confirmed"
  | "exact"
  | "broadened"
  | "generic"
  | "none";

interface SidebarItem {
  listing: Listing;
  checkIn?: string;
  checkOut?: string;
}

// Shape returned by /api/plan/listings (see route.ts → toPublicListing).
interface PlanListingsResponseRow {
  id?: string | number;
  guesty_id?: string;
  title?: string | null;
  nickname?: string | null;
  bedrooms?: number | null;
  accommodates?: number | null;
  property_type?: string | null;
  picture?: string | null;
  amenities?: string[] | null;
  tags?: string[] | null;
  reviewAvg?: number | null;
  reviewTotal?: number | null;
  checkIn: string;
  checkOut: string;
}

// Six specific SP neighborhoods + four quadrants, in match priority order.
// Specific first so a listing tagged both "NW 23rd" and "Northwest" shows
// the more useful "NW 23rd".
const SP_SPECIFIC_TAGS = [
  "Alberta",
  "Hawthorne Belmont",
  "Pearl District",
  "Mississippi",
  "NW 23rd",
  "Sellwood Moreland",
] as const;
const SP_QUADRANT_TAGS = [
  "Northeast",
  "Northwest",
  "Southeast",
  "North",
] as const;

export function PropertySidebar({ itinerary }: { itinerary: Itinerary }) {
  const [items, setItems] = useState<SidebarItem[] | null>(null);
  const [fallbackReason, setFallbackReason] =
    useState<ListingsFallbackReason>("exact");
  const [error, setError] = useState<string | null>(null);

  const guests = itinerary.party.adults + (itinerary.party.kids ?? 0);
  const hasRealDates = !itinerary.dates.isTentative;

  // Resolve + expose the CTA variant ONCE per mount. getVariant() is a no-op
  // during SSR (returns the control) and sticky via localStorage on the
  // client, so we fire the exposure event only after we've seen at least
  // one rendered card.
  const ctaVariant = useMemo(() => getVariant(PLAN_RENTAL_CTA_TEST), []);
  useEffect(() => {
    if (items && items.length > 0) {
      trackABExposure(PLAN_RENTAL_CTA_TEST.id, ctaVariant);
    }
  }, [items, ctaVariant]);

  // Keyed on the itinerary contents that matter for matching: dates + POI
  // mix + party size. Refinements that change any of these refetch; cosmetic
  // refinements (reason text changes, notes) skip the refetch.
  const itineraryKey = useMemo(() => {
    const poiIds = itinerary.days
      .flatMap((d) => d.items.map((i) => i.poiId))
      .sort()
      .join(",");
    const alt = (itinerary.alternateDateRanges ?? [])
      .map((r) => `${r.checkIn}-${r.checkOut}`)
      .join(",");
    return `${itinerary.dates.checkIn}:${itinerary.dates.checkOut}:${itinerary.dates.isTentative}:${guests}:${alt}:${poiIds}`;
  }, [itinerary, guests]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setItems(null);

    const fetchFallbackListings = async (
      params: URLSearchParams
    ): Promise<Listing[]> => {
      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) throw new Error(`listings ${res.status}`);
      const data = (await res.json()) as {
        results?: Listing[];
        listings?: Listing[];
      };
      return data.results ?? data.listings ?? [];
    };

    const run = async () => {
      try {
        // Primary path: server-side BEAPI + hydrate + rank + neighborhood
        // boost. Replaces the old generate_itinerary tool-handler pipeline.
        if (hasRealDates) {
          try {
            const res = await fetch("/api/plan/listings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itinerary }),
            });
            if (res.ok) {
              const data = (await res.json()) as {
                listings?: PlanListingsResponseRow[];
                reason?: string;
              };
              const rows = data.listings ?? [];
              if (rows.length >= 1 && !cancelled) {
                const paired: SidebarItem[] = rows.slice(0, 3).map((row) => ({
                  listing: {
                    id: row.id,
                    guesty_id: row.guesty_id,
                    title: row.title ?? null,
                    nickname: row.nickname ?? null,
                    bedrooms: row.bedrooms ?? null,
                    accommodates: row.accommodates ?? null,
                    property_type: row.property_type ?? null,
                    picture: row.picture ?? null,
                    amenities: row.amenities ?? null,
                    tags: row.tags ?? null,
                    reviewAvg: row.reviewAvg ?? null,
                    reviewTotal: row.reviewTotal ?? null,
                  },
                  checkIn: row.checkIn,
                  checkOut: row.checkOut,
                }));
                setItems(paired);
                setFallbackReason(
                  data.reason === "date-shifted" ? "broadened" : "exact"
                );
                return;
              }
            }
          } catch {
            /* fall through to generic fallback */
          }
        }

        // Generic fallback: tentative dates, or the primary path returned
        // zero inventory. Shows something bookable to keep the card alive.
        const broadParams = new URLSearchParams({
          guests: String(guests),
          limit: "30",
        });
        const broad = await fetchFallbackListings(broadParams);
        if (broad.length >= 1 && !cancelled) {
          const picks = shuffleAndTake(broad, 3);
          setItems(
            picks.map((l) => ({
              listing: l,
              checkIn: hasRealDates ? itinerary.dates.checkIn : undefined,
              checkOut: hasRealDates ? itinerary.dates.checkOut : undefined,
            }))
          );
          setFallbackReason(hasRealDates ? "broadened" : "generic");
          return;
        }

        if (!cancelled) {
          setItems([]);
          setFallbackReason("none");
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load listings"
        );
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryKey]);

  const subtitleByReason: Record<ListingsFallbackReason, string | null> = {
    "agent-confirmed": "Hand-picked rentals for your dates",
    exact: "Hand-picked rentals for your dates",
    broadened: "Rentals that fit your group — check alternate dates",
    generic: "Rentals that fit your group",
    none: null,
  };
  const subtitle = subtitleByReason[fallbackReason];
  const browseHref = hasRealDates
    ? `/properties?checkIn=${itinerary.dates.checkIn}&checkOut=${itinerary.dates.checkOut}&guests=${guests}`
    : "/properties";

  return (
    <section
      data-plan-properties-card
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
    >
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-primary">
              <Home className="h-4 w-4" strokeWidth={2} />
            </div>
            <h2 className="text-[17px] font-semibold leading-tight text-neutral-900">
              Where you can stay
            </h2>
          </div>
          <Link
            href={browseHref}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            See all rentals
            <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>

        {subtitle && (
          <p className="mt-1 text-[13px] text-neutral-500">{subtitle}</p>
        )}

        {/* Trust row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-neutral-700">
          <TrustItem icon={BadgeCheck} label="Confirmed availability" />
          <TrustItem icon={Tag} label="Best price guarantee" />
          <TrustItem icon={ShieldCheck} label="No booking fees" />
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!items && !error && <SidebarSkeleton />}

        {items && items.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-600">
            No rentals in our catalog fit {guests} guest
            {guests === 1 ? "" : "s"} right now.{" "}
            <Link
              href="/properties"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Browse everything
            </Link>
            .
          </div>
        )}

        {items && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((item, i) => (
              <PropertyCard
                key={
                  item.listing.guesty_id ??
                  item.listing.id ??
                  `${i}-${item.checkIn}`
                }
                item={item}
                guests={guests}
                ctaVariant={ctaVariant}
              />
            ))}
          </div>
        )}

        <BrowseAllCard href={browseHref} />
      </div>
    </section>
  );
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: typeof BadgeCheck;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}

function buildDetailHref(item: SidebarItem, guests: number): string {
  const id = item.listing.guesty_id ?? String(item.listing.id ?? "");
  const qs = new URLSearchParams({
    from: "plan",
    guests: String(guests),
  });
  if (item.checkIn && item.checkOut) {
    qs.set("checkIn", item.checkIn);
    qs.set("checkOut", item.checkOut);
  }
  return `/properties/${id}?${qs.toString()}`;
}

function formatDateRange(checkIn: string, checkOut: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    });
    const from = fmt.format(new Date(`${checkIn}T12:00:00Z`));
    const to = fmt.format(new Date(`${checkOut}T12:00:00Z`));
    return `${from} – ${to}`;
  } catch {
    return `${checkIn} – ${checkOut}`;
  }
}

function pickNeighborhood(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const tagSet = new Set(tags);
  for (const t of SP_SPECIFIC_TAGS) if (tagSet.has(t)) return t;
  for (const t of SP_QUADRANT_TAGS) if (tagSet.has(t)) return `${t} Portland`;
  return null;
}

function buildWalkableClaim(listing: Listing): string {
  const name = (listing.title || listing.nickname || "").toLowerCase();
  const walkableByName = /walkable|walk to|steps to/.test(name);
  const hood = pickNeighborhood(listing.tags);
  if (walkableByName || hood) {
    return hood
      ? `Walk to cafes, shops & dining in ${hood.replace(" Portland", "")}`
      : "Walk to cafes, shops & dining";
  }
  return "Quiet Portland neighborhood";
}

function buildAmenityClaim(listing: Listing): string {
  const amen = new Set(
    (listing.amenities ?? []).map((a) => a.toLowerCase().trim())
  );
  const has = (...keys: string[]) => keys.some((k) => amen.has(k));
  const parts: string[] = [];
  if (has("kitchen")) parts.push("Full kitchen");
  if (has("wifi", "internet", "wireless internet")) parts.push("Fast Wi-Fi");
  if (parts.length === 0 && has("washer", "washer/dryer", "dryer")) {
    parts.push("Washer/Dryer");
  }
  if (parts.length === 0) return "Fully equipped home";
  return parts.join(" · ");
}

function bedroomLabel(listing: Listing): string | null {
  if (listing.bedrooms == null) return null;
  if (listing.bedrooms === 0) return "Studio";
  return `${listing.bedrooms} bd`;
}

// Guesty serves listing photos through Cloudinary with a `t_default_thumb`
// transform baked into the URL — tiny, blurs when displayed at card size
// (esp. on 2x displays). Swap for an 800×500 `c_fill` variant, matching the
// 16:10 card aspect. Mirrors the pattern in src/app/api/account/**.
function upgradeListingPhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("/t_default_thumb/")) return url;
  return url.replace("/t_default_thumb/", "/c_fill,w_800,h_500,f_auto,q_auto/");
}

function PropertyCard({
  item,
  guests,
  ctaVariant,
}: {
  item: SidebarItem;
  guests: number;
  ctaVariant: string;
}) {
  const { listing, checkIn, checkOut } = item;
  const thumb = upgradeListingPhoto(
    listing.picture ?? listing.pictures?.[0] ?? null
  );
  const title = listing.title ?? listing.nickname ?? "Portland rental";
  const href = buildDetailHref(item, guests);
  const dateRange =
    checkIn && checkOut ? formatDateRange(checkIn, checkOut) : null;
  const rating =
    listing.reviewAvg != null ? (listing.reviewAvg / 2).toFixed(2) : null;
  const hood = pickNeighborhood(listing.tags);
  const walkable =
    hood != null ||
    /walkable|walk to|steps to/i.test(
      `${listing.title ?? ""} ${listing.nickname ?? ""}`
    );
  const bedLabel = bedroomLabel(listing);
  const sleepsLabel =
    listing.accommodates != null ? `Sleeps ${listing.accommodates}` : null;
  const amenityClaim = buildAmenityClaim(listing);
  const ctaLabel = CTA_COPY[ctaVariant] ?? CTA_COPY.view_details;

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-sm">
      {/* Photo */}
      <Link href={href} className="relative block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={title}
            loading="lazy"
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-neutral-100" />
        )}

        {rating && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[12px] font-semibold text-neutral-900 shadow-sm">
            <Star className="h-3 w-3 fill-primary text-primary" />
            {rating}
          </div>
        )}

        {hood && (
          <div className="absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-neutral-900/85 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3" strokeWidth={2.25} />
            <span className="truncate">
              {hood}
              {walkable ? " · Walkable" : ""}
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <Link
          href={href}
          className="text-[14.5px] font-semibold leading-snug text-neutral-900 hover:text-primary"
        >
          {title}
        </Link>

        {/* Icon-led meta row: bed, sleeps, amenity (replaces plain "1 bd · Sleeps 2 · Studio"). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-600">
          {bedLabel && <MetaItem icon={Bed} label={bedLabel} />}
          {sleepsLabel && <MetaItem icon={Users} label={sleepsLabel} />}
          <MetaItem icon={Home} label={amenityClaim} />
        </div>

        <ul className="mt-0.5 space-y-1 text-[12.5px] text-neutral-700">
          <BenefitRow icon={Footprints} text={buildWalkableClaim(listing)} />
          {dateRange && <BenefitRow icon={CalendarDays} text={dateRange} />}
        </ul>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between gap-2 border-t border-primary/15 bg-primary/5 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-primary">
          <Tag className="h-3.5 w-3.5" strokeWidth={2.25} />
          Best price guarantee
        </div>
        <Link
          href={href}
          data-ab-variant={ctaVariant}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          {ctaLabel}
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </article>
  );
}

function MetaItem({ icon: Icon, label }: { icon: typeof Bed; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function BenefitRow({ icon: Icon, text }: { icon: typeof Home; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-primary">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="truncate">{text}</span>
    </li>
  );
}

function BrowseAllCard({ href }: { href: string }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarDays className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-neutral-900">
          Need a different date or more space?
        </div>
        <div className="text-[12px] text-neutral-500">
          Browse all 275+ Portland rentals.
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition hover:bg-primary/5"
      >
        See all rentals
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

function shuffleAndTake<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-neutral-200"
        >
          <div className="aspect-[16/10] w-full animate-pulse bg-neutral-100" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="h-10 animate-pulse bg-neutral-50" />
        </div>
      ))}
    </div>
  );
}
