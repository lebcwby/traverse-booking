import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  getGuideArticle,
  getAllGuideSlugs,
  type ContentBlock,
  type FaqItem,
  type GuideArticle,
} from "@/lib/guide-content";
import { ServerPropertyCard } from "@/components/properties/server-property-card";
import { getListingsByTag } from "@/lib/supabase";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { getBlogPost, getAllBlogSlugs } from "@/lib/seo-content";
import { ArticleCard } from "@/components/guide/article-card";
import { MarkdownContent } from "@/components/seo/markdown-content";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";
import { BehaviorTracker } from "@/components/behavior-tracker";
import { ClientNeighborhoodMap } from "@/components/where-to-stay/client-neighborhood-map";
import { ComparisonTable } from "@/components/where-to-stay/comparison-table";
import { NEIGHBORHOODS } from "@/lib/where-to-stay-data";

export const revalidate = 3600;

export async function generateStaticParams() {
  const guideSlugs = getAllGuideSlugs();
  const blogSlugs = await getAllBlogSlugs();
  return [...guideSlugs, ...blogSlugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const article = getGuideArticle(slug);
  if (article) {
    return {
      title: article.metaTitle,
      description: article.metaDescription,
      openGraph: {
        title: article.metaTitle,
        description: article.metaDescription,
        url: `https://www.booktraverse.com/guide/${article.slug}`,
        type: "article",
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        authors: ["Book Traverse"],
        images: [{ url: "/og-image.png", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: article.metaTitle,
        description: article.metaDescription,
      },
      alternates: { canonical: `/guide/${article.slug}` },
    };
  }

  const post = await getBlogPost(slug);
  if (post) {
    return {
      title: post.meta_title ?? post.title,
      description: post.meta_description,
      openGraph: {
        title: post.meta_title ?? post.title,
        description: post.meta_description ?? undefined,
        url: `https://www.booktraverse.com/guide/${post.slug}`,
        type: "article",
        publishedTime: post.published_at ?? undefined,
        authors: ["Book Traverse"],
        images: post.featured_image_url
          ? [{ url: post.featured_image_url }]
          : [{ url: "/og-image.png", width: 1200, height: 630 }],
      },
      alternates: { canonical: `/guide/${post.slug}` },
    };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Inline markdown parser — handles [text](url), **bold**, *italic*
// Content is our own static strings (not user input), safe to parse.
// ---------------------------------------------------------------------------

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the earliest match of link, bold, or italic
    const linkIdx = remaining.indexOf("[");
    const boldIdx = remaining.indexOf("**");
    const italicIdx = remaining.indexOf("*");

    // Determine which comes first
    const candidates: { type: string; idx: number }[] = [];
    if (linkIdx >= 0) candidates.push({ type: "link", idx: linkIdx });
    if (boldIdx >= 0) candidates.push({ type: "bold", idx: boldIdx });
    if (italicIdx >= 0 && italicIdx !== boldIdx)
      candidates.push({ type: "italic", idx: italicIdx });

    candidates.sort((a, b) => a.idx - b.idx);

    if (candidates.length === 0) {
      nodes.push(remaining);
      break;
    }

    const first = candidates[0];

    // Push text before the match
    if (first.idx > 0) {
      nodes.push(remaining.slice(0, first.idx));
      remaining = remaining.slice(first.idx);
    }

    if (first.type === "link") {
      const match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const [full, linkText, href] = match;
        const isExternal = href.startsWith("http");
        nodes.push(
          <Link
            key={key++}
            href={href}
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            {...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {linkText}
          </Link>
        );
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    if (first.type === "bold") {
      const match = remaining.match(/^\*\*([^*]+)\*\*/);
      if (match) {
        const [full, boldText] = match;
        nodes.push(
          <strong key={key++} className="font-semibold text-foreground">
            {boldText}
          </strong>
        );
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    if (first.type === "italic" && first.idx !== boldIdx) {
      const match = remaining.match(/^\*([^*]+)\*/);
      if (match) {
        const [full, italicText] = match;
        nodes.push(<em key={key++}>{italicText}</em>);
        remaining = remaining.slice(full.length);
        continue;
      }
    }

    // No match worked — push the character and move on
    nodes.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Heading slug helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Content block renderer
// ---------------------------------------------------------------------------

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          key={index}
          id={slugify(block.text)}
          className="mt-10 mb-4 text-2xl font-bold text-foreground first:mt-0 sm:text-[1.65rem]"
        >
          {block.text}
        </h2>
      );
    case "subheading":
      return (
        <h3
          key={index}
          className="mt-8 mb-3 text-xl font-semibold text-foreground"
        >
          {block.text}
        </h3>
      );
    case "text":
      return (
        <p
          key={index}
          className="mb-5 text-base leading-relaxed text-muted-foreground sm:text-[1.05rem] sm:leading-[1.8]"
        >
          {parseInline(block.text)}
        </p>
      );
    case "tip":
      return (
        <div
          key={index}
          className="my-6 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4"
        >
          <p className="text-sm font-semibold text-accent-foreground">
            Insider Tip
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            {parseInline(block.text)}
          </p>
        </div>
      );
    case "places":
      return (
        <div key={index} className="my-6 space-y-4">
          {block.items.map((place, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-white p-4 sm:p-5"
            >
              <h4 className="text-base font-semibold text-foreground">
                {place.url ? (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    {place.name} &rarr;
                  </a>
                ) : (
                  place.name
                )}
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {place.detail}
              </p>
            </div>
          ))}
        </div>
      );
    case "image":
      return (
        <figure key={index} className="my-8">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl">
            <Image
              src={block.src}
              alt={block.alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "pros-cons":
      return (
        <div key={index} className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-200 bg-green-50/50 px-5 py-4">
            <p className="mb-2 text-sm font-semibold text-green-800">Pros</p>
            <ul className="space-y-1.5">
              {block.pros.map((pro, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-green-900"
                >
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 px-5 py-4">
            <p className="mb-2 text-sm font-semibold text-red-800">Cons</p>
            <ul className="space-y-1.5">
              {block.cons.map((con, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-red-900"
                >
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "best-for":
      return (
        <div key={index} className="my-4 flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Best for:
          </span>
          {block.tags.map((tag, i) => (
            <span
              key={i}
              className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      );
    case "faq":
      return (
        <div key={index} className="my-8 space-y-3">
          {block.items.map((item, i) => (
            <details
              key={i}
              className="group rounded-xl border border-border bg-white"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-base font-medium text-foreground">
                {item.question}
                <svg
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                {parseInline(item.answer)}
              </div>
            </details>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getGuideArticle(slug);

  // If not a hardcoded guide article, check DB blog posts
  if (!article) {
    const post = await getBlogPost(slug);
    if (!post) notFound();

    const postPillarLabel = post.pillar
      ? ({
          neighborhoods: "Neighborhoods",
          "food-drink": "Food & Drink",
          outdoors: "Outdoors & Nature",
          events: "Events & Festivals",
          "travel-tips": "Travel Tips",
        }[post.pillar] ?? "Travel Tips")
      : "Travel Tips";

    const postDate = post.published_at
      ? new Date(post.published_at).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      : null;

    // Render blog post with the editorial hero
    return (
      <>
        <section className="bg-primary">
          {post.featured_image_url && (
            <div className="relative h-[200px] sm:h-[280px]">
              <Image
                src={post.featured_image_url}
                alt={post.meta_description || post.title}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary/60" />
            </div>
          )}
          <div
            className={`relative px-4 pb-10 sm:pb-12 ${post.featured_image_url ? "-mt-16 sm:-mt-20" : "pt-10 sm:pt-14"}`}
          >
            <div className="mx-auto max-w-3xl">
              <nav className="mb-4 flex items-center gap-1.5 text-xs text-white/50">
                <Link
                  href="/"
                  className="hover:text-white/80 transition-colors"
                >
                  Home
                </Link>
                <span>/</span>
                <Link
                  href="/guide"
                  className="hover:text-white/80 transition-colors"
                >
                  Portland Guide
                </Link>
              </nav>
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                  {postPillarLabel}
                </span>
                {postDate && (
                  <span className="text-xs text-white/50">
                    Updated {postDate}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[2.25rem]">
                {post.title}
              </h1>
              {post.meta_description && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base sm:leading-relaxed">
                  {post.meta_description}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                    SP
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      The Book Traverse Team
                    </p>
                    <p className="text-xs text-white/50">
                      275+ vacation rentals across Portland
                    </p>
                  </div>
                </div>
                <Link
                  href="/properties"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Browse properties &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <MarkdownContent content={post.content_markdown} />

          <div className="mt-12 rounded-xl border border-border bg-secondary/30 p-8 text-center">
            <h2 className="mb-3 text-xl font-bold text-foreground">
              Planning a Trip to Portland?
            </h2>
            <p className="mb-5 text-muted-foreground">
              Browse 275+ vacation rentals across Portland. Book direct — no
              service fees.
            </p>
            <Link
              href="/properties"
              className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Browse All Properties
            </Link>
          </div>
        </div>

        <BehaviorTracker
          eventType="guide_page_view"
          properties={{ slug, title: post.title, type: "blog" }}
        />
      </>
    );
  }

  // Pre-fetch listings for any neighborhood-listings blocks
  const listingBlocks = article.content.filter(
    (b): b is ContentBlock & { type: "neighborhood-listings" } =>
      b.type === "neighborhood-listings"
  );
  const listingsMap: Record<
    string,
    Awaited<ReturnType<typeof getListingsByTag>>
  > = {};
  if (listingBlocks.length > 0) {
    const results = await Promise.all(
      listingBlocks.map((b) => getListingsByTag(b.tag, b.limit))
    );
    listingBlocks.forEach((b, i) => {
      listingsMap[b.tag] = results[i];
    });
    const allListings = results.flat();
    if (allListings.length > 0) {
      await enrichListingsWithReviewAverages(allListings);
    }
  }

  // Extract FAQ items for FAQPage schema
  const faqBlocks = article.content.filter(
    (b): b is ContentBlock & { type: "faq" } => b.type === "faq"
  );
  const allFaqItems: FaqItem[] = faqBlocks.flatMap((b) => b.items);

  // Build table of contents from heading blocks
  const toc = article.content
    .filter(
      (b): b is ContentBlock & { type: "heading" } => b.type === "heading"
    )
    .map((b) => ({ text: b.text, id: slugify(b.text) }));

  // Resolve related articles
  const relatedArticles = article.relatedSlugs
    .map(getGuideArticle)
    .filter((a): a is GuideArticle => !!a);

  // JSON-LD Article structured data
  const articleJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription,
    url: `https://www.booktraverse.com/guide/${article.slug}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Person",
      name: article.author,
      description: article.authorBio,
      url: "https://www.booktraverse.com/guide",
      worksFor: { "@id": "https://www.booktraverse.com/#organization" },
    },
    publisher: {
      "@id": "https://www.booktraverse.com/#organization",
      logo: {
        "@type": "ImageObject",
        url: "https://www.booktraverse.com/book-traverse-icon.png",
      },
    },
    image: `https://www.booktraverse.com${article.heroImage}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.booktraverse.com/guide/${article.slug}`,
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
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: `https://www.booktraverse.com/guide/${article.slug}`,
      },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
      />
      {allFaqItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: allFaqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            }),
          }}
        />
      )}

      {/* Hero — enhanced version for where-to-stay, standard for others */}
      {slug === "where-to-stay-in-portland" ? (
        <>
          <section className="relative flex min-h-[380px] items-end px-4 pb-10 sm:min-h-[440px] sm:pb-14">
            <Image
              src="/images/home/hero-desktop.jpg"
              alt="Portland skyline with Mt. Hood — vacation rental neighborhoods"
              fill
              className="hidden object-cover object-bottom sm:block"
              sizes="100vw"
              priority
            />
            <Image
              src="/images/home/hero-mobile.jpg"
              alt="Portland skyline with Mt. Hood — vacation rental neighborhoods"
              fill
              className="object-cover object-bottom sm:hidden"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-primary/45" />
            <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
              {/* Breadcrumbs */}
              <nav className="mb-4 flex items-center justify-center gap-1.5 text-xs text-white/60">
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
                <span>/</span>
                <Link
                  href="/guide"
                  className="hover:text-white transition-colors"
                >
                  Portland Guide
                </Link>
                <span>/</span>
                <span className="text-white/80">Where to Stay</span>
              </nav>
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                Where to Stay in Portland
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
                A neighborhood-by-neighborhood guide from the team that manages
                275+ vacation rentals across the city.
              </p>
              {/* Trust stats */}
              <div className="mt-5 flex items-center justify-center gap-4 text-sm text-white/90 sm:gap-6">
                <span>
                  <span className="font-bold">275+</span> homes
                </span>
                <span className="text-white/40">|</span>
                <span>
                  <span className="font-bold">87%</span> 5★ reviews
                </span>
              </div>
              {/* CTA */}
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/properties"
                  className="inline-flex items-center rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent/90"
                >
                  Browse All Properties
                </Link>
                <a
                  href="#hawthorne--belmont-portlands-culinary-heartbeat"
                  className="inline-flex items-center text-sm font-medium text-white/80 transition-colors hover:text-white"
                >
                  Read the guide &darr;
                </a>
              </div>
              {/* Updated date */}
              <p className="mt-4 text-xs text-white/50">
                Updated{" "}
                {new Date(article.updatedAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </section>

          {/* Author byline */}
          <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                SP
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {article.author}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {article.authorBio}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Editorial hero — image + content split */}
          <section className="bg-primary">
            {/* Image band */}
            <div className="relative h-[200px] sm:h-[280px]">
              <Image
                src={article.heroImage}
                alt={article.heroAlt}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary/60" />
            </div>

            {/* Content band — overlaps image bottom */}
            <div className="relative -mt-16 px-4 pb-10 sm:-mt-20 sm:pb-12">
              <div className="mx-auto max-w-3xl">
                {/* Breadcrumbs */}
                <nav className="mb-4 flex items-center gap-1.5 text-xs text-white/50">
                  <Link
                    href="/"
                    className="hover:text-white/80 transition-colors"
                  >
                    Home
                  </Link>
                  <span>/</span>
                  <Link
                    href="/guide"
                    className="hover:text-white/80 transition-colors"
                  >
                    Portland Guide
                  </Link>
                </nav>

                {/* Category + date row */}
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                    {article.categoryLabel}
                  </span>
                  <span className="text-xs text-white/50">
                    Updated{" "}
                    {new Date(article.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[2.25rem]">
                  {article.title}
                </h1>

                {/* Excerpt */}
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base sm:leading-relaxed">
                  {article.excerpt}
                </p>

                {/* Author + CTA row */}
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                      SP
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {article.author}
                      </p>
                      <p className="text-xs text-white/50">
                        275+ vacation rentals across Portland
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/properties"
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    Browse properties &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Table of contents */}
        {toc.length > 2 && (
          <details className="group mb-10 rounded-xl border border-border bg-muted/30">
            <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-semibold text-foreground">
              In this guide ({toc.length} sections)
              <svg
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-border px-5 pb-5 pt-3 sm:grid-cols-2">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.text.includes(": ")
                      ? item.text.split(": ")[0]
                      : item.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Article body */}
        <article className="prose-sp">
          {article.content.map((block, i) => {
            if (block.type === "neighborhood-listings") {
              const listings = listingsMap[block.tag] || [];
              if (listings.length === 0) return null;
              return (
                <div key={i} className="my-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {listings.map((listing) => (
                      <ServerPropertyCard
                        key={listing.guesty_id}
                        listing={listing}
                        photoWidth={300}
                      />
                    ))}
                  </div>
                  <Link
                    href={block.browseUrl}
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {block.browseLabel} &rarr;
                  </Link>
                </div>
              );
            }
            return renderBlock(block, i);
          })}
        </article>

        {/* Interactive map + comparison table (where-to-stay only) */}
        {slug === "where-to-stay-in-portland" && (
          <>
            <div className="mt-12">
              <h2
                id="neighborhood-map"
                className="mb-4 text-2xl font-bold text-foreground"
              >
                Portland Neighborhood Map
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <ClientNeighborhoodMap neighborhoods={NEIGHBORHOODS} />
              </div>
            </div>
            <div className="mt-12">
              <h2
                id="neighborhood-comparison"
                className="mb-4 text-2xl font-bold text-foreground"
              >
                Neighborhood Comparison
              </h2>
              <ComparisonTable neighborhoods={NEIGHBORHOODS} />
            </div>
          </>
        )}

        {/* End-of-article email capture */}
        <InlineEmailCapture
          headline="Get this guide + insider deals"
          subtext="We'll send you the full Portland guide, neighborhood tips, and an exclusive discount for your first direct booking."
          buttonText="Send it"
          offerType="guide"
          className="mt-12 rounded-xl border border-accent/30 bg-accent/5 p-5 sm:p-6"
        />

        {/* Related landing pages */}
        {article.relatedLandingPages.length > 0 && (
          <div className="mt-12 rounded-xl border border-border bg-secondary/30 p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Browse Book Traverse Properties
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {article.relatedLandingPages.map((lp) => (
                <Link
                  key={lp}
                  href={getLandingPagePath(lp)}
                  className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {lp
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </Link>
              ))}
              <Link
                href="/properties"
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                All Properties
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="border-t border-border bg-muted/20 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <h2 className="mb-8 text-2xl font-bold text-foreground">
              More from the Portland Guide
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
              {relatedArticles.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="bg-primary py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Book Your Portland Stay
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/70">
            275+ vacation rentals across Portland&apos;s best neighborhoods.
            Book direct — no service fees, lowest price guaranteed.
          </p>
          <Link
            href="/properties"
            className="mt-6 inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            Browse Properties
          </Link>
          <div className="mx-auto mt-6 max-w-md">
            <InlineEmailCapture
              headline="Get Portland travel tips in your inbox."
              buttonText="Sign up"
              variant="dark"
            />
          </div>
        </div>
      </section>

      <BehaviorTracker
        eventType="guide_page_view"
        properties={{ slug, title: article.title }}
      />
    </>
  );
}
