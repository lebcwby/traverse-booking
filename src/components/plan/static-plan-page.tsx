// src/components/plan/static-plan-page.tsx
// Server-rendered, SEO-first view of a pre-seeded trip plan. Reuses the
// interactive timeline + map components as client children but pre-hydrates
// POIs and listings server-side so the first paint contains all content
// (no client fetch dance — Googlebot sees the full page).
//
// Intentionally avoids chat-specific chrome (edit pills, save-to-email CTA
// in top bar, BEAPI date dependencies). Dates from the seeded plan are
// suppressed so the page stays evergreen.

import Link from "next/link";
import { ArrowRight, Home, MapPin, Sparkles, Users } from "lucide-react";
import type { Itinerary } from "@/lib/plan/schema";
import type { Poi } from "@/lib/pois/types";
import type { Listing } from "@/lib/supabase";
import type { PlanSlugEntry } from "@/lib/plan/slug-map";
import { formatNeighborhood } from "@/lib/plan/neighborhood-match";
import { getListingSlug, getPhotoUrl, clampReviewAvg } from "@/lib/utils";
import { ItineraryTimeline } from "./itinerary-timeline";
import { ItineraryMap } from "./itinerary-map";
import { allPlanSlugs } from "@/lib/plan/slug-map";
import { AUTHOR_BYLINE, getSlugContent } from "@/lib/plan/slug-content";
import { MarkdownContent } from "@/components/seo/markdown-content";

interface StaticPlanPageProps {
  entry: PlanSlugEntry;
  itinerary: Itinerary;
  poisById: Record<string, Poi>;
  listings: Listing[];
}

function tripLengthLabel(nights: number): string {
  if (nights <= 1) return "One-night itinerary";
  if (nights === 2) return "2-night weekend itinerary";
  if (nights === 3) return "3-night long weekend";
  if (nights <= 5) return `${nights}-night itinerary`;
  return `${nights}-night trip`;
}

function countNeighborhoods(
  itinerary: Itinerary,
  poisById: Record<string, Poi>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const poi = poisById[item.poiId];
      if (!poi?.neighborhood) continue;
      const label = formatNeighborhood(poi.neighborhood);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

function totalStops(itinerary: Itinerary): number {
  return itinerary.days.reduce((n, d) => n + d.items.length, 0);
}

// Strip concrete dates so the page doesn't age. We clone the itinerary with
// isTentative=true so any downstream component that reads dates renders its
// date-free variant.
function evergreenItinerary(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    dates: { ...itinerary.dates, isTentative: true },
  };
}

