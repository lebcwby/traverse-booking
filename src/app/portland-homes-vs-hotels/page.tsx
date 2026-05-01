import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, UtensilsCrossed, Car, Users, MapPin, Phone } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { StickyCTA } from "@/components/marketing/sticky-cta";
import { ListicleItem } from "@/components/marketing/listicle-item";
import { InlineCTA } from "@/components/marketing/inline-cta";
import { CredibilityBar } from "@/components/marketing/credibility-bar";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "5 Reasons Portland Travelers Are Choosing Book Traverse Over Hotels",
  description:
    "More space, full kitchens, real neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse vacation homes over Portland hotels.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/portland-homes-vs-hotels" },
  openGraph: {
    title:
      "5 Reasons Portland Travelers Are Choosing Book Traverse Over Hotels",
    description:
      "More space, full kitchens, real neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse over hotels.",
    images: [
      {
        url: "/images/home/2c130183-e179-4a86-bbcb-99df71ebe774.jpg",
        width: 1200,
        height: 800,
      },
    ],
  },
};

export default function PortlandHomesVsHotelsPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "5 Reasons Portland Travelers Are Choosing Book Traverse Over Hotels",
    description:
      "More space, full kitchens, real neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse vacation homes over Portland hotels.",
    url: "https://www.booktraverse.com/portland-homes-vs-hotels",
    publisher: { "@id": "https://www.booktraverse.com/#organization" },
    author: { "@id": "https://www.booktraverse.com/#organization" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.booktraverse.com/portland-homes-vs-hotels",
    },
  };

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    {
      name: "Homes vs Hotels",
      url: "https://www.booktraverse.com/portland-homes-vs-hotels",
    },
  ]);

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <StickyCTA
        href="/properties"
        label="Browse Portland Vacation Homes"
        sublabel="275+ properties"
      />

      {/* Editorial-style header */}
      <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.15]">
          5 Reasons Portland Travelers Are Choosing Book Traverse Over Hotels
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          More space. Real neighborhoods. No booking fees. Here&apos;s why the
          shift is happening.
        </p>

        <p className="mt-3">
          <Link
            href="/properties"
            className="text-sm text-primary hover:underline"
          >
            Browse 275+ vacation homes →
          </Link>
        </p>

        {/* Lead image */}
        <figure className="mt-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/2c130183-e179-4a86-bbcb-99df71ebe774.jpg"
              alt="A historic Portland home available as a vacation rental"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            A 1910 home in Portland&apos;s Alphabet District, managed by Stay
            Portland
          </figcaption>
        </figure>

        {/* Credibility strip */}
        <div className="mt-8 rounded-xl bg-secondary/30 py-4">
          <CredibilityBar propertyLabel="275+ homes" />
        </div>

        <p className="mt-8 text-lg leading-relaxed text-foreground">
          Planning a trip to Portland? Most travelers default to searching for
          hotels — but a growing number are booking with Book Traverse instead.
          More space, real savings, and neighborhood access that hotels simply
          can&apos;t match. Here&apos;s why.
        </p>

        <div className="mt-8 divide-y divide-border">
          {/* #1 — Strongest (primacy): walk to dinner, walk home */}
          <ListicleItem
            number={1}
            icon={UtensilsCrossed}
            title="Walk to Dinner. Walk Home. That's the Portland Way."
          >
            <p>
              Portland is one of the best food cities in the country — but the
              restaurants that made it famous aren&apos;t downtown. They&apos;re
              on Division Street, Hawthorne Boulevard, Alberta Street,
              Mississippi Ave, and NW 23rd. Hotels put you in the convention
              center district. A Book Traverse home puts you on the same streets
              where the food actually is.
            </p>
            <p>
              Walk to dinner at Canard on SE 3rd. Grab cocktails on Alberta.
              Sunday brunch at Gravy on Mississippi. Then walk home — no Uber
              surge, no parking, no planning. Your front door is on the same
              streets Portlanders eat on every night.
            </p>

            {/* Neighborhood photos */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                href={getLandingPagePath("hawthorne-belmont")}
                className="group"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-lg">
                  <Image
                    src="/images/home/poi-hawthorne.jpg"
                    alt="Hawthorne district in Portland"
                    width={400}
                    height={300}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 384px"
                  />
                </div>
                <span className="mt-1 block text-xs font-medium text-foreground group-hover:text-primary">
                  Hawthorne
                </span>
              </Link>
              <Link href={getLandingPagePath("alberta")} className="group">
                <div className="aspect-[4/3] overflow-hidden rounded-lg">
                  <Image
                    src="/images/home/poi-alberta.jpg"
                    alt="Alberta Arts District in Portland"
                    width={400}
                    height={300}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 384px"
                  />
                </div>
                <span className="mt-1 block text-xs font-medium text-foreground group-hover:text-primary">
                  Alberta Arts District
                </span>
              </Link>
            </div>

            <blockquote className="border-l-4 border-accent pl-4 italic text-foreground/80">
              &ldquo;We walked to a different restaurant every night — all
              within a few blocks of the house. You can&apos;t do that from a
              downtown hotel.&rdquo;
              <span className="mt-1 block text-sm font-medium not-italic text-muted-foreground">
                — Sarah K., guest from Denver
              </span>
            </blockquote>
          </ListicleItem>

          {/* #2 — Quiet, safe, walkable neighborhoods */}
          <ListicleItem
            number={2}
            icon={MapPin}
            title="Quiet Streets, Craftsman Homes, Zero Tourist Crowds"
          >
            <p>
              Portland&apos;s residential neighborhoods are what make the city
              special — and hotels aren&apos;t in any of them. Tree-lined
              streets, craftsman bungalows, front porches, neighbors walking
              their dogs. It&apos;s quiet at night. You can walk everywhere. And
              it feels nothing like a hotel district.
            </p>
            <p>
              Book Traverse homes are on the same blocks Portlanders live on —
              in neighborhoods like{" "}
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
              ,{" "}
              <Link
                href={getLandingPagePath("mississippi")}
                className="text-primary hover:underline"
              >
                Mississippi
              </Link>
              , and the Alphabet District. You&apos;re not a tourist in a lobby
              — you&apos;re a neighbor with a yard.
            </p>

            {/* Kearney cover photo */}
            <figure className="mt-4">
              <div className="aspect-[3/2] overflow-hidden rounded-lg">
                <Image
                  src="/images/home/home-kearney-cover.jpg"
                  alt="Living room with exposed wood beams, hanging plants, and natural light in a Portland vacation home"
                  width={800}
                  height={533}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                NW Kearney — a guest favorite in the Alphabet District
              </figcaption>
            </figure>
          </ListicleItem>

          {/* #3 — Space for groups + kitchen as bonus */}
          <ListicleItem
            number={3}
            icon={Users}
            title="Room for Everyone — Plus a Real Kitchen If You Want It"
          >
            <p>
              Traveling with family or friends? In a hotel, you&apos;re booking
              multiple rooms, coordinating floor assignments, and spending the
              trip in separate spaces. With a Book Traverse home, everyone stays
              together — 2, 3, and 4+ bedroom homes with living rooms, dining
              tables, and yards.
            </p>
            <p>
              Every home has a full kitchen — useful for morning coffee, storing
              leftovers from last night&apos;s dinner, or cooking when you want
              a quiet night in with the group. Browse our{" "}
              <Link
                href={getLandingPagePath("large-groups")}
                className="text-primary hover:underline"
              >
                large group homes
              </Link>{" "}
              or{" "}
              <Link
                href={getLandingPagePath("family-friendly")}
                className="text-primary hover:underline"
              >
                family-friendly properties
              </Link>
              .
            </p>

            {/* Adelynn cover photo */}
            <figure className="mt-2">
              <div className="aspect-[3/2] overflow-hidden rounded-lg">
                <Image
                  src="/images/home/home-adelynn-cover.jpg"
                  alt="A designer dining room with wood beams, dome pendant lights, and open living area in a Portland vacation home"
                  width={800}
                  height={533}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                The Adelynn in Kerns — room for the whole group, steps from
                restaurants
              </figcaption>
            </figure>

            <p className="rounded-lg bg-secondary/50 p-4 text-sm">
              <span className="font-semibold text-foreground">Quick math:</span>{" "}
              A 3-bedroom home for $250/night vs. two hotel rooms at $200 each =
              $150/night saved. Over five nights, that&apos;s $750 back in your
              pocket.
            </p>
          </ListicleItem>

          {/* Mid-list CTA */}
          <div className="border-none">
            <InlineCTA href="/properties" label="Check Availability" />
          </div>

          {/* #4 — No hidden fees (weakest position) */}
          <ListicleItem
            number={4}
            icon={Car}
            title="No Hidden Fees — and Most Homes Have Free Parking"
          >
            <p>
              Portland hotel parking runs $25–45 per night. Resort fees add
              another $15–30. WiFi surcharges, early check-in fees — it adds up
              fast. A $200 hotel room becomes $260 after the extras.
            </p>
            <p>
              Most Book Traverse homes include free parking, fast WiFi, and no
              resort fees. The price you see is the price you pay — no surprise
              charges at checkout.
            </p>
          </ListicleItem>

          {/* #5 — Second-strongest (recency effect) */}
          <ListicleItem
            number={5}
            icon={Home}
            title="Book Direct and Get the Lowest Price — Guaranteed"
          >
            <p>
              Every Book Traverse home is also listed on Airbnb and VRBO — but
              those platforms charge service fees of 10–15% on top of the
              nightly rate. When you book the same home directly on
              booktraverse.com, you skip the platform entirely.
            </p>
            <p>
              That means the direct price is always the lowest available price
              for any Book Traverse home. Same house, same dates, same quality —
              just without the middleman markup.
            </p>

            {/* Local team callout */}
            <div className="flex gap-4 rounded-xl bg-primary/5 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Portland-based team, always available
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Booking direct also gives you a direct line to our local guest
                  services team — not a national call center. Need a restaurant
                  recommendation? Something break at midnight? Text or call
                  anytime.
                </p>
              </div>
            </div>

            <blockquote className="border-l-4 border-accent pl-4 italic text-foreground/80">
              &ldquo;We booked direct and saved over $100 compared to the same
              listing on Airbnb. Plus we could text the local team for
              restaurant recommendations — way better than a hotel
              concierge.&rdquo;
              <span className="mt-1 block text-sm font-medium not-italic text-muted-foreground">
                — Mark T., guest from Los Angeles
              </span>
            </blockquote>
          </ListicleItem>
        </div>

        {/* Final CTA */}
        <div className="mt-6 rounded-2xl bg-primary/5 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ready to Skip the Hotel?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Browse 275+ vacation homes across Portland&apos;s best
            neighborhoods. Book direct for the lowest price, no fees, and
            instant confirmation.
          </p>
          <p className="mx-auto mt-2 text-sm text-muted-foreground/80">
            Portland&apos;s most popular homes book 2–3 weeks ahead — especially
            in summer.
          </p>
          <Link
            href="/properties"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find Your Portland Home
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            No booking fees &middot; Free cancellation on most stays &middot;
            Portland-based support
          </p>
          <div className="mx-auto mt-5 max-w-sm">
            <InlineEmailCapture
              headline="Get the best Portland deals in your inbox."
              buttonText="Send it"
            />
          </div>
        </div>

        <div className="pb-16" />
      </article>

      {/* Final banner CTA */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/home/portland-sunset-skyline.jpg"
            alt="Portland skyline at sunset with the Hawthorne Bridge"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            Don&apos;t Just Visit Portland — Live It.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            275+ vacation homes across Portland. No booking fees. Save 10–15%
            vs. Airbnb when you book direct.
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
