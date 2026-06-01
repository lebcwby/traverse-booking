"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { CURATED_REVIEWS, type CuratedReview } from "@/lib/google-reviews";

interface GoogleReviewsCarouselProps {
  /** Optional override — defaults to CURATED_REVIEWS from lib/google-reviews.ts */
  reviews?: CuratedReview[];
  /** Filter to one type. Omit to show both guest + owner reviews. */
  type?: CuratedReview["type"];
  /** Heading override. Falls back to "Real reviews from Google". */
  heading?: string;
  /** Subhead override. */
  subhead?: string;
  /** Background variant — match parent section. */
  background?: "white" | "muted";
}

// Stable Fisher-Yates shuffle that returns a fresh array per mount.
// Stops the same review from always landing in slot 1 on every page view.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function GoogleReviewsCarousel({
  reviews,
  type,
  heading = "Real reviews from Google",
  subhead = "4.8 stars from thousands of stays across Colorado.",
  background = "white",
}: GoogleReviewsCarouselProps) {
  const source = reviews ?? CURATED_REVIEWS;
  const filtered = type ? source.filter((r) => r.type === type) : source;

  // Shuffle once on mount so SSR + first paint are deterministic. We only
  // randomize after hydration to avoid SSR/CSR mismatch.
  const [items, setItems] = useState<CuratedReview[]>(filtered);
  useEffect(() => {
    setItems(shuffle(filtered));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Card width + gap. Tweak in lockstep with the card style below.
    const step = el.clientWidth > 700 ? 380 : el.clientWidth - 40;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const sectionBg = background === "muted" ? "bg-[hsl(215_25%_95%)]" : "bg-white";

  // Empty-state guard — never render an empty carousel
  if (items.length === 0) return null;

  return (
    <section className={`${sectionBg} px-4 py-16 sm:px-6 sm:py-20`}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2">
            {/* Google "G" mark */}
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Reviews
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-3 text-base text-neutral-600 sm:text-lg">{subhead}</p>
        </div>

        <div className="relative mt-12">
          {/* Prev / next buttons (desktop only) */}
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous reviews"
            className="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-50 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next reviews"
            className="absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-50 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Horizontal scrolling track. Snap-x for mobile feel. */}
          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 sm:gap-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {items.map((r, i) => (
              <ReviewCard key={`${r.authorName}-${i}`} review={r} />
            ))}
          </div>
        </div>

        {/* "View all on Google" link */}
        <div className="mt-8 text-center">
          <a
            href="https://www.google.com/search?q=traverse+leadville"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-700 underline-offset-4 hover:underline"
          >
            See all reviews on Google
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: CuratedReview }) {
  const initial = useMemo(() => {
    const name = review.authorName.trim();
    return name.length > 0 ? name[0].toUpperCase() : "G";
  }, [review.authorName]);

  const badgeBg =
    review.type === "owner"
      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
      : "bg-sky-100 text-sky-900 ring-1 ring-sky-200";
  const badgeLabel = review.type === "owner" ? "Owner" : "Guest";

  return (
    <article
      className="flex min-w-[300px] max-w-[360px] shrink-0 snap-start flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:min-w-[340px]"
    >
      {/* Header: avatar + name + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">
              {review.authorName}
            </div>
            {review.context && (
              <div className="truncate text-[12px] text-neutral-500">
                {review.context}
              </div>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeBg}`}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Stars */}
      <div className="mt-4 flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < review.rating
                ? "fill-yellow-400 stroke-yellow-400"
                : "fill-neutral-200 stroke-neutral-200"
            }`}
            strokeWidth={1.5}
          />
        ))}
      </div>

      {/* Body */}
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-700">
        &ldquo;{review.text}&rdquo;
      </p>

      {/* Google attribution footer */}
      <div className="mt-5 flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>Posted on Google</span>
      </div>
    </article>
  );
}
