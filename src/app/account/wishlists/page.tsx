"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Loader2 } from "lucide-react";
import { getPhotoUrl, getListingSlug } from "@/lib/utils";
import { WishlistButton } from "@/components/wishlist-button";
import { getRecentlyViewed, type RecentlyViewedListing } from "@/lib/tracking";

interface WishlistItem {
  listing_id: string;
  listing_title: string | null;
  listing_nickname: string | null;
  listing_picture: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  accommodates: number | null;
  beds: number | null;
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function WishlistsPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedListing[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account/wishlists")
      .then((res) => (res.ok ? res.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    setRecentlyViewed(getRecentlyViewed());
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get the most recent view date for the "Recently viewed" card label
  const latestViewDate =
    recentlyViewed.length > 0 ? recentlyViewed[0].viewedAt : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-foreground">Wishlists</h1>

      {/* Saved properties */}
      {items.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const photo = item.listing_picture;
              const slug = getListingSlug(
                item.listing_title || item.listing_nickname,
                item.listing_id
              );
              return (
                <div key={item.listing_id} className="group relative">
                  <Link href={`/properties/${slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden rounded-xl">
                      {photo ? (
                        <Image
                          src={getPhotoUrl(photo, 800)}
                          alt={
                            item.listing_title ||
                            item.listing_nickname ||
                            "Property"
                          }
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Heart className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
                        {item.listing_title ||
                          item.listing_nickname ||
                          "Property"}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          item.accommodates && `${item.accommodates} guests`,
                          item.bedrooms &&
                            `${item.bedrooms} bed${item.bedrooms === 1 ? "" : "s"}`,
                          item.bathrooms &&
                            `${item.bathrooms} bath${Number(item.bathrooms) === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </Link>
                  <WishlistButton
                    listingId={item.listing_id}
                    className="absolute right-3 top-3 z-10 h-8 w-8"
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Recently viewed — Airbnb-style 2x2 photo grid card */}
      {recentlyViewed.length > 0 && (
        <div className={items.length > 0 ? "mt-10" : "mt-6"}>
          <Link
            href="/account/wishlists/recently-viewed"
            className="group block w-fit"
          >
            <div
              className={`overflow-hidden rounded-xl ${
                recentlyViewed.length === 1
                  ? "h-64 w-64"
                  : recentlyViewed.length === 2
                    ? "grid h-64 w-64 grid-cols-2 gap-0.5"
                    : "grid h-64 w-64 grid-cols-2 gap-0.5"
              }`}
            >
              {recentlyViewed
                .slice(0, Math.min(recentlyViewed.length, 4))
                .map((item, i) => {
                  // With 3 items: first two are top row (square), third spans full width bottom
                  const isThirdOf3 = recentlyViewed.length === 3 && i === 2;
                  return (
                    <div
                      key={item.id}
                      className={`relative overflow-hidden ${isThirdOf3 ? "col-span-2" : ""}`}
                    >
                      {item.imageUrl ? (
                        <Image
                          src={getPhotoUrl(item.imageUrl, 400)}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="130px"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                  );
                })}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Recently viewed
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeDate(latestViewDate)}
            </p>
          </Link>
        </div>
      )}

      {items.length === 0 && recentlyViewed.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <Heart className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No saved properties yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart on any property to save it here.
          </p>
          <Link
            href="/properties"
            className="mt-6 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
          >
            Browse properties
          </Link>
        </div>
      )}
    </div>
  );
}
