import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { StickyCTA } from "@/components/marketing/sticky-cta";
import { InlineCTA } from "@/components/marketing/inline-cta";
import { PullQuote } from "@/components/marketing/pull-quote";
import { StatBar } from "@/components/marketing/stat-bar";
import { NeighborhoodCard } from "@/components/marketing/neighborhood-card";
import { InlineEmailCapture } from "@/components/marketing/inline-email-capture";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Portland Vacation Apartments — A Smarter Alternative to Hotels",
  description:
    "Stylish furnished apartments across Portland's best neighborhoods. Full kitchens, modern design, no booking fees. 275+ properties managed locally by Book Traverse.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/portland-vacation-apartments" },
  openGraph: {
    title: "Portland Vacation Apartments — A Smarter Alternative to Hotels",
    description:
      "Stylish furnished apartments across Portland's best neighborhoods. Full kitchens, modern design, no booking fees.",
    images: [
      {
        url: "/images/home/apt-vancouver-exterior.jpg",
        width: 1200,
        height: 800,
      },
    ],
  },
};

function ComparisonTable() {
  const rows = [
    {
      feature: "Space",
      hotel: "350 sq ft room",
      vr: "600–900 sq ft apartment",
      winner: "vr",
    },
    {
      feature: "Kitchen",
      hotel: "Mini-fridge, microwave",
      vr: "Full kitchen, dishwasher",
      winner: "vr",
    },
    {
      feature: "Design",
      hotel: "Standard chain decor",
      vr: "Individually designed interiors",
      winner: "vr",
    },
    {
      feature: "Privacy",
      hotel: "Shared hallways, elevators",
      vr: "Private entrance, your own space",
      winner: "vr",
    },
    {
      feature: "Walkability",
      hotel: "Downtown hotel district",
      vr: "NW 23rd, Hawthorne, Alberta & more",
      winner: "vr",
    },
    {
      feature: "Support",
      hotel: "Front desk in lobby",
      vr: "Local team, always available",
      winner: "tie",
    },
    {
      feature: "Booking fees",
      hotel: "Resort fees, parking fees",
      vr: "No hidden fees, book direct",
      winner: "vr",
    },
    {
      feature: "Pet policy",
      hotel: "$50/night + breed limits",
      vr: "Dog-friendly, no breed limits",
      winner: "vr",
    },
  ];

  return (
    <div className="my-10 overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-3 bg-primary/5 px-2 py-3 text-xs font-semibold sm:px-4 sm:text-sm">
        <span></span>
        <span className="text-center">Hotel</span>
        <span className="text-center text-primary">Book Traverse</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.feature}
          className="grid grid-cols-3 items-center border-t border-border px-2 py-3 text-xs sm:px-4 sm:text-sm"
        >
          <span className="font-medium text-foreground">{row.feature}</span>
          <span
            className={`text-center ${
              row.winner === "hotel"
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {row.hotel}
          </span>
          <span
            className={`text-center ${
              row.winner === "vr"
                ? "font-medium text-primary"
                : row.winner === "tie"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            {row.vr}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PortlandVacationApartmentsPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Portland Vacation Apartments — A Smarter Alternative to Hotels",
    description:
      "Stylish furnished apartments across Portland's best neighborhoods. Full kitchens, modern design, no booking fees.",
    url: "https://www.booktraverse.com/portland-vacation-apartments",
    publisher: { "@id": "https://www.booktraverse.com/#organization" },
    author: { "@id": "https://www.booktraverse.com/#organization" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.booktraverse.com/portland-vacation-apartments",
    },
  };

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    {
      name: "Portland Vacation Apartments",
      url: "https://www.booktraverse.com/portland-vacation-apartments",
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
          Why Smart Portland Travelers Are Booking Apartments Instead of Hotels
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Same price as a hotel room. Twice the space. A real kitchen. And
          you&apos;re in the neighborhood, not the hotel district.
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

        {/* Hook */}
        <p className="mt-8 text-lg leading-relaxed text-foreground">
          Here&apos;s the thing about Portland hotels: you&apos;re paying $200 a
          night for 350 square feet in a part of the city that locals avoid. The
          best restaurants, the best coffee, the best bars — they&apos;re all in
          the neighborhoods, not downtown. There&apos;s a better option, and it
          costs about the same.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Book Traverse manages over 200 furnished apartments across the
          city&apos;s best neighborhoods. Modern design, walkable streets, fast
          WiFi, and your own private space — starting around $129 a night.
          That&apos;s hotel pricing for an apartment that&apos;s twice the size,
          on a quiet, tree-lined street where you can walk to dinner and walk
          home.
        </p>

        {/* Problem */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          The Portland Hotel Trade-Off
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Portland&apos;s hotels are clustered in a few blocks downtown and near
          the convention center. It&apos;s fine if you&apos;re here for a
          conference. But if you&apos;re visiting Portland to actually
          experience Portland — the restaurants, the coffee, the neighborhoods —
          a downtown hotel puts you in the wrong part of the city.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          The restaurants that put Portland on the map are on Division Street,
          Hawthorne, Alberta, and NW 23rd — neighborhoods with zero hotels. From
          a downtown hotel, you&apos;re taking an Uber to dinner and an Uber
          back. From a Book Traverse apartment, you&apos;re walking.
        </p>

        <PullQuote
          text="We walked to dinner every night — Eem, Luce, Laurelhurst Market — all within blocks. Then walked home. From a downtown hotel that's a $25 Uber each way."
          author="Alex T., visiting from Austin"
        />

        {/* Bridge */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          What a Book Traverse Apartment Looks Like
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          These aren&apos;t corporate extended-stay units or someone&apos;s
          spare bedroom on Airbnb. Book Traverse apartments are professionally
          designed, fully furnished spaces in multi-unit buildings across
          Portland&apos;s most walkable neighborhoods — the same streets where
          the best restaurants, coffee shops, and bars are.
        </p>

        {/* Interior photo */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-2br-spanish-revival.jpg"
              alt="A charming apartment living room with decorative fireplace, live-edge coffee table, and hardwood floors near Hawthorne"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            A 2-bedroom near Hawthorne — original character, modern comfort
          </figcaption>
        </figure>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Every apartment comes with a full kitchen, modern furnishings, fast
          WiFi, and hotel-quality linens. Most have in-unit laundry. You check
          in with a door code — no front desk, no key cards, no waiting in line.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Here&apos;s how they compare to a standard Portland hotel:
        </p>

        <ComparisonTable />

        <p className="mt-4 leading-relaxed text-muted-foreground">
          The one thing hotels have that apartments don&apos;t: a lobby and a
          front desk. Book Traverse solves this with a local team that&apos;s
          reachable by phone or text anytime. If the WiFi goes out or you need a
          dinner recommendation at 9pm, you&apos;re texting someone who lives in
          Portland — not calling a national helpline.
        </p>

        {/* Mid CTA */}
        <InlineCTA href="/properties" label="Check Availability" />

        {/* Neighborhoods */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Where to Stay: Portland&apos;s Most Walkable Neighborhoods
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          The best part of booking an apartment in Portland is the location.
          These aren&apos;t suburban units miles from anything — they&apos;re in
          the neighborhoods that make Portland worth visiting.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <NeighborhoodCard
            name="NW 23rd & Alphabet District"
            slug="nw-23rd"
            image="/images/home/poi-nw23rd.jpg"
            description="Portland's most walkable street — boutiques, restaurants, and coffee on every block"
          />
          <NeighborhoodCard
            name="Hawthorne & Belmont"
            slug="hawthorne-belmont"
            image="/images/home/poi-hawthorne.jpg"
            description="Vintage shops, brunch spots, and the best people-watching in Portland"
          />
          <NeighborhoodCard
            name="Alberta Arts District"
            slug="alberta"
            image="/images/home/poi-alberta.jpg"
            description="Murals, galleries, and Portland's most creative food scene"
          />
          <NeighborhoodCard
            name="Division & Clinton"
            slug="southeast-portland"
            image="/images/home/poi-hawthorne.jpg"
            description="Award-winning restaurants, cocktail bars, and neighborhood bakeries"
          />
        </div>

        <p className="mt-6 leading-relaxed text-muted-foreground">
          None of these neighborhoods have hotels. All of them have Stay
          Portland apartments available for nightly booking.
        </p>

        {/* Vancouver exterior */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-vancouver-exterior.jpg"
              alt="The Vancouver building — a modern apartment building with stone facade and accent lighting at dusk in Portland"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            The Vancouver — a Book Traverse building on N Vancouver Ave in the
            heart of the neighborhood
          </figcaption>
        </figure>

        {/* Bedroom photo */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-pomeroy-bedroom.jpg"
              alt="An elegant apartment bedroom with canopy bed, gold sconces, and natural light in Portland"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Canopy bed and designer linens at the Pomeroy on NW 23rd — our
            most-booked apartment
          </figcaption>
        </figure>

        {/* Solution */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          How Book Traverse Works
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Every Book Traverse apartment is professionally maintained, locally
          managed, and available for nightly booking — no Airbnb or VRBO markup
          required.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          When you book direct on{" "}
          <Link href="/" className="text-primary hover:underline">
            booktraverse.com
          </Link>
          , you skip the platform fees that add 10–15% to every booking on
          Airbnb or VRBO. Same apartment, same dates — just without the
          middleman markup.
        </p>

        <StatBar />

        {/* Local team callout */}
        <div className="my-8 flex gap-4 rounded-xl bg-primary/5 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Portland-based team, always available
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Every guest gets a direct line to a local support team — not a
              national call center. Need a restaurant recommendation? Lost the
              door code? Something break at midnight? Text or call anytime and
              someone who lives in Portland will handle it.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              1
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Browse by neighborhood, size, or style
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter for studios, one-bedrooms, two-bedrooms, pet-friendly
                units, or specific neighborhoods.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              2
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Book instantly — no waiting for host approval
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick your dates, confirm your booking, and get check-in
                instructions within minutes. Door codes, WiFi password, and a
                neighborhood guide are all included.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              3
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Walk in to your own apartment
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter with your door code. The kitchen is stocked with basics,
                the bed has hotel-quality linens, and your Portland neighborhood
                is right outside.
              </p>
            </div>
          </div>
        </div>

        {/* Rooftop terrace photo */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-asylum-rooftop.jpg"
              alt="A private rooftop terrace with string lights, outdoor dining, and neighborhood views in Portland"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Private rooftop terrace at the Asylum on SE 19th — try getting this
            at a hotel
          </figcaption>
        </figure>

        <PullQuote
          text="I travel to Portland for work every month and I've completely stopped booking hotels. The Pomeroy apartment on NW 23rd has a better kitchen than my own house, and I'm walking distance from everything."
          author="Marcus L., frequent business traveler from Seattle"
        />

        {/* Open concept photo */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/apt-pomeroy-living.jpg"
              alt="A charming apartment living room with teal velvet sofa, leather accent chair, and canopy bed visible through doorway"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            The Pomeroy on NW 23rd — steps from Portland&apos;s best shopping
            and dining
          </figcaption>
        </figure>

        {/* Final CTA */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Your Portland Apartment Is Waiting
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Whether you&apos;re in town for a weekend, a week, or a month,
          there&apos;s a Book Traverse apartment in the neighborhood that fits.
          Portland&apos;s best apartments book quickly — especially in summer.
        </p>

        <InlineCTA href="/properties" label="Find Your Portland Apartment" />
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
            275+ apartments and homes across Portland&apos;s best neighborhoods.
            No booking fees. Save 10–15% vs. Airbnb when you book direct.
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
