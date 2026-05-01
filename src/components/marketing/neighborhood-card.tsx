import Image from "next/image";
import Link from "next/link";
import { getLandingPagePath } from "@/lib/landing-page-paths";

export function NeighborhoodCard({
  name,
  slug,
  image,
  description,
}: {
  name: string;
  slug: string;
  image: string;
  description: string;
}) {
  return (
    <Link href={getLandingPagePath(slug)} className="group">
      <div className="aspect-[4/3] overflow-hidden rounded-xl">
        <Image
          src={image}
          alt={`Vacation rentals in ${name}`}
          width={600}
          height={450}
          sizes="(max-width: 640px) 100vw, 384px"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
        {name}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
