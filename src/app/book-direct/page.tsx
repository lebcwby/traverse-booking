import Link from "next/link";
import type { Metadata } from "next";
import { getComparisonPage } from "@/lib/seo-content";
import { MarkdownContent } from "@/components/seo/markdown-content";
import { BehaviorTracker } from "@/components/behavior-tracker";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  let page;
  try {
    page = await getComparisonPage("book-direct");
  } catch {
    // DB unavailable (e.g. CI) — fall through to defaults
  }
  if (!page) {
    return {
      title: "Book Direct & Save Up to 15.5% vs Airbnb",
      description:
        "Skip the Airbnb fees. Book direct with Book Traverse and save 14-16% on every stay.",
    };
  }

  return {
    title: page.meta_title,
    description: page.meta_description,
    openGraph: {
      title: page.meta_title,
      description: page.meta_description,
      url: "https://www.booktraverse.com/book-direct",
      type: "website",
      images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
    },
    alternates: { canonical: "/book-direct" },
  };
}

export default async function BookDirectPage() {
  let page;
  try {
    page = await getComparisonPage("book-direct");
  } catch {
    // DB unavailable (e.g. CI)
  }

  // JSON-LD schema — AI-generated content from our DB, not user input
  // Same trusted-content pattern as existing /s/[slug] pages
  const schemaLd = page?.schema_markup
    ? JSON.stringify(page.schema_markup)
    : null;

  return (
    <>
      {schemaLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaLd }}
        />
      )}

      {/* Hero */}
      <section className="relative flex min-h-[360px] items-center justify-center px-4 py-12 sm:min-h-[420px] sm:py-16">
        <div
          className="absolute inset-0 bg-cover bg-[center_70%]"
          style={{
            backgroundImage: "url('/images/portland-skyline-hero.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            {page?.headline ?? "Skip the Fees. Book Direct with Book Traverse."}
          </h1>
          <p className="mt-3 text-base text-white/90 sm:text-lg">
            We&apos;ll match any Airbnb price — and you still save the service
            fees.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {page ? (
            <MarkdownContent content={page.content_markdown} />
          ) : (
            <p className="text-muted-foreground">Content coming soon.</p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-2xl font-bold text-foreground">
            Ready to Save?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Browse all 275+ Portland vacation rentals. Same properties, same
            quality — just without the middleman fees.
          </p>
          <Link
            href="/properties"
            className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Browse All Properties
          </Link>
        </div>
      </section>

      <BehaviorTracker
        eventType="landing_page_view"
        properties={{
          slug: "book-direct",
          title: page?.headline ?? "Book Direct",
          type: "comparison",
        }}
      />
    </>
  );
}
