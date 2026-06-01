"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart, CART_MAX_ITEMS } from "@/lib/cart/cart-store";
import { trackAddToCart } from "@/lib/tracking";

interface AddToCartButtonProps {
  listingId: string;
  listingTitle: string;
  listingNickname?: string | null;
  listingPicture?: string | null;
  bedrooms?: number | null;
  accommodates?: number | null;
  city?: string | null;
  /** ISO YYYY-MM-DD. Required to add — button is disabled without dates. */
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  pets?: number;
  /** Per-night display price (snapshot only — real total comes from /cart). */
  nightlyPriceSnapshot?: number | null;
  /** Override classes — by default styled as a secondary button next to Reserve. */
  className?: string;
  /** Called after successful add. Used by the property page to surface the
   * cart drawer or a toast. */
  onAdded?: () => void;
}

/**
 * Adds the current listing+dates+guests tuple to the multi-listing cart.
 * Mounted next to "Reserve" on property detail pages so guests building a
 * group booking can collect multiple listings before checking out together.
 *
 * Phase 1: client-side cart only, /cart shows the items but checkout is
 * disabled. Phase 2 wires the actual multi-listing payment flow.
 */
export function AddToCartButton({
  listingId,
  listingTitle,
  listingNickname = null,
  listingPicture = null,
  bedrooms = null,
  accommodates = null,
  city = null,
  checkIn,
  checkOut,
  guests,
  pets = 0,
  nightlyPriceSnapshot = null,
  className,
  onAdded,
}: AddToCartButtonProps) {
  const { items, addItem, findMatch, hydrated, openDrawer } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [cartFull, setCartFull] = useState(false);
  const atCap = hydrated && items.length >= CART_MAX_ITEMS;

  const datesPicked = !!(checkIn && checkOut);
  // Match check is meaningless until hydration completes; show neutral
  // state for the first paint to avoid SSR/CSR flicker.
  const inCart = hydrated && datesPicked
    ? !!findMatch(listingId, checkIn!, checkOut!, guests)
    : false;

  function handleClick() {
    if (!datesPicked || inCart) return;
    const result = addItem({
      listingId,
      listingTitle,
      listingNickname,
      listingPicture,
      bedrooms,
      accommodates,
      city,
      checkIn: checkIn!,
      checkOut: checkOut!,
      guests,
      pets,
      nightlyPriceSnapshot,
    });
    if (result === null) {
      // Cart at the 5-item cap. Surface a brief message; user can remove
      // a line from /cart to make room.
      setCartFull(true);
      setTimeout(() => setCartFull(false), 3500);
      return;
    }
    setJustAdded(true);
    // Fire analytics: GA4 add_to_cart, Meta AddToCart (browser+CAPI),
    // Klaviyo "Added to Cart" (cart abandonment flow trigger).
    trackAddToCart({
      listingId,
      listingTitle,
      listingNickname,
      checkIn: checkIn!,
      checkOut: checkOut!,
      guests,
      pets,
      nightlyPrice: nightlyPriceSnapshot,
      imageUrl: listingPicture,
      city,
    });
    // Pop the cart drawer open immediately so the user gets visual
    // confirmation + a one-click path to /cart without scrolling back to
    // the header. Drawer is dismissable as usual (Esc, scrim, X).
    openDrawer();
    onAdded?.();
    // Revert the "Added!" microcopy after 2s so the button reads "In cart"
    // (the steady state for an item already added).
    setTimeout(() => setJustAdded(false), 2000);
  }

  const baseClasses =
    "inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400";

  if (justAdded) {
    return (
      <button
        type="button"
        disabled
        className={className ?? baseClasses}
        aria-live="polite"
      >
        <Check className="h-4 w-4" />
        Added to cart
      </button>
    );
  }

  if (inCart) {
    return (
      <button
        type="button"
        disabled
        className={className ?? baseClasses}
        title="This listing+dates combo is already in your cart"
      >
        <Check className="h-4 w-4" />
        In cart
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!datesPicked || atCap}
        className={className ?? baseClasses}
        title={
          atCap
            ? `Cart is full (${CART_MAX_ITEMS} listings max). Remove one to add another.`
            : datesPicked
              ? "Add this listing to your group-booking cart"
              : "Select dates first to add to cart"
        }
      >
        <ShoppingBag className="h-4 w-4" />
        {atCap
          ? `Cart full (${CART_MAX_ITEMS} max)`
          : datesPicked
            ? "Add to group booking"
            : "Pick dates to add"}
      </button>
      {cartFull && (
        <p
          className="mt-2 text-xs text-amber-700"
          role="status"
          aria-live="polite"
        >
          Cart is full ({CART_MAX_ITEMS} listings max). Remove one in the cart
          to add another.
        </p>
      )}
    </>
  );
}