export function StaticPlanPage({
  entry,
  itinerary,
  poisById,
  listings,
}: StaticPlanPageProps) {
  const ev = evergreenItinerary(itinerary);
  const nights = itinerary.dates.nights;
  const neighborhoods = countNeighborhoods(ev, poisById);
  const stops = totalStops(ev);
  const otherSlugs = allPlanSlugs().filter((s) => s.slug !== entry.slug);
  const content = getSlugContent(entry.slug);

  return (
    <article className="mx-auto w-full max-w-[1200px] px-5 py-8 lg:px-6 lg:py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-neutral-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-neutral-900">
              Book Traverse
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/plan" className="hover:text-neutral-900">
              Trip Plans
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-neutral-700">{entry.h1}</li>
        </ol>
      </nav>

      {/* Hero */}
      <header className="mb-8 border-b border-neutral-200 pb-8">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
          {entry.h1}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-700">
          {entry.subtitle}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[13px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1">
            {tripLengthLabel(nights)}
          </span>
          {neighborhoods.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1">
              <MapPin className="h-3.5 w-3.5" />
              {neighborhoods.length}{" "}
              {neighborhoods.length === 1 ? "neighborhood" : "neighborhoods"}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1">
            {stops} stops
          </span>
        </div>
        <p className="mt-4 text-sm italic text-neutral-600">
          <span className="not-italic font-medium text-neutral-700">
            Ideal for:
          </span>{" "}
          {entry.idealFor}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/95"
          >
            <Sparkles className="h-4 w-4" />
            Build your own version
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 hover:border-neutral-400"
          >
            Browse 275+ Portland rentals
          </Link>
        </div>
        {/* E-E-A-T author byline — small but visible attribution block. */}
        <p className="mt-5 text-[12.5px] leading-relaxed text-neutral-500">
          {AUTHOR_BYLINE}
        </p>
      </header>

      {/* Body: timeline + right rail */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <main className="min-w-0 flex-1">
          <ItineraryTimeline itinerary={ev} poisById={poisById} />

          {ev.notes && ev.notes.length > 0 && (
            <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-900">
                Practical notes
              </h2>
              <ul className="mt-2 space-y-1 text-[13px] text-neutral-700">
                {ev.notes.map((note, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-neutral-400">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Neighborhood rollup — good SEO surface, surfaces internal links */}
          {neighborhoods.length > 0 && (
            <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-neutral-900">
                Neighborhoods you&rsquo;ll explore
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {neighborhoods.map((nb) => (
                  <Link
                    key={nb}
                    href={`/neighborhoods/${slugifyNeighborhood(nb)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[13px] text-neutral-700 hover:border-neutral-300 hover:bg-white"
                  >
                    <MapPin className="h-3 w-3 text-neutral-500" />
                    {nb}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="w-full shrink-0 lg:w-[380px] xl:w-[400px]">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6">
            <ItineraryMap itinerary={ev} poisById={poisById} />

            {/* Trip-at-a-glance — no dates, keeps page evergreen */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-[13px]">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Trip at a glance
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                <dt className="text-neutral-500">Length</dt>
                <dd className="text-right font-medium text-neutral-900">
                  {nights} {nights === 1 ? "night" : "nights"}
                </dd>
                <dt className="text-neutral-500">Pace</dt>
                <dd className="text-right font-medium capitalize text-neutral-900">
                  {ev.party.vibe}
                </dd>
                <dt className="text-neutral-500">Stops</dt>
                <dd className="text-right font-medium text-neutral-900">
                  {stops}
                </dd>
                {neighborhoods.length > 0 && (
                  <>
                    <dt className="text-neutral-500">Neighborhoods</dt>
                    <dd className="text-right font-medium text-neutral-900">
                      {neighborhoods.length}
                    </dd>
                  </>
                )}
              </dl>
            </div>

            {/* Listings strip */}
            {listings.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                  <Home className="h-4 w-4" />
                  Rentals for a trip like this
                </h2>
                <p className="mt-1 text-[12.5px] text-neutral-600">
                  Direct bookings only — no fees, best price guaranteed.
                </p>
                <ul className="mt-3 space-y-3">
                  {listings.slice(0, 4).map((l) => (
                    <li key={String(l.id ?? l.guesty_id)}>
                      <Link
                        href={`/properties/${getListingSlug(l.title, l.guesty_id || "")}`}
                        className="flex items-center gap-3 rounded-xl border border-transparent p-1 transition hover:border-neutral-200 hover:bg-neutral-50"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                          {l.picture && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getPhotoUrl(l.picture, 200)}
                              alt={l.title ?? "Book Traverse rental"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-neutral-900">
                            {l.title ?? l.nickname ?? "Portland rental"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-neutral-500">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Sleeps {l.accommodates ?? "?"}
                            </span>
                            {clampReviewAvg(l.reviewAvg) != null && (
                              <span>
                                ★{" "}
                                {(clampReviewAvg(l.reviewAvg)! / 2).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/properties"
                  className="mt-3 block w-full rounded-full border border-neutral-300 bg-white px-4 py-2 text-center text-[13px] font-semibold text-neutral-800 hover:border-neutral-400"
                >
                  See all 275+ rentals
                </Link>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Long-form SEO body — keyword-targeted H2s, context sections. */}
      {content && (
        <section className="mt-12 border-t border-neutral-200 pt-10">
          <div className="mx-auto max-w-2xl">
            <MarkdownContent content={content.body} />
          </div>
        </section>
      )}

      {/* FAQ — renders as visible Q/A so Google can surface answers without
          user interaction. Matched by FAQPage JSON-LD on this page. */}
      {content && content.faqs.length > 0 && (
        <section className="mt-12 border-t border-neutral-200 pt-10">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-2xl font-bold text-foreground sm:text-[1.65rem]">
              Frequently asked questions
            </h2>
            <dl className="space-y-6">
              {content.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border-b border-neutral-200 pb-6 last:border-b-0"
                >
                  <dt className="text-[17px] font-semibold text-foreground">
                    {faq.question}
                  </dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-[1.05rem] sm:leading-[1.8]">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Related plans */}
      <section className="mt-12 border-t border-neutral-200 pt-8">
        <h2 className="text-lg font-semibold text-neutral-900">
          More Portland trip ideas
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {otherSlugs.map((s) => (
            <Link
              key={s.slug}
              href={`/plan/${s.slug}`}
              className="group rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <h3 className="text-sm font-semibold text-neutral-900">{s.h1}</h3>
              <p className="mt-1.5 text-[12.5px] leading-snug text-neutral-600">
                {s.subtitle}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary group-hover:gap-1.5">
                Read itinerary
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-10 rounded-3xl bg-primary/5 p-8 text-center">
        <h2 className="text-xl font-semibold text-neutral-900">
          Build your own Portland trip
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-700">
          Tell our Portland team what you&rsquo;re into and we&rsquo;ll build a
          day-by-day itinerary with a map and matching vacation rentals — free,
          in under a minute.
        </p>
        <Link
          href="/plan"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/95"
        >
          <Sparkles className="h-4 w-4" />
          Start your free trip plan
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </article>
  );
}

function slugifyNeighborhood(label: string): string {
  return label
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
