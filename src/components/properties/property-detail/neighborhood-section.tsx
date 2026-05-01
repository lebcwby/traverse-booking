import Link from "next/link";
import { MapPin } from "lucide-react";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import type { NeighborhoodInfo } from "@/lib/neighborhoods";

interface NeighborhoodSectionProps {
  neighborhood: NeighborhoodInfo;
}

export function NeighborhoodSection({
  neighborhood,
}: NeighborhoodSectionProps) {
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold">
        The Neighborhood: {neighborhood.name}
      </h2>
      <p className="text-sm leading-relaxed text-foreground">
        {neighborhood.tagline}
      </p>
      {neighborhood.landmarks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {neighborhood.landmarks.map((landmark) => (
            <span
              key={landmark}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            >
              <MapPin className="h-3 w-3" />
              {landmark}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={getLandingPagePath(neighborhood.slug)}
          className="text-sm font-semibold text-foreground underline underline-offset-2 hover:text-foreground/70"
        >
          Browse all {neighborhood.name} rentals
        </Link>
        {neighborhood.quadrantSlug && neighborhood.quadrant && (
          <>
            <span className="text-muted-foreground">·</span>
            <Link
              href={getLandingPagePath(neighborhood.quadrantSlug)}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground/70"
            >
              More in {neighborhood.quadrant}
            </Link>
          </>
        )}
        {neighborhood.guideSlug && (
          <>
            <span className="text-muted-foreground">·</span>
            <Link
              href={`/guide/${neighborhood.guideSlug}`}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground/70"
            >
              Colorado area guide
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
