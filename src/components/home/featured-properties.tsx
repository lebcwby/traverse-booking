import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { PropertyCard } from "@/components/properties/property-card";
import { type Listing } from "@/lib/supabase";
import { getPhotoUrl, clampReviewAvg } from "@/lib/utils";
import { enrichListingsWithReviewAverages } from "@/lib/reviews";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cachedToListing(r: any): Listing {
  return {
    id: 0,
    guesty_id: r.guesty_id,
    nickname: r.nickname || null,
    title: r.title || null,
    property_type: r.property_type || null,
    room_type: null,
    bedrooms: r.bedrooms ?? null,
    bathrooms: r.bathrooms ?? null,
    beds: r.beds ?? null,
    accommodates: r.accommodates ?? null,
    area_square_feet: null,
    address: r.address || null,
    prices: r.prices || null,
    active: true,
    is_listed: true,
    picture: r.picture || null,
    pictures: r.pictures || null,
    picture_count: r.pictures?.length ?? null,
    amenities: null,
    tags: null,
    default_check_in_time: null,
    default_check_out_time: null,
    terms: null,
    reviewAvg: clampReviewAvg(r.review_avg ?? null),
    reviewTotal: r.review_total ?? null,
  };
}

function getDisplayTitle(listing: Listing): string {
  const type =
    listing.property_type === "House" || listing.property_type === "Townhouse"
      ? "House"
      : "Apartment";
  const street = (listing.address?.street || "").toLowerCase();
  let quadrant: string | null = null;
  if (street.includes("southeast")) quadrant = "SE";
  else if (street.includes("northeast")) quadrant = "NE";
  else if (street.includes("northwest")) quadrant = "NW";
  else if (street.includes("southwest")) quadrant = "SW";
  else if (street.includes("north ")) quadrant = "N";
  else if (street.includes("south ")) quadrant = "S";
  return quadrant ? `${type} in ${quadrant} Portland` : `${type} in Portland`;
}

function isHouseType(listing: Listing): boolean {
  return (
    listing.property_type === "House" || listing.property_type === "Townhouse"
  );
}

export async function FeaturedProperties() {
  let featured: Listing[] = [];

  try {
    const supabase = createClient(
      process.env.SHARED_SUPABASE_URL!,
      process.env.SHARED_SUPABASE_SERVICE_ROLE_KEY!,
      {
        global: {
          fetch: (url, init) =>
            fetch(url, { ...init, next: { revalidate: 300 } }),
        },
      }
    );

    const { data } = await supabase
      .from("kv_store")
      .select("key, value")
      .in("key", ["featured_listings", "listing_pricing_cache"]);

    const featuredRow = data?.find((r) => r.key === "featured_listings");
    const pricingRow = data?.find((r) => r.key === "listing_pricing_cache");

    if (featuredRow?.value) {
      featured = (featuredRow.value as unknown[]).map(cachedToListing);
    }

    if (pricingRow?.value && Array.isArray(pricingRow.value)) {
      const priceMap = new Map<
        string,
        {
          estimatedTotal: number;
          nightCount: number;
          checkIn: string;
          checkOut: string;
        }
      >();
      for (const entry of pricingRow.value) {
        priceMap.set(entry.guesty_id, entry);
      }
      featured = featured.map((l) => {
        const cached = priceMap.get(l.guesty_id);
        if (cached) {
          return {
            ...l,
            totalPrice: cached.estimatedTotal,
            nightCount: cached.nightCount,
            cachedCheckIn: cached.checkIn,
            cachedCheckOut: cached.checkOut,
          };
        }
        return l;
      });
    }
  } catch (err) {
    console.error("Failed to load featured listings:", err);
  }

  // Overwrite BEAPI-cached reviewAvg with computed averages from individual reviews
  // (BEAPI avg ÷ 2 always ends in .0 or .5 due to 1-decimal precision on 10-pt scale)
  await enrichListingsWithReviewAverages(featured);

  if (featured.length === 0) return null;

  const apartments = featured.filter((l) => !isHouseType(l));
  const houses = featured.filter((l) => isHouseType(l));

  return (
    <section className="mx-auto max-w-[2000px] px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* Mobile: Two horizontal scroll carousels */}
      <div className="space-y-5 sm:hidden">
        {apartments.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-foreground">
              Popular Apartments
            </h2>
            <div
              className="-mr-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {apartments.map((listing, i) => (
                <div
                  key={listing.guesty_id}
                  className="w-[38vw] max-w-[170px] flex-none snap-start"
                >
                  <PropertyCard
                    listing={listing}
                    compact
                    photoWidth={800}
                    priority={i < 3}
                    displayTitle={getDisplayTitle(listing)}
                    maxPhotos={1}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {houses.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-foreground">
              Popular Homes
            </h2>
            <div
              className="-mr-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {houses.map((listing, i) => (
                <div
                  key={listing.guesty_id}
                  className="w-[38vw] max-w-[170px] flex-none snap-start"
                >
                  <PropertyCard
                    listing={listing}
                    compact
                    photoWidth={800}
                    priority={i < 3}
                    displayTitle={getDisplayTitle(listing)}
                    maxPhotos={1}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Grid (unchanged) */}
      <div className="hidden sm:block">
        <h2 className="mb-6 text-2xl font-bold text-foreground">
          Featured Properties
        </h2>
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
          {featured.map((listing, i) => (
            <PropertyCard
              key={listing.guesty_id}
              listing={listing}
              hideCity
              photoWidth={1200}
              priority={i < 5}
              lazyCarousel
              displayTitle={getDisplayTitle(listing)}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/properties"
          className="inline-flex items-center gap-3 rounded-full border border-border bg-muted/50 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <div className="flex -space-x-2">
            {featured.slice(0, 4).map((listing, i) => (
              <div
                key={i}
                className="relative h-8 w-8 overflow-hidden rounded-lg border-2 border-white"
              >
                <Image
                  src={getPhotoUrl(
                    listing.pictures?.[0] || listing.picture || "",
                    100
                  )}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>
            ))}
          </div>
          See more properties
        </Link>
      </div>
    </section>
  );
}
