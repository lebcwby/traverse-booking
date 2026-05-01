import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Star,
  Quote,
  Shield,
  MapPin,
  Phone,
  Users,
  ChevronDown,
  Sparkles,
  MessageCircle,
  Home,
} from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getListingSlug } from "@/lib/utils";
import { StickyCTA } from "@/components/marketing/sticky-cta";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";

export const metadata: Metadata = {
  title: "Book Traverse Reviews — Guest Reviews From 7,700+ Verified Stays",
  description:
    "87% 5-star reviews from 7,700+ verified guests. Read real Portland vacation rental reviews — sourced from Airbnb, VRBO & direct bookings on BookTraverse.com.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/reviews" },
  openGraph: {
    title: "Book Traverse Reviews — 7,700+ Verified Guest Reviews",
    description:
      "87% 5-star reviews from 7,700+ verified guests. Read real Portland vacation rental reviews from Airbnb, VRBO & direct bookings.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

interface ReviewWithProperty {
  reviewer_name: string | null;
  overall_rating: number;
  public_review: string | null;
  review_date: string | null;
  listing_id: string | null;
  property_title: string | null;
  property_guesty_id: string | null;
  property_neighborhood: string | null;
}

// Map common tags to readable neighborhood names
const NEIGHBORHOOD_MAP: Record<string, string> = {
  "southeast-portland": "Southeast Portland",
  "northeast-portland": "Northeast Portland",
  "northwest-portland": "Northwest Portland",
  "north-portland": "North Portland",
  "southwest-portland": "Southwest Portland",
  hawthorne: "Hawthorne",
  alberta: "Alberta Arts District",
  mississippi: "Mississippi",
  "pearl-district": "Pearl District",
  sellwood: "Sellwood",
  kerns: "Kerns",
  "division-street": "Division Street",
  buckman: "Buckman",
  "st-johns": "St. Johns",
  woodstock: "Woodstock",
  "alphabet-district": "Alphabet District",
};

function getNeighborhood(tags: string[] | null): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    const name = NEIGHBORHOOD_MAP[tag.toLowerCase()];
    if (name) return name;
  }
  return null;
}

async function getReviewData() {
  const supabaseAdmin = getSupabaseAdmin();

  // Aggregate stats — single SQL query instead of fetching 10K+ rows
  const { getPool } = await import("@/lib/db");
  const pool = getPool();
  const {
    rows: [stats],
  } = await pool.query(
    `SELECT AVG(overall_rating)::float8 as avg, COUNT(*)::int as count
     FROM reviews WHERE overall_rating IS NOT NULL`
  );
  const totalCount = stats?.count ?? 0;
  const avg = stats?.avg ?? 4.8;

  // Featured: long 5-star reviews from the past 12 months for date diversity
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffDate = twelveMonthsAgo.toISOString().split("T")[0];

  const { data: featuredReviews } = await supabaseAdmin
    .from("reviews")
    .select(
      "reviewer_name, overall_rating, public_review, review_date, listing_id"
    )
    .eq("overall_rating", 5)
    .not("public_review", "is", null)
    .gte("review_date", cutoffDate)
    .order("review_date", { ascending: false })
    .limit(500);

  const allFeatured = (featuredReviews ?? []).filter(
    (r) => r.public_review && r.public_review.length > 100
  );

  // Pull quotes: longest, most descriptive reviews
  const pullQuotes = [...allFeatured]
    .sort(
      (a, b) => (b.public_review?.length ?? 0) - (a.public_review?.length ?? 0)
    )
    .slice(0, 2);

  // Supporting: pick from different months for date diversity
  const pullQuoteTexts = new Set(pullQuotes.map((r) => r.public_review));
  const remaining = allFeatured.filter(
    (r) => !pullQuoteTexts.has(r.public_review)
  );

  // Group by month, pick 1-2 from each for diversity
  const byMonth = new Map<string, typeof remaining>();
  for (const r of remaining) {
    const month = r.review_date ? r.review_date.slice(0, 7) : "unknown";
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(r);
  }

  const supporting: typeof remaining = [];
  const sortedMonths = Array.from(byMonth.keys()).sort().reverse();
  for (const month of sortedMonths) {
    if (supporting.length >= 9) break;
    const monthReviews = byMonth.get(month)!;
    // Sort by length within month, take top 1-2
    monthReviews.sort(
      (a, b) => (b.public_review?.length ?? 0) - (a.public_review?.length ?? 0)
    );
    const take = supporting.length < 6 ? 1 : 1;
    supporting.push(...monthReviews.slice(0, take));
  }

  // If not enough from month-diversity, fill from remaining
  if (supporting.length < 9) {
    const usedTexts = new Set(supporting.map((r) => r.public_review));
    const filler = remaining
      .filter((r) => !usedTexts.has(r.public_review))
      .slice(0, 9 - supporting.length);
    supporting.push(...filler);
  }

  // Enrich reviews with property data
  const allReviews = [...pullQuotes, ...supporting];
  const listingIds = Array.from(
    new Set(allReviews.map((r) => r.listing_id).filter(Boolean))
  ) as string[];

  const listingsMap = new Map<
    string,
    { title: string | null; guesty_id: string; tags: string[] | null }
  >();

  if (listingIds.length > 0) {
    const { data: listings } = await supabaseAdmin
      .from("listings")
      .select("guesty_id, title, nickname, tags")
      .in("guesty_id", listingIds);

    if (listings) {
      for (const l of listings) {
        listingsMap.set(l.guesty_id, {
          title: l.title || l.nickname,
          guesty_id: l.guesty_id,
          tags: l.tags,
        });
      }
    }
  }

  function enrichReview(r: (typeof allReviews)[number]): ReviewWithProperty {
    const listing = r.listing_id ? listingsMap.get(r.listing_id) : null;
    return {
      ...r,
      property_title: listing?.title ?? null,
      property_guesty_id: listing?.guesty_id ?? null,
      property_neighborhood: listing ? getNeighborhood(listing.tags) : null,
    };
  }

  return {
    avg: Math.round(avg * 100) / 100,
    count: totalCount ?? 0,
    pullQuotes: pullQuotes.map(enrichReview),
    supporting: supporting.slice(0, 9).map(enrichReview),
  };
}

