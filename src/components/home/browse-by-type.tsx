import Image from "next/image";
import Link from "next/link";

const CATEGORIES: {
  label: string;
  slug: string | null;
  tagline: string;
  image: string;
}[] = [
  {
    label: "Pet-Friendly",
    slug: "pet-friendly",
    tagline: "Bring the whole pack",
    image: "/images/home/photo-1672430172282-fd2167ba8067.jpeg",
  },
  {
    label: "Luxury",
    slug: "luxury",
    tagline: "Elevated Portland stays",
    image: "/images/home/215bb57c-d5c9-4084-b8ae-8c59defa9faf.jpg",
  },
  {
    label: "Large Groups",
    slug: "large-groups",
    tagline: "Room for everyone",
    image: "/images/home/1782f62e-abd4-4f68-891b-9873942e32f7.jpg",
  },
  {
    label: "Families",
    slug: "family-friendly",
    tagline: "Kid-friendly homes",
    image: "/images/home/6717684d-40eb-4c57-8dc8-a366bafa70d4.jpg",
  },
  {
    label: "Extended Stay",
    slug: "extended-stay",
    tagline: "Monthly discounts available",
    image: "/images/home/570ee0aa-330a-4c0a-be17-25446ccb4607.jpg",
  },
  {
    label: "Best Portland Stays",
    slug: "best-portland-stays",
    tagline: "Top-rated homes, 87% 5-star",
    image: "/images/home/8d391de9-2051-4726-8d14-5f2d9ca5dfac.jpg",
  },
];

export function BrowseByType() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Find Your Perfect Stay
        </h2>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Browse Portland vacation rentals by what matters most to you.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={cat.slug ? `/s/${cat.slug}` : "/properties"}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl"
            >
              <Image
                src={cat.image}
                alt={`${cat.label} vacation rentals in Portland`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <h3 className="text-base font-semibold text-white sm:text-lg">
                  {cat.label}
                </h3>
                <p className="mt-0.5 text-xs text-white/80 sm:text-sm">
                  {cat.tagline}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
