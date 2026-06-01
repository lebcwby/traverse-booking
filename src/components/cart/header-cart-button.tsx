"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/cart-store";

interface HeaderCartButtonProps {
  /** Tailwind-only color override. Default uses the page's `currentColor`. */
  className?: string;
  /** Render mode — icon-only (default) or icon+label. */
  variant?: "icon-only" | "icon-label";
}

/**
 * Cart icon for the site header. Shows a count badge when there are items
 * in the cart and opens the cart drawer on click. Mounted in both the
 * default <Header /> and the <NoFeesHeader /> variants so the cart is
 * reachable from every page.
 *
 * The drawer itself is mounted at the CartProvider level (in app/layout.tsx)
 * so AddToCartButton can also pop it open immediately on add — without that
 * separation the drawer would only mount when the header is in view.
 */
export function HeaderCartButton({
  className = "",
  variant = "icon-only",
}: HeaderCartButtonProps) {
  const { items, hydrated, openDrawer } = useCart();

  // Hide the count until hydration finishes — otherwise it flickers from
  // 0 to N. The icon itself renders unchanged so layout stays stable.
  const count = hydrated ? items.length : 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={
        count > 0
          ? `Open group-booking cart (${count} item${count === 1 ? "" : "s"})`
          : "Open group-booking cart"
      }
      className={`relative inline-flex items-center gap-1.5 ${className}`}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
      {variant === "icon-label" && (
        <span className="text-sm font-medium">Cart</span>
      )}
      {count > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
          aria-hidden="true"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