function StarRating({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${sizeClass} ${i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewWithProperty }) {
  const text = review.public_review ?? "";
  const displayText =
    text.length > 260 ? text.slice(0, 260).trim() + "\u2026" : text;
  const date = review.review_date
    ? new Date(review.review_date).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="flex items-start justify-between">
        <StarRating rating={review.overall_rating} />
        {date && <span className="text-xs text-muted-foreground">{date}</span>}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {displayText}
      </p>
      <div className="mt-3">
        <p className="text-sm font-medium text-foreground">
          {review.reviewer_name || "Verified Guest"}
        </p>
        {review.property_title && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stayed at{" "}
            {review.property_guesty_id ? (
              <Link
                href={`/properties/${getListingSlug(review.property_title, review.property_guesty_id)}`}
                className="text-primary hover:underline"
              >
                {review.property_title}
              </Link>
            ) : (
              review.property_title
            )}
            {review.property_neighborhood && (
              <> &middot; {review.property_neighborhood}</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

const REVIEW_FAQS = [
  {
    q: "Are Book Traverse reviews real?",
    a: "Every review on this page comes from a guest who completed a verified stay at one of our properties. Reviews are sourced from Airbnb, VRBO, and direct bookings on BookTraverse.com. We feature our highest-rated reviews here — you can see all reviews, including critical ones, on each property's individual listing page.",
  },
  {
    q: "Is it safe to book directly on BookTraverse.com?",
    a: "Payments are processed through Stripe, the same processor behind Airbnb, Shopify, and Lyft. Your card details never touch our servers. You get instant booking confirmation and can reach our Portland team anytime by phone or text.",
  },
  {
    q: "How does booking direct compare to Airbnb or VRBO?",
    a: "You're booking the exact same property managed by the exact same team. The only difference is that BookTraverse.com doesn't charge the 10\u201315% service fee that platforms add on top. Same home, lower price, direct support.",
  },
  {
    q: "What happens if something goes wrong during my stay?",
    a: "Our Portland-based guest services team is available by phone and text around the clock. Because we manage every property ourselves, we resolve issues directly \u2014 whether it's a lockout, a maintenance need, or a restaurant recommendation.",
  },
  {
    q: "Can I see reviews for a specific Portland vacation rental?",
    a: "Yes. Every property listing on BookTraverse.com displays its individual guest reviews and rating. Browse our properties to find reviews for the specific home you're considering.",
  },
];

export default async function ReviewsPage() {
  const { avg, count, pullQuotes, supporting } = await getReviewData();

  const allDisplayedReviews = [...pullQuotes, ...supporting];

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": "https://www.booktraverse.com/#organization",
    name: "Book Traverse",
    url: "https://www.booktraverse.com",
    image: "https://www.booktraverse.com/og-image.png",
    telephone: "+1-971-362-4726",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Portland",
      addressRegion: "OR",
      addressCountry: "US",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: String(avg),
      reviewCount: String(count),
      bestRating: "5",
      worstRating: "1",
    },
    review: allDisplayedReviews
      .filter(
        (r) =>
          r.reviewer_name &&
          r.review_date &&
          r.public_review &&
          r.overall_rating &&
          r.property_guesty_id
      )
      .slice(0, 10)
      .map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.reviewer_name },
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(r.overall_rating),
          bestRating: "5",
          worstRating: "1",
        },
        datePublished: new Date(r.review_date!).toISOString().split("T")[0],
        reviewBody: r.public_review,
        url: `https://www.booktraverse.com/properties/${getListingSlug(r.property_title || "", r.property_guesty_id!)}`,
      })),
  });

  const faqJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: REVIEW_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  });

  const breadcrumbLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Book Traverse",
        item: "https://www.booktraverse.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guest Reviews",
        item: "https://www.booktraverse.com/reviews",
      },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      <StickyCTA
        href="/properties"
        label="Browse All Properties"
        sublabel="275+ homes"
      />

      {/* ── Breadcrumb ── */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 lg:px-8"
      >
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Guest Reviews</li>
        </ol>
      </nav>

      {/* ── Hero ── */}
      <section className="pb-14 pt-8 sm:pb-20 sm:pt-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <StarRating rating={5} size="md" />
            <span className="text-sm font-medium text-muted-foreground">
              {avg.toFixed(2)} out of 5
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-4xl sm:leading-[1.15]">
            Book Traverse Guest Reviews
          </h1>
          <p className="mt-2 text-lg font-medium text-primary">
            {count.toLocaleString()}+ verified reviews. 87% five stars.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            We manage 275+ vacation rentals across Portland, Oregon and have
            hosted over 80,000 guests since 2016. Below are real Portland
            vacation rental reviews from Airbnb, VRBO, and direct bookings on
            BookTraverse.com.
          </p>
        </div>
      </section>

      {/* ── Pull quotes — the two best reviews, large format ── */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[hsl(178,29%,14%)]" />
        <div className="absolute inset-0 opacity-15">
          <Image
            src="/images/home/photo-1645934430496-6cae81215bf9.jpeg"
            alt=""
            fill
            className="object-cover"
            aria-hidden="true"
          />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {pullQuotes.map((review, i) => (
              <div key={i} className="flex flex-col">
                <Quote className="h-8 w-8 text-accent/50" />
                <p className="mt-4 text-lg leading-relaxed text-white/90 sm:text-xl sm:leading-relaxed">
                  {review.public_review && review.public_review.length > 400
                    ? review.public_review.slice(0, 400).trim() + "\u2026"
                    : review.public_review}
                </p>
                <div className="mt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <p className="text-sm font-medium text-white/70">
                      {review.reviewer_name || "Verified Guest"}
                    </p>
                    <StarRating rating={review.overall_rating} />
                  </div>
                  {review.property_title && (
                    <p className="mt-2 text-right text-xs text-white/40">
                      {review.property_title}
                      {review.property_neighborhood && (
                        <> &middot; {review.property_neighborhood}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What guests consistently say ── */}
      <section className="bg-secondary/30 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What Guests Say About Book Traverse
          </h2>
          <p className="mt-3 text-muted-foreground">
            Across thousands of reviews, guests consistently highlight the same
            things.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-5 border border-border">
              <MapPin className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Walkable Locations
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Guests love being steps from restaurants, coffee shops, and
                parks in neighborhoods like{" "}
                <Link
                  href={getLandingPagePath("hawthorne-belmont")}
                  className="text-primary hover:underline"
                >
                  Hawthorne
                </Link>
                ,{" "}
                <Link
                  href={getLandingPagePath("alberta")}
                  className="text-primary hover:underline"
                >
                  Alberta
                </Link>
                , and the{" "}
                <Link
                  href={getLandingPagePath("northwest-portland")}
                  className="text-primary hover:underline"
                >
                  Alphabet District
                </Link>
                .
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-border">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Clean &amp; Well-Designed
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Professional cleaning between every stay. Design-forward
                interiors with quality linens, fully equipped kitchens, and
                hotel-level amenities.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-border">
              <MessageCircle className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Responsive Communication
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Our local team responds quickly — before, during, and after
                every stay. No call centers, no bots, no runaround.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 border border-border">
              <Home className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Accurate Listings
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                What you see is what you get. Guests consistently note that our
                homes match or exceed the photos and descriptions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Review grid ── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Recent Guest Reviews of Book Traverse Vacation Rentals
          </h2>
          <p className="mt-3 text-muted-foreground">
            Verified reviews from guests who stayed at our Portland homes.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {supporting.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
            <Link
              href="/properties"
              className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse All Properties
            </Link>
            <Link
              href="/properties"
              className="text-sm font-medium text-primary hover:underline"
            >
              See individual property reviews →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="bg-secondary/30 py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Portland-Based. Locally Managed. Every Property.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Book Traverse isn&apos;t a listing aggregator or a Silicon
                Valley marketplace. We&apos;re a Portland vacation rental
                company that manages every home ourselves — from cleaning and
                maintenance to guest support. When you book with us, you&apos;re
                booking directly with the people who hold the keys.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Local team since 2016
                    </span>{" "}
                    &mdash; our office, our staff, our city
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Payments via Stripe
                    </span>{" "}
                    &mdash; same processor as Airbnb, Shopify, and Lyft
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Same homes as Airbnb &amp; VRBO
                    </span>{" "}
                    &mdash; booking direct just skips the 10&ndash;15% platform
                    fee
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Real people, always reachable
                    </span>{" "}
                    &mdash;{" "}
                    <a
                      href="tel:+19713624726"
                      className="text-primary hover:underline"
                    >
                      (971) 362-4726
                    </a>{" "}
                    or{" "}
                    <a
                      href="mailto:hello@booktraverse.com"
                      className="text-primary hover:underline"
                    >
                      hello@booktraverse.com
                    </a>
                  </p>
                </div>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                You can also find our properties and guest reviews on{" "}
                <a
                  href="https://www.booking.com/hotel/us/book-traverse-collection-the-perfect-portland-escape.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Booking.com
                </a>{" "}
                and{" "}
                <a
                  href="https://www.airbnb.com/s/Portland--OR/homes?query=Stay%20Portland"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Airbnb
                </a>
                .
              </p>
            </div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl lg:col-span-2">
              <Image
                src="/images/home/home-casa-adelynn-cover.jpg"
                alt="Book Traverse vacation rental — The Adelynn in Portland's Kerns neighborhood"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Questions About Book Traverse Reviews
          </h2>
          <div className="mt-8">
            {REVIEW_FAQS.map((faq, i) => (
              <div key={i} className="border-b border-border">
                <details className="group">
                  <summary className="flex w-full cursor-pointer list-none items-center justify-between py-5 text-left [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold text-foreground pr-4 sm:text-lg">
                      {faq.q}
                    </h3>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <p className="pb-5 leading-relaxed text-muted-foreground">
                    {faq.a}
                  </p>
                </details>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/home/portland-sunset-skyline.jpg"
            alt="Portland skyline at sunset"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            See For Yourself
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            275+ vacation homes across Portland&apos;s best neighborhoods. Book
            direct for the lowest price.
          </p>
          <Link
            href="/properties"
            className="mt-8 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
          >
            Browse All Properties
          </Link>
          <div className="mx-auto mt-6 max-w-md">
            <InlineEmailCapture
              headline="Get the best Portland deals in your inbox."
              buttonText="Send it"
              variant="dark"
            />
          </div>
        </div>
      </section>
    </>
  );
}
