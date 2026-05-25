"use client";

import { ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/cart-store";

/**
 * Floating cart pill, anchored bottom-right. Reopens the cart drawer with
 * one tap so users who scrolled past the header (or X-ed the drawer) can
 * always get back to their cart. Hidden when the cart is empty, when the
 * drawer is already open, or while on the /cart page itself.
 *
 * Mounted once at the CartProvider level so it lives on every page.
 */
export function FloatingCartPill() {
  const { items, hydrated, drawerOpen, openDrawer } = useCart();
  const pathname = usePathname();

  if (!hydrated) return null;
  if (items.length === 0) return null;
  if (drawerOpen) return null;
  if (pathname === "/cart" || pathname?.startsWith("/cart/")) return null;

  const count = items.length;
  const label = `${count} ${count === 1 ? "stay" : "stays"} in cart`;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Open cart (${label})`}
      className="fixed right-4 z-[60] flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background shadow-lg ring-1 ring-black/5 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] bottom-20 lg:bottom-6 lg:right-6"
    >
      <ShoppingBag className="h-4 w-4" strokeWidth={2} />
      <span>{label}</span>
      <span
        className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground"
        aria-hidden="true"
      >
        {count > 9 ? "9+" : count}
      </span>
    </button>
  );
}
