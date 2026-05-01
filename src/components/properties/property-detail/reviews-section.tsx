"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Star,
  Sparkles,
  CheckCircle,
  Key,
  MessageSquare,
  MapPin,
  Tag,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Review, CategoryAverages } from "@/lib/reviews";

interface ReviewsSectionProps {
  reviews: Review[];
  categoryAverages: CategoryAverages;
  totalCount: number;
  displayRating: number | null;
  summary?: string | null;
}

const CATEGORIES: {
  key: keyof CategoryAverages;
  label: string;
  icon: typeof Star;
}[] = [
  { key: "cleanliness", label: "Cleanliness", icon: Sparkles },
  { key: "accuracy", label: "Accuracy", icon: CheckCircle },
  { key: "checkin", label: "Check-in", icon: Key },
  { key: "communication", label: "Communication", icon: MessageSquare },
  { key: "location", label: "Location", icon: MapPin },
  { key: "value", label: "Value", icon: Tag },
];

function formatReviewDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: rating }, (_, i) => (
        <Star key={i} className="h-2.5 w-2.5 fill-current text-accent" />
      ))}
    </div>
  );
}

function MobileSummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sm:hidden">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Review Highlights
        </span>
      </div>
      <p
        className={`text-sm leading-relaxed text-foreground ${expanded ? "" : "line-clamp-3"}`}
      >
        {summary}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-sm font-semibold text-foreground underline underline-offset-2"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function ReviewCardPreview({
  review,
  onShowMore,
}: {
  review: Review;
  onShowMore: () => void;
}) {
  const text = review.public_review || "";
  const isLong = text.length > 200;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {review.overall_rating != null && (
          <StarRating rating={review.overall_rating} />
        )}
        <span className="text-xs text-muted-foreground">
          {formatReviewDate(review.review_date)}
        </span>
      </div>
      <p
        className={`text-sm leading-relaxed text-foreground ${isLong ? "line-clamp-4" : ""}`}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={onShowMore}
          className="text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
        >
          Show more
        </button>
      )}
      {review.reviewer_name && (
        <p className="text-sm font-semibold text-foreground mt-1">
          {review.reviewer_name}
        </p>
      )}
    </div>
  );
}

/** Mobile review card — fixed width for horizontal scroll */
function MobileReviewCard({
  review,
  onShowMore,
}: {
  review: Review;
  onShowMore: () => void;
}) {
  const text = review.public_review || "";
  const isLong = text.length > 150;

  return (
    <div className="w-[300px] flex-none snap-start rounded-xl border border-border p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        {review.overall_rating != null && (
          <StarRating rating={review.overall_rating} />
        )}
        <span className="text-xs text-muted-foreground">
          · {formatReviewDate(review.review_date)}
        </span>
      </div>
      <p
        className={`text-sm leading-relaxed text-foreground ${isLong ? "line-clamp-5" : ""}`}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={onShowMore}
          className="text-sm font-semibold text-foreground underline underline-offset-2"
        >
          Show more
        </button>
      )}
      {review.reviewer_name && (
        <p className="text-sm font-semibold text-foreground pt-1">
          {review.reviewer_name}
        </p>
      )}
    </div>
  );
}

