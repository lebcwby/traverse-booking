import Image from "next/image";
import Link from "next/link";
import { Star, CalendarCheck, Sliders, MessageCircle } from "lucide-react";
import { type Listing } from "@/lib/supabase";
import { ServerPropertyCard } from "@/components/properties/server-property-card";
import { InlineSearchForm } from "./inline-search-form";
import { PropertyCarousel } from "./property-carousel";
import { DateAwareLinks } from "./date-aware-link";
import { BehaviorTracker } from "@/components/behavior-tracker";
import { getBreadcrumbSchema, getFaqSchema, JsonLd } from "@/lib/schema";

// ─── Types ─────────────────────────────────────────────────
export interface PpcPageConfig {
  slug: string;
  h1: string;
  subtext: string;
  heroImage: string;
  /** Location text in search form */
  searchLocation?: string;
  /** Extra params passed to /properties on search (e.g., filterTag) */
  searchExtraParams?: Record<string, string>;
  /** Trust signal overrides (default: reviews, kitchens, price) */
  trustSignals?: {
    icon: "star" | "calendar" | "sliders" | "chat";
    title: string;
    description: string;
  }[];
  /** Property carousel sections */
  sections: {
    title: string;
    description: string;
    listings: Listing[];
    exploreHref: string;
  }[];
  /** FAQ items */
  faqs: { question: string; answer: string }[];
  /** Canonical URL path */
  canonical: string;
  /** Schema.org page name */
  schemaName: string;
  /** Schema.org page description */
  schemaDescription: string;
}

// ─── Default trust signals ─────────────────────────────────
const DEFAULT_TRUST_SIGNALS = [
  {
    icon: "calendar" as const,
    title: "Keep it flexible",
    description:
      "Most homes offer flexible cancellation, so you can rebook if your plans change.",
  },
  {
    icon: "sliders" as const,
    title: "Full kitchens & real amenities",
    description:
      "Every home has a kitchen, WiFi, and washer/dryer. Many have hot tubs, yards, and fireplaces.",
  },
  {
    icon: "star" as const,
    title: "8,300+ verified reviews",
    description:
      "4.8 average, 87% 5-star. Find homes you'll love based on real guest experiences.",
  },
];

const TRUST_ICONS = {
  star: Star,
  calendar: CalendarCheck,
  sliders: Sliders,
  chat: MessageCircle,
};

