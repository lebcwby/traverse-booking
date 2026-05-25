"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, X, Trash2, Calendar, Users, Bed } from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart/cart-store";
import { getListingSlug } from "@/lib/utils";

/**
 * Slide-out cart drawer. Reads its own open state from CartContext so it
 * can be opened from anywhere (header cart icon AND AddToCartButton both
 * call `openDrawer()`). Mount this once at the root via CartProvider in
 * app/layout.tsx.
 *
 * Phase 1: shows each cart line with a snapshot price (per-night × nights)
 * and a "Continue to cart" CTA that routes to /cart for the full live-
 * quote view + checkout.
 *
 * Snapshot prices here are for fast UX only — the source of truth is the
 * batch quote that runs at /cart and again right before checkout.
 */
export function CartDrawer() {
  const { items, removeItem, drawerOpen, closeDrawer } = useCart();
  const open = drawerOpen;
  const onClose = closeDrawer;

  // Lock body scroll while open. Restoring on close + on unmount prevents
  // a stuck scroll-lock if the user navigates away with the drawer open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes the drawer (matches Airbnb/Booking.com behavior).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Group booking cart"
    >
      {/* Scrim — clicking it closes the drawer. */}
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* Drawer panel — slides in from the right. */}
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-neutral-900">
              Group booking cart
            </h2>
            {items.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {items.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <EmptyCart onClose={onClose} />
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.lineId}>
                  <CartLine
                    item={item}
                    onRemove={() => removeItem(item.lineId)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer / CTA */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4">
            <p className="mb-3 text-xs text-neutral-500">
              Live pricing &amp; combined total on the next step.
            </p>
            <Link
              href="/cart"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              View cart &amp; combined total
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <ShoppingBag className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-900">
          Your group-booking cart is empty
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Browse properties and tap &ldquo;Add to group booking&rdquo; on each
          one you want — book them all in a single checkout.
        </p>
      </div>
      <Link
        href="/properties"
        onClick={onClose}
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Browse properties →
      </Link>
    </div>
  );
}

function CartLine({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: () => void;
}) {
  const slug = getListingSlug(item.listingTitle || item.listingNickname, item.listingId);
  const detailHref = `/properties/${slug}?checkIn=${item.checkIn}&checkOut=${item.checkOut}&guests=${item.guests}`;

  const nights = nightsBetween(item.checkIn, item.checkOut);
  // Per-night base rate snapshot — NOT a total. The cart drawer doesn't
  // know cleaning fees, taxes, or seasonal rate adjustments, so the only
  // honest pre-checkout number we can show is "from $X/night". The full
  // priced total is computed at /cart via the live BEAPI batch quote.
  const nightlySnapshot = item.nightlyPriceSnapshot;

  return (
    <article className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      {item.listingPicture && (
        <Link
          href={detailHref}
          className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.listingPicture}
            alt={item.listingTitle}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900 hover:underline"
            >
              {item.listingTitle}
            </Link>
            {item.city && (
              <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-neutral-500">
                {item.city}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.listingTitle} from cart`}
            className="shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-neutral-600">
          <li className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0 text-neutral-400" />
            {formatShortDate(item.checkIn)}–{formatShortDate(item.checkOut)}
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="h-3 w-3 shrink-0 text-neutral-400" />
            {item.guests} guest{item.guests === 1 ? "" : "s"}
          </li>
          {item.bedrooms != null && (
            <li className="flex items-center gap-1.5">
              <Bed className="h-3 w-3 shrink-0 text-neutral-400" />
              {item.bedrooms === 0
                ? "Studio"
                : `${item.bedrooms} bd`}
            </li>
          )}
          <li className="text-neutral-500">
            {nights} night{nights === 1 ? "" : "s"}
          </li>
        </ul>
        {nightlySnapshot != null && (
          <p className="mt-2 text-[12px] text-neutral-500">
            From ${" "}
            {nightlySnapshot.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            /night{" "}
            <span className="text-neutral-400">— total at checkout</span>
          </p>
        )}
      </div>
    </article>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00Z`).getTime();
  const b = new Date(`${checkOut}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function formatShortDate(iso: string): string {
  // "2026-06-05" → "Jun 5"
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}
