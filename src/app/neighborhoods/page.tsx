import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, ChevronRight } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import { JsonLd, getBreadcrumbSchema } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Portland Neighborhoods — Where to Stay",
  description:
    "Explore Portland's best neighborhoods for vacation rentals. From the Alberta Arts District to the Pearl District, find the perfect neighborhood for your Portland trip. 275+ homes across 10 neighborhoods.",
  alternates: { canonical: "https://www.booktraverse.com/neighborhoods" },
  openGraph: {
    title: "Portland Neighborhoods — Where to Stay | Book Traverse",
    description:
      "Explore Portland's best neighborhoods for vacation rentals. From the Alberta Arts District to the Pearl District, find the perfect neighborhood for your Portland trip.",
    url: "https://www.booktraverse.com/neighborhoods",
  },
};

interface NeighborhoodCard {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  image: string | null;
  propertyCount: string;
  highlights: string[];
}

const QUADRANTS: { name: string; neighborhoods: NeighborhoodCard[] }[] = [
  {
    name: "Northeast Portland",
    neighborhoods: [
      {
        name: "Alberta Arts District",
        slug: "alberta",
        tagline: "Murals, brunch, and Portland's creative heartbeat",
        description:
          "Alberta Street is Portland's most colorful and creative neighborhood. Nearly every block features murals, public art, and independently owned shops. Salt & Straw, Tin Shed Garden Cafe, and Pine State Biscuits are all here. Last Thursday art walks (May\u2013September) transform the street into an open-air gallery with live music and food vendors.",
        image: "/images/home/poi-alberta.jpg",
        propertyCount: "60+",
        highlights: [
          "Last Thursday art walk",
          "Salt & Straw",
          "Tin Shed Garden Cafe",
          "Alberta Park",
        ],
      },
      {
        name: "Mississippi Avenue",
        slug: "mississippi",
        tagline: "Local artisans, string lights, and live music",
        description:
          "Mississippi Avenue packs more independent character into a few blocks than most cities manage in an entire district. String lights overhead, Mississippi Studios for live music, Lovely's Fifty Fifty for pizza, and Prost! Beer Hall for communal outdoor drinking. The residential streets around Mississippi are classic North Portland \u2014 quiet, tree-lined, and full of craftsman homes.",
        image: "/images/home/poi-mississippi.jpg",
        propertyCount: "30+",
        highlights: [
          "Mississippi Studios",
          "Lovely's Fifty Fifty",
          "Prost! Beer Hall",
        ],
      },
    ],
  },
  {
    name: "Southeast Portland",
    neighborhoods: [
      {
        name: "Hawthorne & Belmont",
        slug: "hawthorne-belmont",
        tagline: "Vintage shops, bookstores, and eclectic dining",
        description:
          "Hawthorne and Belmont are the twin heartbeats of Southeast Portland. Hawthorne Boulevard has Powell's Books, House of Vintage, and dozens of food carts. Belmont is quieter with excellent neighborhood restaurants. Mt. Tabor Park \u2014 an extinct volcanic cinder cone with panoramic views \u2014 is a short walk east. The Eastside Esplanade along the river is ideal for morning runs.",
        image: "/images/home/poi-hawthorne.jpg",
        propertyCount: "50+",
        highlights: [
          "Powell's Books (Hawthorne)",
          "Mt. Tabor Park",
          "Division Street dining",
          "Ladd's Addition",
        ],
      },
      {
        name: "Sellwood-Moreland",
        slug: "sellwood-moreland",
        tagline: "Antique Row, river parks, and small-town charm",
        description:
          "Sellwood-Moreland feels like a small town within the city. Antique Row on SE 13th Avenue draws collectors from across the region. Sellwood Riverfront Park stretches along the Willamette with walking paths and an off-leash dog area. Oaks Amusement Park, operating since 1905, is a family favorite. The Springwater Corridor trail connects south to Milwaukie and north toward downtown.",
        image: "/images/home/poi-sellwood.jpg",
        propertyCount: "25+",
        highlights: [
          "Antique Row",
          "Sellwood Riverfront Park",
          "Oaks Amusement Park",
          "Springwater Corridor",
        ],
      },
    ],
  },
  {
    name: "Northwest Portland",
    neighborhoods: [
      {
        name: "Pearl District",
        slug: "pearl-district",
        tagline:
          "Galleries, upscale dining, and Portland's most walkable streets",
        description:
          "The Pearl District is Portland's most polished urban neighborhood. Former warehouses now house world-class galleries, restaurants, and boutiques. Powell's City of Books \u2014 the largest independent bookstore in the world \u2014 anchors the district. Jamison Square's wading fountain is a hit with families. First Thursday gallery walks draw crowds monthly. The Portland Streetcar runs through the heart of it all.",
        image: "/images/home/poi-pearl.jpg",
        propertyCount: "40+",
        highlights: [
          "Powell's City of Books",
          "Jamison Square",
          "Lan Su Chinese Garden",
          "First Thursday",
        ],
      },
      {
        name: "NW 23rd Avenue (Nob Hill)",
        slug: "nw-23rd",
        tagline: "Boutique shopping and Forest Park trailheads",
        description:
          "NW 23rd Avenue is Portland's premier boutique shopping street, lined with independent stores, cozy restaurants, and sidewalk cafes. The Victorian-era architecture gives the neighborhood a character all its own. Walk a few blocks uphill and you're at Forest Park \u2014 5,200 acres of old-growth forest inside the city limits. Pittock Mansion offers panoramic views of the city and Mt. Hood.",
        image: "/images/home/poi-nw23rd.jpg",
        propertyCount: "35+",
        highlights: [
          "Forest Park trails",
          "NW 23rd shops",
          "Pittock Mansion",
          "Washington Park",
        ],
      },
    ],
  },
  {
    name: "North Portland",
    neighborhoods: [
      {
        name: "St. Johns & Cathedral Park",
        slug: "north-portland",
        tagline: "Gothic bridges, community gardens, and neighborhood pride",
        description:
          "North Portland's St. Johns neighborhood has a small-town feel with its own downtown strip, community events, and the iconic St. Johns Bridge \u2014 a gothic suspension bridge that frames Cathedral Park below. The University of Portland campus is nearby, and the neighborhood's affordability and character have made it increasingly popular with visitors who want an authentic, less-touristy Portland experience.",
        image: null,
        propertyCount: "20+",
        highlights: [
          "St. Johns Bridge",
          "Cathedral Park",
          "University of Portland",
        ],
      },
    ],
  },
  {
    name: "Downtown & Central",
    neighborhoods: [
      {
        name: "Downtown Portland",
        slug: "downtown-portland",
        tagline: "Museums, waterfront parks, and the city center",
        description:
          "Downtown Portland puts you at the geographic center of the city with easy access to everything. Pioneer Courthouse Square, the Portland Art Museum, and Tom McCall Waterfront Park are all within walking distance. The MAX light rail connects downtown to the airport, Lloyd Center, and neighborhoods across the city. Saturday Market runs under the Burnside Bridge from March through December.",
        image: null,
        propertyCount: "15+",
        highlights: [
          "Pioneer Courthouse Square",
          "Portland Art Museum",
          "Waterfront Park",
          "Saturday Market",
        ],
      },
    ],
  },
];

