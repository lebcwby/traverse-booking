import Image from "next/image";
import Link from "next/link";
import { getLandingPagePath } from "@/lib/landing-page-paths";

const NEIGHBORHOODS = [
  {
    name: "Alberta Arts District",
    slug: "alberta",
    description:
      "Murals, independent shops, and some of Portland's best brunch",
    image: "/images/home/poi-alberta.jpg",
  },
  {
    name: "Hawthorne & Belmont",
    slug: "hawthorne-belmont",
    description: "Eclectic streets, vintage shops, and walkable dining",
    image: "/images/home/poi-hawthorne.jpg",
  },
  {
    name: "Pearl District",
    slug: "pearl-district",
    description: "Galleries, upscale dining, and urban walkability",
    image: "/images/home/poi-pearl.jpg",
  },
  {
    name: "Mississippi Avenue",
    slug: "mississippi",
    description: "Local artisans, string lights, and creative community",
    image: "/images/home/poi-mississippi.jpg",
  },
  {
    name: "NW 23rd Avenue",
    slug: "nw-23rd",
    description:
      "Boutique shopping, cozy restaurants, and tree-lined sidewalks",
    image: "/images/home/poi-nw23rd.jpg",
  },
  {
    name: "Sellwood-Moreland",
    slug: "sellwood-moreland",
    description: "Antique shops, leafy streets, and neighborhood dining",
    image: "/images/home/poi-sellwood.jpg",
  },
];

export function NeighborhoodsSection() {
  return (
    <section className="bg-secondary/30 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Explore Portland Neighborhoods
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Every neighborhood has its own personality. Find the one that fits
          your trip.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {NEIGHBORHOODS.map((hood) => (
            <Link
              key={hood.slug}
              href={getLandingPagePath(hood.slug)}
              className="group"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-xl">
                <Image
                  src={hood.image}
                  alt={`Vacation rentals in ${hood.name}`}
                  width={600}
                  height={450}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {hood.name}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {hood.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
