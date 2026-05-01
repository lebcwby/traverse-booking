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
  title: "Portland Vacation Homes — A Better Alternative to Hotels",
  description:
    "Discover why travelers are choosing Portland vacation homes over hotels. More space, real neighborhoods, full kitchens, and free parking. 275+ homes managed locally by Book Traverse.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/portland-vacation-homes" },
  openGraph: {
    title: "Portland Vacation Homes — A Better Alternative to Hotels",
    description:
      "Discover why travelers are choosing Portland vacation homes over hotels. More space, real neighborhoods, full kitchens, and free parking.",
    images: [
      { url: "/images/home/kearney-exterior.jpg", width: 1264, height: 848 },
    ],
  },
};

function ComparisonTable() {
  const rows = [
    {
      feature: "Neighborhood",
      hotel: "Downtown hotel district",
      vr: "Hawthorne, Alberta, Pearl & more",
      winner: "vr",
    },
    {
      feature: "Walkability",
      hotel: "Uber to restaurants",
      vr: "Walk to dinner, walk home",
      winner: "vr",
    },
    {
      feature: "Space",
      hotel: "350 sq ft room",
      vr: "1,200+ sq ft home",
      winner: "vr",
    },
    {
      feature: "Privacy",
      hotel: "Shared walls, hallways",
      vr: "Private entrance, yard",
      winner: "vr",
    },
    {
      feature: "Groups & families",
      hotel: "2–3 rooms needed",
      vr: "One home, one price",
      winner: "vr",
    },
    {
      feature: "Parking",
      hotel: "$25–45/night garage",
      vr: "Free parking at most homes",
      winner: "vr",
    },
    {
      feature: "Kitchen",
      hotel: "Mini-fridge, microwave",
      vr: "Full kitchen, dishwasher",
      winner: "vr",
    },
    {
      feature: "Support",
      hotel: "Front desk in lobby",
      vr: "Local team, always available",
      winner: "tie",
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

export default function PortlandVacationHomesPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Portland Locals Have Stopped Recommending Hotels to Visitors. Here's What They Suggest Instead.",
    description:
      "Discover why travelers are choosing Portland vacation homes over hotels. More space, real neighborhoods, full kitchens, and free parking.",
    url: "https://www.booktraverse.com/portland-vacation-homes",
    publisher: { "@id": "https://www.booktraverse.com/#organization" },
    author: { "@id": "https://www.booktraverse.com/#organization" },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.booktraverse.com/portland-vacation-homes",
    },
  };

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Book Traverse", url: "https://www.booktraverse.com" },
    {
      name: "Portland Vacation Homes",
      url: "https://www.booktraverse.com/portland-vacation-homes",
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

      {/* Editorial-style hero — article header, not landing page */}
      <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.15]">
          Portland Locals Have Stopped Recommending Hotels to Visitors.
          Here&apos;s What They Suggest Instead.
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Portland&apos;s best neighborhoods have zero hotels. A growing number
          of travelers are figuring out that&apos;s not a problem — it&apos;s
          the point.
        </p>

        <p className="mt-3">
          <Link
            href="/properties"
            className="text-sm text-primary hover:underline"
          >
            Browse 275+ vacation homes →
          </Link>
        </p>

        {/* Lead image — editorial style with caption */}
        <figure className="mt-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/kearney-exterior.jpg"
              alt="A blue Victorian home with gambrel roof and upper balcony on NW Kearney in Portland"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            A Book Traverse home on NW 23rd — one of the city&apos;s most
            walkable neighborhoods
          </figcaption>
        </figure>

        {/* Hook */}
        <p className="mt-8 text-lg leading-relaxed text-foreground">
          Ask anyone who lives in Portland where to stay when visiting, and they
          won&apos;t point you to the hotel district downtown. They&apos;ll tell
          you to stay in a neighborhood — Hawthorne for the restaurants, Alberta
          for the art galleries, Division for the coffee. The problem is, there
          are no hotels in any of these places.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Portland&apos;s best neighborhoods were built as residential streets,
          not tourist corridors. The restaurants Portlanders actually eat at are
          tucked between bungalows and craftsman homes, not conference centers.
          And that&apos;s exactly why a growing number of travelers are skipping
          Portland hotels entirely.
        </p>

        {/* Problem */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          The Portland Hotel Problem
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Portland&apos;s hotel inventory is concentrated in a handful of blocks
          downtown and near the airport. That means most hotel guests see the
          same five blocks of Portland — the convention center, a food cart pod,
          and maybe Pioneer Square. They miss the neighborhoods that make
          Portland unlike any other city.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Then there&apos;s the location. The restaurants Portlanders eat at
          every night are on Hawthorne, Division, Alberta, Mississippi — all
          residential neighborhoods with zero hotels. From a downtown hotel,
          you&apos;re taking an Uber to dinner. From a Book Traverse home,
          you&apos;re walking.
        </p>

        <PullQuote
          text="We walked to dinner every night — a different restaurant on every block. Then walked home. From a downtown hotel that's a $25 Uber each way."
          author="Jennifer M., visiting from San Francisco"
        />

        {/* Bridge / Education */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          What Portland Travelers Are Doing Instead
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Book Traverse manages over 200 vacation rentals across the city —
          craftsman bungalows, modern townhouses, apartments, and mid-century
          gems — all in the neighborhoods where Portland actually happens.
          Private entrances, yards, and the kind of space a hotel room simply
          cannot offer.
        </p>

        {/* Interior photo — Casa Adelynn */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/home-casa-adelynn-cover.jpg"
              alt="A craftsman living room with teal sofa, stained glass windows, and original woodwork in a Portland vacation home"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Casa Adelynn on SE Hawthorne — original craftsman character, steps
            from restaurants
          </figcaption>
        </figure>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          The shift makes sense when you compare what you actually get:
        </p>

        <ComparisonTable />

        <p className="mt-4 leading-relaxed text-muted-foreground">
          One common concern: &ldquo;What if something goes wrong and
          there&apos;s no front desk?&rdquo; It&apos;s a fair question. Stay
          Portland solves this with a local team that&apos;s reachable by phone
          or text anytime — not a 1-800 number routing to a call center in
          another state. If the heat goes out at 10pm, you&apos;re texting
          someone who lives 15 minutes away, not leaving a voicemail.
        </p>

        {/* Soft mid-article CTA */}
        <InlineCTA href="/properties" label="Check Availability" />

        {/* Neighborhoods with photos */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Where to Stay: Portland&apos;s Best Neighborhoods for Visitors
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Part of what makes vacation rentals work so well in Portland is that
          the city is built around distinct neighborhoods, each with its own
          personality. Here are a few where travelers tend to book:
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <NeighborhoodCard
            name="Hawthorne & Belmont"
            slug="hawthorne-belmont"
            image="/images/home/poi-hawthorne.jpg"
            description="Walkable dining, vintage shops, and some of Portland's best coffee"
          />
          <NeighborhoodCard
            name="Alberta Arts District"
            slug="alberta"
            image="/images/home/poi-alberta.jpg"
            description="Murals, independent galleries, and the city's best brunch scene"
          />
          <NeighborhoodCard
            name="Mississippi Avenue"
            slug="mississippi"
            image="/images/home/poi-mississippi.jpg"
            description="String lights, local artisans, and creative community bars"
          />
          <NeighborhoodCard
            name="Pearl District"
            slug="pearl-district"
            image="/images/home/poi-pearl.jpg"
            description="Upscale dining, galleries, and urban walkability"
          />
        </div>

        <p className="mt-6 leading-relaxed text-muted-foreground">
          None of these neighborhoods have hotels. All of them have Stay
          Portland properties available for nightly booking.
        </p>

        {/* Interior photo — Adelynn */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/home-adelynn-cover.jpg"
              alt="A designer dining room with wood beams, dome pendant lights, and open living area in a Portland vacation home"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            The Adelynn in Kerns — room for the whole group, steps from
            restaurants on SE 28th
          </figcaption>
        </figure>

        {/* Interior lifestyle photo — Kearney */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/home-kearney-cover.jpg"
              alt="Living room with exposed wood beams, hanging plants, and natural light in a Portland vacation home"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            NW Kearney — a guest favorite in the Alphabet District, steps from
            NW 23rd
          </figcaption>
        </figure>

        {/* Solution — Book Traverse */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          How Book Traverse Works
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Every Book Traverse property is professionally maintained, locally
          managed, and available for nightly booking — no Airbnb or VRBO markup
          required.
        </p>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          When you book direct on{" "}
          <Link href="/" className="text-primary hover:underline">
            booktraverse.com
          </Link>
          , you skip the platform fees that add 10–15% to every booking on
          Airbnb or VRBO. The price you see is the price you pay. No service
          fees. No hidden charges.
        </p>

        <StatBar propertyLabel="Homes across Portland" />

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
                Browse by neighborhood, style, or group size
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter for pet-friendly homes, luxury properties, large group
                houses, or specific neighborhoods.
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
                instructions within minutes. Door codes, WiFi, and a
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
                Arrive to a home, not a lobby
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Walk up to your own front door on a quiet residential street.
                The beds have hotel-quality linens, and the best restaurants in
                Portland are right outside your door.
              </p>
            </div>
          </div>
        </div>

        <PullQuote
          text="We've stayed at three different Book Traverse homes now. Each one felt like living in the neighborhood — walking to dinner, grabbing coffee around the corner, hanging out in the yard. The kids love it and we keep coming back."
          author="David R., returning guest from Chicago"
        />

        {/* Luxury photo — shows range */}
        <figure className="my-8">
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <Image
              src="/images/home/8d391de9-2051-4726-8d14-5f2d9ca5dfac.jpg"
              alt="A waterfront living room with panoramic views in a luxury Portland vacation rental"
              width={1200}
              height={800}
              className="h-full w-full object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            From craftsman bungalows to waterfront retreats — Book Traverse
            manages homes at every price point
          </figcaption>
        </figure>

        {/* Final CTA */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Your Portland Neighborhood Is Waiting
        </h2>

        <p className="mt-4 leading-relaxed text-muted-foreground">
          Whether you&apos;re planning a family trip, a weekend with friends, or
          a solo escape, there&apos;s a Book Traverse home in the neighborhood
          that fits. Portland&apos;s most popular homes book 2–3 weeks ahead —
          especially in summer.
        </p>

        <InlineCTA href="/properties" label="Find Your Portland Home" />
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
            275+ vacation homes in Portland&apos;s best neighborhoods. No
            booking fees. Save 10–15% vs. Airbnb when you book direct.
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