// ─── Component ─────────────────────────────────────────────
export function PpcLandingPage({ config }: { config: PpcPageConfig }) {
  const trustSignals = config.trustSignals || DEFAULT_TRUST_SIGNALS;

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    { name: config.h1, url: `https://www.booktraverse.com${config.canonical}` },
  ]);
  const faqSchema = getFaqSchema(config.faqs);
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: config.schemaName,
    description: config.schemaDescription,
    url: `https://www.booktraverse.com${config.canonical}`,
    provider: { "@id": "https://www.booktraverse.com/#organization" },
  };

  return (
    <>
      {/* Hide site chrome on mobile — PPC-only experience */}
      {/* Hide site chrome on PPC pages: header on mobile, footer + Conduit on all breakpoints */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media(max-width:767px){header{display:none!important}}footer,.conduit-widget{display:none!important}main{padding-bottom:0!important}`,
        }}
      />

      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={pageSchema} />
      <h1 className="sr-only">{config.h1}</h1>

      {/* ── Hero: image + search form (Airbnb-style overlap) ── */}
      <section className="bg-white">
        {/* Desktop: image right with form card barely overlapping from left */}
        <div className="hidden md:block">
          <div className="mx-auto max-w-[1280px] px-8 lg:px-12 py-10 lg:py-14">
            <div className="relative">
              {/* Image — right 63%, rounded corners, slightly taller than form */}
              <div
                className="ml-[37%] relative overflow-hidden rounded-[20px]"
                style={{ minHeight: 520 }}
              >
                <Image
                  src={config.heroImage}
                  alt={`Portland, Oregon — ${config.h1}`}
                  fill
                  className="object-cover"
                  sizes="63vw"
                  priority
                />
              </div>
              {/* Form card — left side, barely overlapping the image */}
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                style={{ width: "42%", maxWidth: 460 }}
              >
                <div className="rounded-[20px] bg-white p-8 shadow-[0_6px_40px_rgba(0,0,0,0.12)]">
                  <p className="text-[2rem] font-bold tracking-tight text-foreground lg:text-[2.5rem] lg:leading-[1.1]">
                    {config.h1}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {config.subtext}
                  </p>
                  <div className="mt-6">
                    <InlineSearchForm
                      location={config.searchLocation || "Portland, Oregon"}
                      extraParams={config.searchExtraParams}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: stacked — image, then h1, then form */}
        <div className="md:hidden">
          {/* Hero image — 16:9 keeps form visible sooner above fold */}
          <div className="relative mx-4 aspect-[16/9] overflow-hidden rounded-xl">
            <Image
              src={config.heroImage}
              alt={`Portland, Oregon — ${config.h1}`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>

          {/* H1 + form */}
          <div className="px-4 pt-5 pb-6">
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {config.h1}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {config.subtext}
            </p>
            <div className="mt-5">
              <InlineSearchForm
                location={config.searchLocation || "Portland, Oregon"}
                extraParams={config.searchExtraParams}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust signals ── */}
      <section className="border-t border-border bg-white py-10 md:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <div className="grid gap-8 md:grid-cols-3">
            {trustSignals.map((signal) => {
              const Icon = TRUST_ICONS[signal.icon];
              return (
                <div key={signal.title}>
                  <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                  <h2 className="mt-3 text-lg font-semibold text-foreground">
                    {signal.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {signal.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Property carousel sections (date-aware: appends dates to links) ── */}
      <DateAwareLinks>
        {config.sections.map((section) => (
          <section
            key={section.title}
            className="border-t border-border bg-white py-10 md:py-12"
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.description}
              </p>
              <div className="mt-6">
                <PropertyCarousel exploreHref={section.exploreHref}>
                  {section.listings.map((listing, i) => (
                    <div
                      key={listing.guesty_id}
                      className="w-[75vw] max-w-[320px] flex-none snap-start md:w-[30%] md:max-w-none"
                    >
                      <ServerPropertyCard
                        listing={listing}
                        priority={i < 2}
                        photoWidth={600}
                      />
                    </div>
                  ))}
                </PropertyCarousel>
              </div>
            </div>
          </section>
        ))}
      </DateAwareLinks>

      {/* ── FAQ ── */}
      {config.faqs.length > 0 && (
        <section className="border-t border-border bg-white py-10 md:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
            <div className="md:grid md:grid-cols-[1fr_1.5fr] md:gap-12">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Your questions, answered
              </h2>
              <div className="mt-6 md:mt-0 divide-y divide-border">
                {config.faqs.map((faq) => (
                  <details key={faq.question} className="group py-4">
                    <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-foreground">
                      {faq.question}
                      <span className="ml-4 text-muted-foreground transition-transform group-open:rotate-180">
                        &#x25BE;
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground pr-8">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Breadcrumbs ── */}
      <nav
        className="border-t border-border bg-white py-6"
        aria-label="Breadcrumbs"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="hover:underline">
                Book Traverse
              </Link>
            </li>
            <li>&rsaquo;</li>
            <li>
              <Link href="/properties" className="hover:underline">
                Properties
              </Link>
            </li>
            <li>&rsaquo;</li>
            <li className="text-foreground">{config.h1}</li>
          </ol>
        </div>
      </nav>

      {/* ── Minimal footer ── */}
      <footer className="border-t border-border bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Book Traverse, Inc.</p>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
              <Link href="/cancellation" className="hover:underline">
                Cancellation
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <BehaviorTracker
        eventType="landing_page_view"
        properties={{ slug: config.slug, title: config.h1 }}
      />
    </>
  );
}
