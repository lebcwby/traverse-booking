import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NEIGHBORHOODS, WHERE_TO_STAY_FAQ } from "@/lib/where-to-stay-data";
import { NeighborhoodSection } from "@/components/where-to-stay/neighborhood-section";
import { ClientNeighborhoodMap } from "@/components/where-to-stay/client-neighborhood-map";
import { ComparisonTable } from "@/components/where-to-stay/comparison-table";
import { WhereToStayFaq } from "@/components/where-to-stay/where-to-stay-faq";
import { StickyCTA } from "@/components/marketing/sticky-cta";
import { StatBar } from "@/components/marketing/stat-bar";
import { getBreadcrumbSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Where to Stay in Portland — Neighborhood Guide",
  description:
    "Skip the downtown hotels. Our neighborhood-by-neighborhood guide helps you find the perfect Portland vacation rental in Hawthorne, Alberta, NW 23rd, and more. 275+ homes, no booking fees.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/where-to-stay" },
  openGraph: {
    title: "Where to Stay in Portland — Neighborhood Guide",
    description:
      "Skip the downtown hotels. Find the perfect Portland neighborhood for your trip — from Hawthorne to Alberta to NW 23rd.",
    images: [{ url: "/og-image-v2.png", width: 1200, height: 630 }],
  },
};

/**
 * Build FAQ JSON-LD from static constants.
 * Same pattern used on homepage (src/app/page.tsx).
 * Content is NOT user input — safe for structured data injection.
 */
function buildFaqJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: WHERE_TO_STAY_FAQ.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  });
}

export default function WhereToStayPage() {
  const faqJsonLd = buildFaqJsonLd();
  const breadcrumbLd = JSON.stringify(
    getBreadcrumbSchema([
      { name: "Book Traverse", url: "https://www.booktraverse.com" },
      {
        name: "Where to Stay",
        url: "https://www.booktraverse.com/where-to-stay",
      },
    ])
  );

  return (
    <>
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

      {/* Hero */}
      <section className="relative flex min-h-[360px] items-center justify-center overflow-hidden sm:min-h-[450px]">
        <div className="absolute inset-0">
          <Image
            src="/images/home/portland-sunset-skyline.jpg"
            alt="Portland skyline at sunset with Mt. Hood in the background"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            The Insider&apos;s Guide
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Where to Stay in Portland
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Skip the downtown hotels. Portland&apos;s best experiences are in
            its neighborhoods — and that&apos;s exactly where our homes are.
          </p>
        </div>
      </section>

      {/* Why Not a Hotel */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Why Not a Hotel?
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Portland&apos;s hotels cluster in two places: downtown and the Lloyd
          District. Downtown has struggled in recent years — most locals avoid
          it for dining or nightlife. The Lloyd District is a convention zone
          next to a freeway interchange. Neither gives you the Portland
          experience travelers come here for.
        </p>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          The real Portland — the walkable streets with the great restaurants,
          the neighborhood coffee shops with no line, the bars where locals
          actually go — is spread across a dozen distinct neighborhoods. There
          are no hotels in any of them. But there are over 200 Book Traverse
          homes, and that&apos;s the point.
        </p>

        <StatBar propertyLabel="Homes across Portland" />
      </section>

      {/* Neighborhood Guide — Two Column */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="mb-10 text-2xl font-bold tracking-tight text-foreground">
            Portland&apos;s Best Neighborhoods for Visitors
          </h2>

          <div className="flex gap-10">
            {/* Left: Editorial */}
            <div className="flex-1 space-y-10 lg:max-w-[65%]">
              {NEIGHBORHOODS.map((n) => (
                <NeighborhoodSection key={n.id} neighborhood={n} />
              ))}
            </div>

            {/* Right: Sticky Map (desktop only) */}
            <div className="hidden w-[320px] shrink-0 lg:block xl:w-[360px]">
              <ClientNeighborhoodMap neighborhoods={NEIGHBORHOODS} />
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
            Portland Neighborhoods at a Glance
          </h2>
          <ComparisonTable neighborhoods={NEIGHBORHOODS} />
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h2>
        <WhereToStayFaq />
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0">
          <Image
            src="/images/home/portland-sunset-skyline.jpg"
            alt="Portland skyline"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Find Your Portland Neighborhood
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            275+ vacation homes across Portland&apos;s best neighborhoods. No
            booking fees. Save 10–15% vs. Airbnb when you book direct.
          </p>
          <Link
            href="/properties"
            className="mt-8 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
          >
            Browse All Properties
          </Link>
        </div>
      </section>
    </>
  );
}