/** Rating distribution bar chart (5 → 1) */
function RatingDistribution({ reviews }: { reviews: Review[] }) {
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1 star, index 4 = 5 stars
    let total = 0;
    for (const r of reviews) {
      if (
        r.overall_rating != null &&
        r.overall_rating >= 1 &&
        r.overall_rating <= 5
      ) {
        counts[r.overall_rating - 1]++;
        total++;
      }
    }
    return { counts, total };
  }, [reviews]);

  if (distribution.total === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Overall rating</p>
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution.counts[star - 1];
          const pct =
            distribution.total > 0 ? (count / distribution.total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="w-3 text-xs text-foreground text-right">
                {star}
              </span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Left sidebar for the dialog — rating, distribution, categories */
function ReviewsSidebar({
  displayRating,
  totalCount,
  reviews,
  categoryAverages,
}: {
  displayRating: number | null;
  totalCount: number;
  reviews: Review[];
  categoryAverages: CategoryAverages;
}) {
  const isTraverseFavorite = displayRating !== null && displayRating >= 4.8;
  const hasCategories = CATEGORIES.some(
    (c) => categoryAverages[c.key] !== null
  );

  return (
    <div className="space-y-6">
      {/* Hero rating */}
      {displayRating !== null && (
        <div className="flex flex-col items-center text-center">
          <p className="text-4xl font-bold text-foreground">
            {displayRating.toFixed(2)}
          </p>
          <div className="mt-1 flex items-center justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < Math.round(displayRating) ? "fill-current text-accent" : "fill-muted text-muted"}`}
              />
            ))}
          </div>
          {isTraverseFavorite && (
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {displayRating >= 4.95
                ? "Top Rated"
                : displayRating >= 4.85
                  ? "Traverse Favorite"
                  : "Guest Approved"}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
            {totalCount} {totalCount === 1 ? "review" : "reviews"}
          </p>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Rating distribution */}
      <RatingDistribution reviews={reviews} />

      {/* Category breakdown */}
      {hasCategories && (
        <div className="space-y-3">
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const value = categoryAverages[key];
            if (value === null) return null;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-foreground" />
                  <span className="text-sm text-foreground">{label}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {value.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Right panel of dialog — header, search, reviews list */
function DialogReviewsList({
  reviews,
  displayRating,
  totalCount,
  categoryAverages,
}: {
  reviews: Review[];
  displayRating: number | null;
  totalCount: number;
  categoryAverages: CategoryAverages;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter((r) => r.public_review?.toLowerCase().includes(q));
  }, [reviews, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          {totalCount} {totalCount === 1 ? "review" : "reviews"}
        </h2>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search all reviews"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Mobile: show sidebar content inline above reviews */}
      <div className="md:hidden mb-6 space-y-4">
        <ReviewsSidebar
          displayRating={displayRating}
          totalCount={totalCount}
          reviews={reviews}
          categoryAverages={categoryAverages}
        />
        <div className="border-t border-border" />
      </div>

      {filteredReviews.length === 0 && searchQuery.trim() && (
        <p className="text-sm text-muted-foreground py-4">
          No reviews matching &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      <div className="space-y-8">
        {filteredReviews.map((review) => (
          <div
            key={review.guesty_id}
            id={`review-${review.guesty_id}`}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              {review.overall_rating != null && (
                <StarRating rating={review.overall_rating} />
              )}
              <span className="text-xs text-muted-foreground">
                · {formatReviewDate(review.review_date)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
              {review.public_review || ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-screen reviews dialog matching Airbnb's layout */
function ReviewsDialog({
  open,
  onClose,
  reviews,
  displayRating,
  totalCount,
  categoryAverages,
  scrollToId,
}: {
  open: boolean;
  onClose: () => void;
  reviews: Review[];
  displayRating: number | null;
  totalCount: number;
  categoryAverages: CategoryAverages;
  scrollToId: string | null;
}) {
  // Scroll to target review after mount
  useEffect(() => {
    if (!open || !scrollToId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(scrollToId);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [open, scrollToId]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const isTraverseFavorite = displayRating !== null && displayRating >= 4.8;
  const favoriteTier =
    displayRating !== null
      ? displayRating >= 4.95
        ? "bridge"
        : displayRating >= 4.85
          ? "rose"
          : displayRating >= 4.8
            ? "plain"
            : null
      : null;
  const hasCategories = CATEGORIES.some(
    (c) => categoryAverages[c.key] !== null
  );

  if (!open) return null;

  return (
    <>
      {/* Desktop dialog */}
      <div className="hidden sm:flex fixed inset-0 z-[100] items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 bg-background rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] mx-4 flex overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 rounded-full p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <div className="hidden md:flex w-[280px] shrink-0 border-r border-border bg-muted p-6 overflow-y-auto">
            <ReviewsSidebar
              displayRating={displayRating}
              totalCount={totalCount}
              reviews={reviews}
              categoryAverages={categoryAverages}
            />
          </div>
          <DialogReviewsList
            reviews={reviews}
            displayRating={displayRating}
            totalCount={totalCount}
            categoryAverages={categoryAverages}
          />
        </div>
      </div>

      {/* Mobile full-screen modal */}
      <div className="sm:hidden fixed inset-0 z-[100] bg-background overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-sm font-medium">
            {totalCount} {totalCount === 1 ? "review" : "reviews"}
          </span>
          <div className="w-8" />
        </div>

        {/* Rating hero */}
        {displayRating !== null && (
          <div className="flex flex-col items-center text-center px-6 pt-6 pb-4">
            <p className="text-6xl font-bold text-foreground">
              {displayRating.toFixed(2)}
            </p>
            <div className="mt-2 flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.round(displayRating) ? "fill-current text-accent" : "fill-muted-foreground/20 text-muted-foreground/20"}`}
                />
              ))}
            </div>
            {isTraverseFavorite && (
              <p className="mt-2 text-lg font-bold text-foreground">
                {favoriteTier === "bridge"
                  ? "Top Rated"
                  : favoriteTier === "rose"
                    ? "Traverse Favorite"
                    : "Guest Approved"}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground max-w-[260px]">
              {favoriteTier === "bridge"
                ? "Guests love this place. One of the highest-rated stays in Portland."
                : favoriteTier === "rose"
                  ? "A guest favorite for comfort, location, and overall experience."
                  : isTraverseFavorite
                    ? "Well-reviewed by guests — consistently rated above average."
                    : `Based on ${totalCount} guest ${totalCount === 1 ? "review" : "reviews"}.`}
            </p>
          </div>
        )}

        {/* Horizontally scrollable categories */}
        {hasCategories && (
          <div className="border-t border-border">
            <div
              className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory"
              style={{ scrollbarWidth: "none" }}
            >
              {/* Rating distribution */}
              <div className="w-[160px] flex-none snap-start px-4 py-4 border-r border-border">
                <RatingDistribution reviews={reviews} />
              </div>
              {CATEGORIES.map(({ key, label, icon: Icon }) => {
                const value = categoryAverages[key];
                if (value === null) return null;
                return (
                  <div
                    key={key}
                    className="w-[120px] flex-none snap-start px-4 py-4 border-r border-border last:border-r-0"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold text-foreground mt-1">
                      {value.toFixed(2)}
                    </p>
                    <Icon className="h-5 w-5 text-muted-foreground mt-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews list */}
        <div className="px-5 pt-6 pb-24">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {totalCount} {totalCount === 1 ? "review" : "reviews"}
          </h2>
          <div className="space-y-6">
            {reviews.map((review) => (
              <div
                key={review.guesty_id}
                id={`review-${review.guesty_id}`}
                className="space-y-2 pb-6 border-b border-border last:border-b-0"
              >
                {review.reviewer_name && (
                  <p className="text-sm font-semibold text-foreground">
                    {review.reviewer_name}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {review.overall_rating != null && (
                    <StarRating rating={review.overall_rating} />
                  )}
                  <span className="text-xs text-muted-foreground">
                    · {formatReviewDate(review.review_date)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                  {review.public_review || ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function ReviewsSection({
  reviews,
  categoryAverages,
  totalCount,
  displayRating,
  summary,
}: ReviewsSectionProps) {
  const hasCategories = CATEGORIES.some(
    (c) => categoryAverages[c.key] !== null
  );
  const showHero = totalCount >= 3 && displayRating !== null;
  const isTraverseFavorite = displayRating !== null && displayRating >= 4.8;
  const favoriteTier =
    displayRating !== null
      ? displayRating >= 4.95
        ? "bridge"
        : displayRating >= 4.85
          ? "rose"
          : displayRating >= 4.8
            ? "plain"
            : null
      : null;
  const visibleReviews = reviews.slice(0, 6);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  const openDialogAt = useCallback((reviewId: string | null) => {
    setScrollToId(reviewId);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setScrollToId(null);
  }, []);

  // No reviews yet — show empty state
  if (totalCount === 0) {
    return (
      <section className="space-y-4">
        <p className="text-lg font-semibold text-foreground">
          New · No reviews (yet)
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Star className="h-5 w-5 text-muted-foreground" />
          <span>This property is waiting for its first guest review.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {/* Desktop: hero rating */}
      {showHero && (
        <div className="hidden sm:flex flex-col items-center text-center py-6">
          <div className="flex items-center gap-2">
            {isTraverseFavorite && (
              <img
                src={`/badges/rose-b-${favoriteTier === "bridge" ? "gold" : favoriteTier === "rose" ? "silver" : "bronze"}-left.png`}
                alt=""
                className="h-16 w-auto"
                aria-hidden="true"
              />
            )}
            <p className="text-6xl font-bold tracking-tight text-foreground">
              {displayRating.toFixed(2)}
            </p>
            {isTraverseFavorite && (
              <img
                src={`/badges/rose-b-${favoriteTier === "bridge" ? "gold" : favoriteTier === "rose" ? "silver" : "bronze"}-right.png`}
                alt=""
                className="h-16 w-auto"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="mt-3 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${i < Math.round(displayRating) ? "fill-current text-accent" : "fill-muted text-muted"}`}
              />
            ))}
          </div>
          {isTraverseFavorite ? (
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-foreground">
                {favoriteTier === "bridge"
                  ? "Top Rated"
                  : favoriteTier === "rose"
                    ? "Traverse Favorite"
                    : "Guest Approved"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {favoriteTier === "bridge"
                  ? "Guests love this place. One of the highest-rated stays in Portland."
                  : favoriteTier === "rose"
                    ? "A guest favorite for comfort, location, and overall experience."
                    : "Well-reviewed by guests — consistently rated above average."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {totalCount} verified {totalCount === 1 ? "review" : "reviews"}
            </p>
          )}
        </div>
      )}

      {/* Mobile: hero rating */}
      {showHero && (
        <div className="sm:hidden flex flex-col items-center text-center py-3">
          <div className="flex items-center gap-1.5">
            {isTraverseFavorite && (
              <img
                src={`/badges/rose-b-${favoriteTier === "bridge" ? "gold" : favoriteTier === "rose" ? "silver" : "bronze"}-left.png`}
                alt=""
                className="h-12 w-auto"
                aria-hidden="true"
              />
            )}
            <p className="text-5xl font-bold tracking-tight text-foreground">
              {displayRating!.toFixed(2)}
            </p>
            {isTraverseFavorite && (
              <img
                src={`/badges/rose-b-${favoriteTier === "bridge" ? "gold" : favoriteTier === "rose" ? "silver" : "bronze"}-right.png`}
                alt=""
                className="h-12 w-auto"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="mt-2 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < Math.round(displayRating!) ? "fill-current text-accent" : "fill-muted text-muted"}`}
              />
            ))}
          </div>
          {isTraverseFavorite ? (
            <div className="mt-2 text-center">
              <p className="text-xs font-semibold text-foreground">
                {favoriteTier === "bridge"
                  ? "Top Rated"
                  : favoriteTier === "rose"
                    ? "Traverse Favorite"
                    : "Guest Approved"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {favoriteTier === "bridge"
                  ? "One of the highest-rated in Portland"
                  : favoriteTier === "rose"
                    ? "A guest favorite for comfort and location"
                    : "Consistently rated above average"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {totalCount} verified {totalCount === 1 ? "review" : "reviews"}
            </p>
          )}
        </div>
      )}

      {/* Category breakdown — horizontal row with dividers */}
      {hasCategories && (
        <div className="hidden sm:flex border-t border-border pt-6">
          <div className="flex w-full">
            {/* Overall rating distribution */}
            <div className="flex-1 pr-6">
              <RatingDistribution reviews={reviews} />
            </div>
            {/* Category scores */}
            {CATEGORIES.map(({ key, label, icon: Icon }) => {
              const value = categoryAverages[key];
              if (value === null) return null;
              return (
                <div
                  key={key}
                  className="flex-1 flex flex-col border-l border-border pl-6"
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-lg font-bold text-foreground mt-1">
                    {value.toFixed(2)}
                  </span>
                  <Icon className="h-5 w-5 text-muted-foreground mt-auto pt-2" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary — collapsible on mobile */}
      {summary && (
        <div className="rounded-2xl border border-border bg-muted/40 px-5 py-4 sm:px-6 sm:py-5">
          {/* Desktop: always expanded */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Review Highlights
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{summary}</p>
          </div>
          {/* Mobile: truncated with expand */}
          <MobileSummary summary={summary} />
        </div>
      )}

      {/* Mobile: horizontally scrollable review cards */}
      {visibleReviews.length > 0 && (
        <div className="sm:hidden -mx-4 px-4">
          <div
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {visibleReviews.map((review) => (
              <MobileReviewCard
                key={review.guesty_id}
                review={review}
                onShowMore={() => openDialogAt(`review-${review.guesty_id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Show all reviews button */}
      {totalCount > 0 && (
        <div className="sm:hidden">
          <Button
            variant="outline"
            className="w-full rounded-xl py-5 text-base font-semibold"
            onClick={() => openDialogAt(null)}
          >
            Show all {totalCount} reviews
          </Button>
        </div>
      )}

      {/* Desktop: review cards grid */}
      {visibleReviews.length > 0 && (
        <div className="hidden sm:grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-x-12 md:gap-y-10">
          {visibleReviews.map((review) => (
            <ReviewCardPreview
              key={review.guesty_id}
              review={review}
              onShowMore={() => openDialogAt(`review-${review.guesty_id}`)}
            />
          ))}
        </div>
      )}

      {/* Desktop: Show all reviews button */}
      {totalCount > 6 && (
        <div className="hidden sm:block">
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={() => openDialogAt(null)}
          >
            Show all {totalCount} reviews
          </Button>
        </div>
      )}

      {/* Airbnb-style reviews dialog */}
      <ReviewsDialog
        open={dialogOpen}
        onClose={closeDialog}
        reviews={reviews}
        displayRating={displayRating}
        totalCount={totalCount}
        categoryAverages={categoryAverages}
        scrollToId={scrollToId}
      />
    </section>
  );
}
