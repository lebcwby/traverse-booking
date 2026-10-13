"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";
import { getRecentlyViewed, type RecentlyViewedListing } from "@/lib/tracking";
import { WishlistButton } from "@/components/wishlist-button";

export default function RecentlyViewedPage() {
  const [items, setItems] = useState<RecentlyViewedListing[]>([]);

  useEffect(() => {
    setItems(getRecentlyViewed());
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/account/wishlists"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Wishlists
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-foreground">
        Recently viewed
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? "property" : "properties"}
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Properties you view will appear here.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const slug = getListingSlug(item.title, item.id);
            return (
              <div key={item.id} className="group relative">
                <Link href={`/properties/${slug}`} className="block">
                  <div className="relative aspect-square overflow-hidden rounded-xl">
                    {item.imageUrl ? (
                      <Image
                        src={getPhotoUrl(item.imageUrl, 800)}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                  </div>
                  <div className="mt-2">
                    <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        item.bedrooms &&
                          `${item.bedrooms} bed${item.bedrooms === 1 ? "" : "s"}`,
                        item.bathrooms &&
                          `${item.bathrooms} bath${item.bathrooms === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
                <WishlistButton
                  listingId={item.id}
                  className="absolute right-3 top-3 z-10 h-8 w-8"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
