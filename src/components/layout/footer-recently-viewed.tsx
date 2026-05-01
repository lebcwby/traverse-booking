"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRecentlyViewed, type RecentlyViewedListing } from "@/lib/tracking";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";

export function FooterRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedListing[]>([]);

  useEffect(() => {
    setItems(getRecentlyViewed().slice(0, 6));
  }, []);

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-primary-foreground/70">
        Continue Browsing
      </h3>
      <div className="-mr-6 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/properties/${getListingSlug(item.title, item.id)}`}
            className="w-[38vw] max-w-[170px] flex-none snap-start"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src={getPhotoUrl(item.imageUrl || "", 400)}
                alt={item.title || "Property"}
                fill
                className="object-cover"
                sizes="170px"
                loading="lazy"
              />
            </div>
            <p className="mt-1.5 truncate text-xs text-primary-foreground/60">
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
