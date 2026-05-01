import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getEventPage, getAllEventSlugs } from "@/lib/seo-content";
import { MarkdownContent } from "@/components/seo/markdown-content";
import { BehaviorTracker } from "@/components/behavior-tracker";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllEventSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getEventPage(slug);
  if (!page) return {};

  return {
    title: page.meta_title,
    description: page.meta_description,
    openGraph: {
      title: page.meta_title,
      description: page.meta_description,
      url: `https://www.booktraverse.com/events/${page.slug}`,
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    alternates: { canonical: `/events/${page.slug}` },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getEventPage(slug);
  if (!page) notFound();

  // JSON-LD schema — AI-generated content from our DB, not user input
  // Same trusted-content pattern as existing /s/[slug] pages
  const schemaLd = page.schema_markup
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
            {page.headline}
          </h1>
          {page.typical_dates && (
            <p className="mt-3 text-base text-white/90 sm:text-lg">
              {page.typical_dates}
            </p>
          )}
          {page.booking_urgency_note && (
            <p className="mt-2 text-sm font-medium text-accent">
              {page.booking_urgency_note}
            </p>
          )}
        </div>
      </section>

      {/* Event Description */}
      <section className="bg-secondary/30 py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-lg leading-relaxed text-muted-foreground">
            {page.event_description}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <MarkdownContent content={page.content_markdown} />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="mb-4 text-2xl font-bold text-foreground">
            Book Your {page.event_name} Stay
          </h2>
          <p className="mb-6 text-muted-foreground">
            Browse vacation rentals near {page.event_name}. Book direct with
            Book Traverse — no service fees, best price guaranteed.
          </p>
          <Link
            href="/properties"
            className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Browse Nearby Properties
          </Link>
        </div>
      </section>

      <BehaviorTracker
        eventType="landing_page_view"
        properties={{ slug, title: page.headline, type: "event" }}
      />
    </>
  );
}
