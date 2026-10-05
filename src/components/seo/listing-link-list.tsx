import Link from "next/link";
import { type Listing } from "@/lib/supabase";
import { getListingSlug } from "@/lib/utils";

/**
 * A plain, server-rendered index of canonical listing URLs.
 *
 * Why this exists (2026-10-05): `site:booktraverse.com/properties/` returned
 * ZERO indexed listing pages while market and building pages indexed fine. The
 * detail pages themselves are healthy — SSR, revalidate=300, full
 * VacationRental JSON-LD. The problem was purely discovery: nothing linked to
 * them in crawlable HTML at any scale.
 *
 * BookableUnitsGrid is the conversion surface and deliberately shows a handful
 * of cards (`Math.min(limit, MAX_BATCH)` = at most 10) because each one costs a
 * BEAPI quote in a batch capped at 10. Grand Lodge has 50+ units, so ~40 of
 * them had no inbound link anywhere on the site except the XML sitemap. A
 * sitemap alone is a weak discovery signal; internal links are the strong one.
 *
 * So: keep the grid exactly as it is for conversion, and add this alongside it
 * as the crawl surface. It renders every unit the page already fetched, with no
 * extra API calls — the data is in hand either way.
 *
 * This is intentionally VISIBLE rather than hidden behind `<noscript>` or
 * `display:none`. Googlebot renders JS, discounts hidden link farms, and a
 * links-only-for-crawlers block is cloaking-adjacent. A compact "all units"
 * index is also genuinely useful to a guest comparing units in one building,
 * so it earns its place on the page.
 */
export function ListingLinkList({
  units,
  heading,
  description,
  max = 60,
  embedded = false,
}: {
  units: Listing[];
  heading: string;
  description?: string;
  max?: number;
  /** Drop the page-level gutters when rendered inside an existing column. */
  embedded?: boolean;
}) {
  const items = units.slice(0, max);
  if (items.length === 0) return null;

  return (
    <section
      className={
        embedded ? "mt-10" : "mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-8"
      }
    >
      <div className="rounded-2xl border border-border bg-muted/30 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">
          {heading}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        <ul
          className={`mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 ${
            embedded ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {items.map((u) => {
            const name = u.title || u.nickname || "View unit";
            const slug = getListingSlug(u.title || u.nickname, u.guesty_id);
            const specs = [
              u.bedrooms ? `${u.bedrooms} bd` : null,
              u.beds ? `${u.beds} beds` : null,
              u.bathrooms ? `${u.bathrooms} ba` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const from = u.prices?.basePrice
              ? `from $${Math.round(u.prices.basePrice)}/night`
              : null;
            const meta = [specs, from].filter(Boolean).join(" — ");

            return (
              <li key={u.guesty_id} className="text-sm leading-snug">
                <Link
                  href={`/properties/${slug}`}
                  className="text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {name}
                </Link>
                {meta && (
                  <span className="text-muted-foreground"> — {meta}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
