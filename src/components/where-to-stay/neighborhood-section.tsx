import Image from "next/image";
import Link from "next/link";
import { getLandingPagePath } from "@/lib/landing-page-paths";
import type { NeighborhoodData } from "@/lib/where-to-stay-data";

function ScoreBadge({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-semibold text-foreground">{score}/10</span>
    </div>
  );
}

export function NeighborhoodSection({
  neighborhood,
}: {
  neighborhood: NeighborhoodData;
}) {
  return (
    <section
      id={neighborhood.id}
      className="scroll-mt-20 border-b border-border pb-10"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: neighborhood.color }}
        />
        <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {neighborhood.name}
        </h3>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Best for: {neighborhood.bestFor.join(", ")}
      </p>

      <figure className="mb-5">
        <div className="aspect-[16/9] overflow-hidden rounded-xl">
          <Image
            src={neighborhood.image}
            alt={neighborhood.imageAlt}
            width={800}
            height={450}
            className="h-full w-full object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
        </div>
      </figure>

      {neighborhood.description.map((paragraph, i) => (
        <p key={i} className="mt-3 leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}

      <div className="mt-5 flex flex-wrap gap-2">
        <ScoreBadge
          label="Walkability"
          score={neighborhood.scores.walkability}
        />
        <ScoreBadge label="Dining" score={neighborhood.scores.dining} />
        <ScoreBadge label="Nightlife" score={neighborhood.scores.nightlife} />
      </div>

      <div className="mt-4">
        <Link
          href={getLandingPagePath(neighborhood.slug)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Browse {neighborhood.name} properties &rarr;
        </Link>
      </div>
    </section>
  );
}
