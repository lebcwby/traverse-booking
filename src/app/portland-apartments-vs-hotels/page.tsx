import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, UtensilsCrossed, Car, MapPin, Phone, Star } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { StickyCTA } from "@/components/marketing/sticky-cta";
import { ListicleItem } from "@/components/marketing/listicle-item";
import { InlineCTA } from "@/components/marketing/inline-cta";
import { CredibilityBar } from "@/components/marketing/credibility-bar";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "5 Reasons Portland Travelers Are Switching from Hotels to Apartments",
  description:
    "More space, full kitchens, better neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse apartments over Portland hotels.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/portland-apartments-vs-hotels" },
  openGraph: {
    title:
      "5 Reasons Portland Travelers Are Switching from Hotels to Apartments",
    description:
      "More space, full kitchens, better neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse apartments over hotels.",
    images: [
      { url: "/images/home/apt-asylum303-cover.jpg", width: 1200, height: 800 },
    ],
  },
};

export default function PortlandApartmentsVsHotelsPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "5 Reasons Portland Travelers Are Switching from Hotels to Apartments",
    description:
      "More space, full kitchens, better neighborhoods, and no booking fees. Discover why 80,000+ guests have chosen Book Traverse apartments over Portland hotels.",
    url: "https://www.booktraverse.com/portland-apartments-vs-hotels",
    publisher: { "@id": "https://www.booktraverse.com/#organization" },
    author: { "@id": "https://www.booktraverse.com/#organization" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.booktraverse.com/portland-apartments-vs-hotels",
    },
  };

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    {
      name: "Apartments vs Hotels",
      url: "https://www.booktraverse.com/portland-apartments-vs-hotels",
    },
  ]);

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      <StickyCTA
        href="/properties"
        label="Browse Portland Apartments"
        sublabel="275+ properties"
      />

      <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.15]">
          5 Reasons Portland Travelers Are Switching from Hotels to Apartments
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Same nightly rate. Twice the space. A real kitchen. Here&apos;s why
          the switch is happening.
        </p>

        <p className="mt-3">
          <Link
            href="/properties"
            className="text-sm text-primary hover:underline"
          >
            Browse 275+ Portland apartments →
          </Link>
        </p>

        {/* Lead image */}
        <figure className="mt-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-asylum303-cover.jpg"
              alt="A stylish 1-bedroom apartment with live-edge coffee table, teal accents, and bedroom visible through doorway"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            A guest favorite near the Hawthorne neighborhood, managed by Stay
            Portland
          </figcaption>
        </figure>

        {/* Credibility strip */}
        <div className="mt-8 rounded-xl bg-secondary/30 py-4">
          <CredibilityBar />
        </div>

        <p className="mt-8 text-lg leading-relaxed text-foreground">
          Planning a trip to Portland? Most travelers default to searching for
          hotels — but a growing number are booking Book Traverse apartments
          instead. Better locations, more space, and surprisingly similar
          pricing. Here&apos;s why.
        </p>

        <div className="mt-8 divide-y divide-border">
          {/* #1 — Strongest (primacy): walk to dinner, walk home */}
          <ListicleItem
            number={1}
            icon={UtensilsCrossed}
            title="Walk to Dinner. Walk Home. No Uber Required."
          >
            <p>
              Portland is one of the best food cities in the country — but the
              restaurants that put it on the map aren&apos;t downtown.
              They&apos;re on Division Street, Hawthorne Boulevard, Alberta
              Street, and NW 23rd. A hotel puts you in the convention center
              district. A Book Traverse apartment puts you walking distance from
              the restaurants, bars, and coffee shops you came here to try.
            </p>
            <p>
              Walk to dinner at Eem or Langbaan on SE Division. Grab cocktails
              at Expatriate on NE Prescott. Stroll to brunch at Screen Door on
              Hawthorne. Then walk home — no Uber surge, no parking garage, no
              planning. Your apartment is on the same streets where Portland
              actually happens.
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
              &ldquo;We walked to dinner every night — a different restaurant
              each time, all within a few blocks. You can&apos;t do that from a
              downtown hotel.&rdquo;
              <span className="mt-1 block text-sm font-medium not-italic text-muted-foreground">
                — Rachel K., guest from Denver
              </span>
            </blockquote>
          </ListicleItem>

          {/* #2 — Quiet, safe, walkable neighborhoods */}
          <ListicleItem
            number={2}
            icon={MapPin}
            title="Quiet Streets, Tree-Lined Blocks, Zero Tourist Crowds"
          >
            <p>
              Portland&apos;s residential neighborhoods are what make the city
              special — and hotels aren&apos;t in any of them. Craftsman
              bungalows, mature trees, corner coffee shops, neighbors walking
              their dogs. It&apos;s quiet at night. You can walk everywhere. And
              it feels nothing like a hotel district.
            </p>
            <p>
              Book Traverse apartments are on the same streets Portlanders live
              on — in neighborhoods like{" "}
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
              , NW 23rd, and SE Division. You&apos;re not a tourist in a lobby —
              you&apos;re a neighbor with a front door.
            </p>

            {/* Vancouver exterior */}
            <figure className="mt-4">
              <div className="aspect-[3/2] overflow-hidden rounded-lg">
                <Image
                  src="/images/home/apt-vancouver-exterior.jpg"
                  alt="The Vancouver building — a modern apartment building with stone facade and accent lighting at dusk in a Portland neighborhood"
                  width={800}
                  height={533}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                The Vancouver on N Vancouver Ave — a quiet residential street
                with restaurants and shops on every corner
              </figcaption>
            </figure>

            {/* Rooftop photo */}
            <figure className="mt-4">
              <div className="aspect-[3/2] overflow-hidden rounded-lg">
                <Image
                  src="/images/home/apt-asylum-rooftop.jpg"
                  alt="A private rooftop terrace with string lights, outdoor dining, and neighborhood views"
                  width={800}
                  height={533}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                Private rooftop at the Asylum on SE 19th — neighborhood views,
                not a parking lot
              </figcaption>
            </figure>
          </ListicleItem>

          {/* #3 — Twice the space (kitchen folded in as bonus) */}
          <ListicleItem
            number={3}
            icon={Home}
            title="Twice the Space — Plus a Real Kitchen If You Want It"
          >
            <p>
              A standard Portland hotel room is about 350 square feet. A Stay
              Portland 1-bedroom apartment is 600–900 square feet — with a
              separate living area, a dining table, and room to actually live.
              You&apos;re not eating takeout on the bed or working at a tiny
              desk wedged next to the TV.
            </p>
            <p>
              For couples, it means actual room to spread out. For business
              travelers, a real workspace. And every apartment has a full
              kitchen — useful for morning coffee, storing leftovers from last
              night&apos;s dinner, or cooking when you want a quiet night in.
            </p>

            {/* Bedroom photo */}
            <figure className="mt-2">
              <div className="aspect-[3/2] overflow-hidden rounded-lg">
                <Image
                  src="/images/home/apt-pomeroy-bedroom.jpg"
                  alt="An elegant apartment bedroom with canopy bed and gold sconces in Portland"
                  width={800}
                  height={533}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                />
              </div>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                Canopy bed at the Pomeroy on NW 23rd — our most-booked apartment
              </figcaption>
            </figure>
          </ListicleItem>

          {/* Mid-list CTA */}
          <div className="border-none">
            <InlineCTA href="/properties" label="Check Availability" />
          </div>

          {/* #4 — No hidden fees (weakest position) */}
          <ListicleItem
            number={4}
            icon={Car}
            title="No Hidden Fees — The Price You See Is the Price You Pay"
          >
            <p>
              Portland hotel parking runs $25–45 per night. Resort fees add
              another $15–30. WiFi surcharges, early check-in fees — it adds up.
              A $200 hotel room becomes $260 after the extras.
            </p>
            <p>
              Book Traverse apartments have no resort fees, no WiFi charges, and
              no hidden costs. The price you see is the price you pay — no
              surprise charges at checkout.
            </p>

            <p className="rounded-lg bg-secondary/50 p-4 text-sm">
              <span className="font-semibold text-foreground">Quick math:</span>{" "}
              A 1BR apartment at $140/night vs. a hotel room at $200/night
              (after parking and resort fees) = $60/night saved. Over five
              nights, that&apos;s $300 back in your pocket — with more space in
              a better neighborhood.
            </p>
          </ListicleItem>

          {/* #5 — Second-strongest (recency effect) */}
          <ListicleItem
            number={5}
            icon={Star}
            title="Book Direct and Get the Lowest Price — Guaranteed"
          >
            <p>
              Every Book Traverse apartment is also listed on Airbnb and VRBO —
              but those platforms charge service fees of 10–15% on top of the
              nightly rate. When you book the same apartment directly on
              booktraverse.com, you skip the platform entirely.
            </p>
            <p>
              That means the direct price is always the lowest available price.
              Same apartment, same dates, same quality — just without the
              middleman markup.
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
              &ldquo;I travel to Portland monthly for work and I&apos;ve
              completely stopped booking hotels. The apartment on NW 23rd is
              walking distance from everything and costs less than a hotel after
              fees.&rdquo;
              <span className="mt-1 block text-sm font-medium not-italic text-muted-foreground">
                — Marcus L., frequent business traveler from Seattle
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
            Browse 275+ apartments and homes across Portland&apos;s best
            neighborhoods. Book direct for the lowest price, no fees, and
            instant confirmation.
          </p>
          <p className="mx-auto mt-2 text-sm text-muted-foreground/80">
            Portland&apos;s best apartments book quickly — especially in summer.
          </p>
          <Link
            href="/properties"
            className="mt-6 inline-flex items-center rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find Your Portland Apartment
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
            275+ apartments and homes across Portland. No booking fees. Save
            10–15% vs. Airbnb when you book direct.
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
