import Image from "next/image";
import Link from "next/link";
import { Star, Quote } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function getTopReviews() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: reviews } = await supabaseAdmin
    .from("reviews")
    .select("reviewer_name, overall_rating, public_review, review_date")
    .eq("overall_rating", 5)
    .not("public_review", "is", null)
    .order("review_date", { ascending: false })
    .limit(100);

  if (!reviews || reviews.length === 0)
    return { reviews: [], avg: 0, count: 0 };

  const topReviews = reviews
    .filter((r) => r.public_review && r.public_review.length > 80)
    .sort(
      (a, b) => (b.public_review?.length ?? 0) - (a.public_review?.length ?? 0)
    )
    .slice(0, 4);

  const { count } = await supabaseAdmin
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .not("overall_rating", "is", null);

  const { data: allRatings } = await supabaseAdmin
    .from("reviews")
    .select("overall_rating")
    .not("overall_rating", "is", null)
    .limit(1000);

  const avg =
    allRatings && allRatings.length > 0
      ? allRatings.reduce((sum, r) => sum + (r.overall_rating ?? 0), 0) /
        allRatings.length
      : 4.9;

  return {
    reviews: topReviews,
    avg: Math.round(avg * 100) / 100,
    count: count ?? 0,
  };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-amber-400 text-amber-400" : "text-white/20"}`}
        />
      ))}
    </div>
  );
}

export async function TestimonialsSection() {
  const { reviews, avg, count } = await getTopReviews();

  if (reviews.length === 0) return null;

  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Dark background with subtle photo */}
      <div className="absolute inset-0 bg-[hsl(178,29%,14%)]" />
      <div className="absolute inset-0 opacity-20">
        <Image
          src="/images/home/photo-1645934430496-6cae81215bf9.jpeg"
          alt=""
          fill
          className="object-cover"
          aria-hidden="true"
        />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          What Our Guests Say
        </h2>
        <p className="mt-3 max-w-xl text-lg text-white/70">
          Real reviews from real guests who booked their Portland vacation
          rental with us.
        </p>
        {count > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <span className="text-sm font-medium text-white/80">
              {avg.toFixed(2)} average across {count.toLocaleString()}+ reviews
            </span>
          </div>
        )}
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {reviews.map((review, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/10 backdrop-blur-sm p-6 border border-white/5"
            >
              <Quote className="h-6 w-6 text-accent/60 mb-3" />
              <p className="text-sm leading-relaxed text-white/85">
                {review.public_review && review.public_review.length > 200
                  ? review.public_review.slice(0, 200).trim() + "\u2026"
                  : review.public_review}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  {review.reviewer_name || "Guest"}
                </p>
                <StarRating rating={review.overall_rating} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/reviews"
            className="text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Read all {count.toLocaleString()}+ guest reviews →
          </Link>
        </div>
      </div>
    </section>
  );
}
