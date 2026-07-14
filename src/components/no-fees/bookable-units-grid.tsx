"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Users,
  Bed,
  Bath,
  Star,
  Loader2,
  CalendarDays,
  Minus,
  Plus,
} from "lucide-react";
import { format, startOfToday } from "date-fns";
import type { DateRange } from "react-day-picker";
import { type Listing } from "@/lib/supabase";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";
import { SavingsPrice } from "@/components/properties/savings-price";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trackCheckAvailability, trackClickBookNow } from "@/lib/tracking";

/**
 * Client "available units" grid for building landing pages (Grand Lodge first).
 *
 * Why this exists: GA4 funnel analysis (2026-06-03) showed ~86% of visitors
 * who land on a building page leave WITHOUT ever opening a bookable unit — the
 * single biggest conversion leak. The old FeaturedUnitsSection showed only a
 * base "from $X/night" and routed every click through the property *detail*
 * page, where the guest had to re-pick dates and "Check Availability" before
 * they could book.
 *
 * This collapses that: pick dates ONCE here → each unit shows its real total
 * for those dates (one batched /api/quotes/batch call) → "Book now" goes
 * STRAIGHT to /book/[quoteId] checkout, skipping the detail page. A/B target
 * for the Grand Lodge GBP funnel.
 *
 * Live pricing + availability come from BEAPI (the Supabase `listings` mirror
 * backs SEO/feed surfaces only). The initial quote fetch is gated on
 * scroll-into-view so instant-bouncers don't fire BEAPI quote calls.
 */

type QuoteState =
  | { status: "loading" }
  | { status: "ok"; quoteId: string; total: number; nights: number }
  | { status: "unavailable" }
  | { status: "error" };

interface BatchLineResult {
  lineId: string;
  ok: boolean;
  quote?: { quoteId: string; hostPayout: number; nights: number };
  code?: string;
}

/** Parse a "yyyy-MM-dd" string to a local Date at noon (dodges TZ off-by-one). */
function parseISODate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const MAX_BATCH = 10; // /api/quotes/batch hard cap

