import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CartCheckoutForm } from "@/components/cart/cart-checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — Multi-Listing Cart",
  description:
    "Confirm your group booking. One payment, multiple stays — all confirmed at once.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart/checkout" },
};

export default function CartCheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to cart
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        Confirm your group booking
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        One charge covers every reservation. We&apos;ll confirm each one in
        sequence — you&apos;ll get a confirmation email per stay plus a single
        cart receipt.
      </p>
      <div className="mt-8">
        <CartCheckoutForm />
      </div>
    </div>
  );
}