export default function NeighborhoodsPage() {
  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Book Traverse", url: "https://www.booktraverse.com" },
          {
            name: "Neighborhoods",
            url: "https://www.booktraverse.com/neighborhoods",
          },
        ])}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Portland Neighborhoods
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Portland is a city of neighborhoods, each with its own personality,
            dining scene, and pace of life. Whether you want walkable urban
            energy, quiet tree-lined streets, or a creative arts district,
            there&apos;s a neighborhood that fits. Explore our 275+ vacation
            rentals across Portland&apos;s best areas.
          </p>
        </div>

        {/* Neighborhood grid by quadrant */}
        <div className="mt-12 space-y-14">
          {QUADRANTS.map((quadrant) => (
            <section key={quadrant.name}>
              <h2 className="text-xl font-semibold text-foreground">
                {quadrant.name}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {quadrant.neighborhoods.map((n) => (
                  <Link
                    key={n.slug}
                    href={getLandingPagePath(n.slug)}
                    className="group overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md"
                  >
                    {/* Image */}
                    {n.image ? (
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <Image
                          src={n.image}
                          alt={n.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 639px) 100vw, 50vw"
                        />
                        <div className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
                          {n.propertyCount} rentals
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                        <MapPin className="h-8 w-8 text-muted-foreground/30" />
                        <div className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
                          {n.propertyCount} rentals
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-foreground/80">
                        {n.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-accent">{n.tagline}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                        {n.description}
                      </p>

                      {/* Highlights */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {n.highlights.map((h) => (
                          <span
                            key={h}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                        Browse rentals <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 rounded-2xl bg-muted p-8 text-center sm:p-10">
          <h2 className="text-xl font-semibold text-foreground">
            Not sure which neighborhood?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Read our neighborhood guide for in-depth comparisons, or browse all
            275+ properties and filter by location, size, and amenities.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/guide/where-to-stay-in-portland"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Read the Neighborhood Guide
            </Link>
            <Link
              href="/properties"
              className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Browse All Properties
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