export function BookableUnitsGrid({
  units: allUnits,
  heading,
  subheading,
  availabilityHref,
  ctaLabel = "See all available units",
  limit = 8,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 2,
  pointofsale,
}: {
  units: Listing[];
  heading: string;
  subheading?: string;
  availabilityHref: string;
  ctaLabel?: string;
  limit?: number;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  pointofsale?: string;
}) {
  const router = useRouter();
  const units = useMemo(
    () => allUnits.slice(0, Math.min(limit, MAX_BATCH)),
    [allUnits, limit]
  );

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseISODate(initialCheckIn);
    const to = parseISODate(initialCheckOut);
    return from && to ? { from, to } : from ? { from, to: undefined } : undefined;
  });
  const [guests, setGuests] = useState(initialGuests);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const [months, setMonths] = useState(1);

  const sectionRef = useRef<HTMLElement | null>(null);
  const firstFetchDone = useRef(false);

  const checkInStr = range?.from ? toISODate(range.from) : "";
  const checkOutStr = range?.to ? toISODate(range.to) : "";

  // Two-month calendar on desktop, one on mobile.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const runFetch = useCallback(async () => {
    if (!checkInStr || !checkOutStr || units.length === 0) return;
    setQuotes(
      Object.fromEntries(units.map((u) => [u.guesty_id, { status: "loading" }]))
    );
    units.forEach((u) =>
      trackCheckAvailability({
        listingId: u.guesty_id,
        listingTitle: u.title || u.nickname || "Grand Lodge unit",
        checkIn: checkInStr,
        checkOut: checkOutStr,
        guests,
      })
    );
    try {
      const res = await fetch("/api/quotes/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(pointofsale ? { pointofsale } : {}),
          lines: units.map((u) => ({
            lineId: u.guesty_id,
            listingId: u.guesty_id,
            checkIn: checkInStr,
            checkOut: checkOutStr,
            guestsCount: Math.max(1, guests),
          })),
        }),
      });
      if (!res.ok) throw new Error("batch quote failed");
      const data: { results?: BatchLineResult[] } = await res.json();
      const next: Record<string, QuoteState> = {};
      for (const u of units) {
        const r = data.results?.find((x) => x.lineId === u.guesty_id);
        if (r?.ok && r.quote?.quoteId) {
          next[u.guesty_id] = {
            status: "ok",
            quoteId: r.quote.quoteId,
            total: r.quote.hostPayout,
            nights: r.quote.nights,
          };
        } else if (r?.code === "DATES_UNAVAILABLE") {
          next[u.guesty_id] = { status: "unavailable" };
        } else {
          next[u.guesty_id] = { status: "error" };
        }
      }
      setQuotes(next);
    } catch {
      setQuotes(
        Object.fromEntries(units.map((u) => [u.guesty_id, { status: "error" }]))
      );
    }
  }, [checkInStr, checkOutStr, guests, units, pointofsale]);

  // Always call the freshest fetch from the IntersectionObserver.
  const runFetchRef = useRef(runFetch);
  useEffect(() => {
    runFetchRef.current = runFetch;
  }, [runFetch]);

  // First fetch: only once the units scroll into view (don't quote for
  // instant-bouncers). Falls back to an immediate fetch if IO is unavailable.
  useEffect(() => {
    if (firstFetchDone.current) return;
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      firstFetchDone.current = true;
      runFetchRef.current();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !firstFetchDone.current) {
          firstFetchDone.current = true;
          runFetchRef.current();
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Subsequent fetches: re-quote when the guest changes dates or party size
  // (debounced). Skipped until the first (scroll-triggered) fetch has run.
  useEffect(() => {
    if (!firstFetchDone.current) return;
    if (!checkInStr || !checkOutStr) return;
    const t = setTimeout(() => runFetch(), 450);
    return () => clearTimeout(t);
  }, [checkInStr, checkOutStr, guests]); // eslint-disable-line react-hooks/exhaustive-deps

  function detailHref(u: Listing): string {
    const slug = getListingSlug(u.title || u.nickname, u.guesty_id);
    const p = new URLSearchParams();
    if (checkInStr) p.set("checkIn", checkInStr);
    if (checkOutStr) p.set("checkOut", checkOutStr);
    if (guests) p.set("guests", String(guests));
    const qs = p.toString();
    return `/properties/${slug}${qs ? `?${qs}` : ""}`;
  }

  function handleBookNow(u: Listing, q: Extract<QuoteState, { status: "ok" }>) {
    trackClickBookNow({
      listingId: u.guesty_id,
      listingTitle: u.title || u.nickname || "Grand Lodge unit",
      checkIn: checkInStr,
      checkOut: checkOutStr,
      guests,
      value: q.total,
    });
    // No sessionStorage seed: /book/[quoteId] re-fetches the full quote via
    // GET /api/quotes/[quoteId], so the checkout gets the complete pricing
    // (taxes, per-night breakdown) the batch summary doesn't carry.
    router.push(`/book/${q.quoteId}`);
  }

  const datesLabel =
    range?.from && range?.to
      ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
      : "Select dates";

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-[1280px] px-4 pt-10 pb-12 sm:px-6 lg:px-8"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {subheading}
            </p>
          )}
        </div>
        <Link
          href={availabilityHref}
          className="hidden items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:inline-flex"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Date + guests bar — pick once, prices update across every card. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60"
            >
              <CalendarDays className="h-4 w-4 text-primary" />
              {datesLabel}
              <span className="text-muted-foreground">·</span>
              <Users className="h-4 w-4 text-primary" />
              {guests} guest{guests === 1 ? "" : "s"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
            <Calendar
              mode="range"
              numberOfMonths={months}
              selected={range}
              onSelect={(r) => {
                setRange(r);
                if (r?.from && r?.to) {
                  setTimeout(() => setPickerOpen(false), 150);
                }
              }}
              disabled={{ before: startOfToday() }}
              showOutsideDays={false}
              className="px-4 pt-3 [--cell-size:2.25rem]"
            />
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">Guests</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Fewer guests"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={guests <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-5 text-center text-sm font-semibold">
                  {guests}
                </span>
                <button
                  type="button"
                  aria-label="More guests"
                  onClick={() => setGuests((g) => Math.min(16, g + 1))}
                  disabled={guests >= 16}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {checkInStr && checkOutStr && (
          <span className="text-xs text-muted-foreground">
            Live prices below — no booking fees.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4">
        {units.map((listing, i) => {
          const q = quotes[listing.guesty_id];
          const photo = listing.pictures?.length
            ? getPhotoUrl(listing.pictures[0], 800)
            : listing.picture
              ? getPhotoUrl(listing.picture, 800)
              : null;
          const displayRating = listing.reviewAvg
            ? (listing.reviewAvg / 2).toFixed(2)
            : null;

          return (
            <div key={listing.guesty_id} className="flex flex-col">
              <Link
                href={detailHref(listing)}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  {photo && (
                    <Image
                      src={photo}
                      alt={listing.title || listing.nickname || "Grand Lodge unit"}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 639px) 50vw, (max-width: 768px) 33vw, 20vw"
                      priority={i < 4}
                      loading={i < 4 ? "eager" : "lazy"}
                    />
                  )}
                </div>
                <div className="mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {listing.address?.city && (
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {listing.address.city}, {listing.address.state}
                        </p>
                      )}
                      <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
                        {listing.title || listing.nickname}
                      </h3>
                    </div>
                    {displayRating && listing.reviewTotal ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-foreground">
                        <Star className="h-3 w-3 fill-current" />
                        {displayRating} ({listing.reviewTotal})
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
                </div>
              </Link>

              {/* Price + CTA — reflects the live quote for the chosen dates. */}
              <div className="mt-1.5">
                {q?.status === "loading" ? (
                  <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking availability…
                  </div>
                ) : q?.status === "ok" ? (
                  <>
                    <SavingsPrice
                      directTotal={q.total}
                      suffix={`for ${q.nights} night${q.nights === 1 ? "" : "s"}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleBookNow(listing, q)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
                    >
                      Book now
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : q?.status === "unavailable" ? (
                  <>
                    <p className="py-1 text-sm font-medium text-muted-foreground">
                      Not available for these dates
                    </p>
                    <Link
                      href={detailHref(listing)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      See other dates
                    </Link>
                  </>
                ) : (
                  // No quote yet (dates not chosen) or an error → base price +
                  // a path into the unit so the card is never a dead end.
                  <>
                    {listing.prices?.basePrice ? (
                      <SavingsPrice
                        directTotal={listing.prices.basePrice}
                        suffix="/ night"
                      />
                    ) : null}
                    <Link
                      href={detailHref(listing)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      View details
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href={availabilityHref}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
