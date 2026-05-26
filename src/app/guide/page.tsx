import type { Metadata } from "next";
import Link from "next/link";
import { getAllGuideArticles, type GuideArticle } from "@/lib/guide-content";
import { getAllBlogPosts, type BlogPost } from "@/lib/seo-content";
import { ArticleCard } from "@/components/guide/article-card";
import { BlogPostCard } from "@/components/guide/blog-post-card";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Portland Travel Guide — Restaurants, Breweries & Things to Do",
  description:
    "A local's guide to Portland, Oregon — the best neighborhoods, restaurants, breweries, parks, day trips, events, and where to stay. Written by the team that manages 275+ vacation rentals across the city.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Portland Travel Guide | Book Traverse",
    description:
      "A local's guide to Portland — best neighborhoods, restaurants, breweries, parks, and things to do. Written by locals who manage 275+ homes across the city.",
    url: "https://www.booktraverse.com/guide",
    type: "website",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
};

// Pillar label mapping for blog posts
const PILLAR_LABELS: Record<string, string> = {
  neighborhoods: "Neighborhoods",
  food: "Food & Drink",
  events: "Events",
  tips: "Travel Tips",
  seasonal: "Seasonal",
  "portland-life": "Portland Life",
};

export default async function GuidePage() {
  const articles = getAllGuideArticles();
  const blogPosts = await getAllBlogPosts();

  // Merge into unified list sorted by date (newest first)
  const allCards = [
    ...articles.map((a) => ({
      type: "article" as const,
      slug: a.slug,
      date: a.updatedAt || a.publishedAt,
      article: a,
      post: undefined as BlogPost | undefined,
    })),
    ...blogPosts.map((p) => ({
      type: "blog" as const,
      slug: p.slug,
      date: p.published_at || "",
      article: undefined as GuideArticle | undefined,
      post: p,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // JSON-LD — our own content strings, not user input
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Portland Travel Guide",
    description:
      "A local's guide to Portland, Oregon — neighborhoods, restaurants, breweries, parks, events, and where to stay.",
    url: "https://www.booktraverse.com/guide",
    provider: { "@id": "https://www.booktraverse.com/#organization" },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: allCards.map((card, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://www.booktraverse.com/guide/${card.slug}`,
        name: card.article?.title || card.post?.title,
      })),
    },
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
        name: "Portland Guide",
        item: "https://www.booktraverse.com/guide",
      },
    ],
  });

  const firstBatch = allCards.slice(0, 6);
  const restBatch = allCards.slice(6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />

      {/* Hero */}
      <section className="bg-primary py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Portland Travel Guide
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            A local&apos;s guide to Portland, Oregon — written by the team that
            manages 275+ vacation rentals across the city. Where to stay, what
            to eat, and what not to miss.
          </p>
          <p className="mt-3 text-sm font-medium text-accent">
            No Booking Fees · Save 10–15% vs. Airbnb.
          </p>
        </div>
      </section>

      {/* Articles Grid — First Batch */}
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-10">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
          {firstBatch.map((card, i) =>
            card.type === "article" && card.article ? (
              <ArticleCard
                key={card.slug}
                article={card.article}
                priority={i < 3}
              />
            ) : card.post ? (
              <BlogPostCard
                key={card.slug}
                post={card.post}
                pillarLabel={
                  PILLAR_LABELS[card.post.pillar || "tips"] || "Travel Tips"
                }
              />
            ) : null
          )}
        </div>
      </section>

      {/* Mid-grid Email Capture */}
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
        <InlineEmailCapture
          headline="Get the full Portland guide + insider deals"
          subtext="Local tips, neighborhood picks, and seasonal deals — straight to your inbox."
          buttonText="Send it"
          offerType="guide"
          className="rounded-xl border border-border bg-muted/30 p-5 sm:p-6"
        />
      </section>

      {/* Articles Grid — Rest */}
      {restBatch.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-10">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
            {restBatch.map((card) =>
              card.type === "article" && card.article ? (
                <ArticleCard key={card.slug} article={card.article} />
              ) : card.post ? (
                <BlogPostCard
                  key={card.slug}
                  post={card.post}
                  pillarLabel={
                    PILLAR_LABELS[card.post.pillar || "tips"] || "Travel Tips"
                  }
                />
              ) : null
            )}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Ready to Experience Portland?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Book Traverse manages 275+ vacation rentals across Portland&apos;s
            best neighborhoods. Book direct for the lowest price — no service
            fees, ever.
          </p>
          <Link
            href="/properties"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Browse Properties
          </Link>
        </div>
      </section>
    </>
  );
}
