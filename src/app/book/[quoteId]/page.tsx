"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  CheckoutForm,
  type QuoteData,
} from "@/components/booking/checkout-form";
import { GuestyPayCheckout } from "@/components/booking/guesty-pay-checkout";

// Flag: route checkout through the Guesty Pay rail instead of Stripe. Off by
// default — when unset, the live Stripe CheckoutForm renders unchanged.
const GUESTY_PAY = process.env.NEXT_PUBLIC_GUESTY_PAY_ENABLED === "true";
import { Skeleton } from "@/components/ui/skeleton";
import { trackStartedCheckout, trackCheckoutError } from "@/lib/tracking";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.quoteId as string;
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Built from recovery params (lid/ci/co/g) the abandoned-cart email CTA
  // carries. Lets an expired-quote landing re-quote the exact listing+dates
  // in one click instead of dumping the guest on a generic property list.
  const [recoveryHref, setRecoveryHref] = useState<string | null>(null);
  // True once we've kicked off the auto-redirect back to the recovery dates,
  // so the render shows a "taking you back" state instead of the dead-end
  // "expired" interstitial.
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const lid = sp.get("lid");
      // Only treat lid as recovery context if it's a plausible listing id.
      // We redirect to `/properties/${lid}` programmatically below, so this
      // also guards against an open-redirect via a crafted lid.
      if (lid && /^[A-Za-z0-9_-]+$/.test(lid)) {
        const qs = new URLSearchParams();
        const ci = sp.get("ci");
        const co = sp.get("co");
        const g = sp.get("g");
        if (ci) qs.set("checkIn", ci);
        if (co) qs.set("checkOut", co);
        if (g) qs.set("guests", g);
        const query = qs.toString();
        setRecoveryHref(`/properties/${lid}${query ? `?${query}` : ""}`);
      }
    } catch {
      /* no recovery context — fall back to generic browse */
    }

    let data: QuoteData | null = null;

    const stored = sessionStorage.getItem(`quote_${quoteId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.pricing?.total) {
          data = parsed;
        }
      } catch {
        // Corrupted data, will try API fallback
      }
    }

    if (!data) {
      // Fallback: try to fetch the quote from the API
      fetch(`/api/quotes/${quoteId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((apiQuote) => {
          if (apiQuote) {
            sessionStorage.setItem(
              `quote_${quoteId}`,
              JSON.stringify(apiQuote)
            );
            setQuote(apiQuote);
          } else {
            const msg =
              "Your booking session has expired. Please go back to the property and select your dates again.";
            setError(msg);
            trackCheckoutError({
              step: "quote_load",
              errorMessage: "Quote not found via API fallback",
            });
          }
        })
        .catch(() => {
          const msg =
            "Your booking session has expired. Please go back to the property and select your dates again.";
          setError(msg);
          trackCheckoutError({
            step: "quote_load",
            errorMessage: "Quote API fetch failed",
          });
        });
      return;
    }

    setQuote(data);
  }, [quoteId]);

  // Expired quote + recovery context (lid/ci/co/g from the abandoned-cart
  // email) → skip the "expired, click again" interstitial and send the guest
  // straight back to their dates to re-quote. Removes a click from the
  // recovery path; the interstitial below remains as a no-JS / slow-nav
  // fallback.
  useEffect(() => {
    if (error && recoveryHref && !redirecting) {
      setRedirecting(true);
      router.replace(recoveryHref);
    }
  }, [error, recoveryHref, redirecting, router]);

  // Fetch listing detail (photos + per-listing pet config) once the quote
  // is loaded — runs whether the quote came from sessionStorage or the
  // /api/quotes fallback. Pet data fetched here drives the upsell picker.
  useEffect(() => {
    const listingId = quote?.listingId;
    if (!listingId) return;
    let cancelled = false;
    fetch(`/api/listings/${listingId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((listing) => {
        if (cancelled || !listing) return;
        const photos = (listing.pictures || [])
          .map(
            (p: {
              original?: string;
              thumbnail?: string;
              caption?: string;
            }) => ({
              original: p.original || p.thumbnail || "",
              thumbnail: p.thumbnail || p.original || "",
              caption: p.caption || "",
            })
          )
          .filter((p: { original: string }) => p.original);
        const petsAllowed =
          listing?.unitTypeHouseRules?.houseRules?.petsAllowed?.enabled ===
          true;
        const petFeePerPet =
          typeof listing?.prices?.petFee === "number"
            ? listing.prices.petFee
            : null;
        const listingNickname =
          typeof listing?.nickname === "string" ? listing.nickname : null;
        setQuote((prev) => {
          if (!prev) return prev;
          const updates: Partial<QuoteData> = {
            photos,
            petsAllowed,
            petFeePerPet,
            // Only overwrite if the API path didn't already set this from
            // the cached Supabase listing (quote-response's `listingNickname`).
            ...(!prev.listingNickname &&
              listingNickname && { listingNickname }),
          };
          if (!prev.picture && photos.length > 0) {
            updates.picture = photos[0].thumbnail;
          }
          return { ...prev, ...updates };
        });
      })
      .catch(() => {
        /* non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [quote?.listingId]);

  useEffect(() => {
    if (!quote) return;
    // Deduplicate per session+listing — persists across remounts/navigations
    const dedupeKey = `_sp_checkout_tracked_${quote.listingId}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
    trackStartedCheckout({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      listingNickname: quote.listingNickname,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
      total: quote.pricing.total,
      imageUrl: quote.picture || undefined,
      propertyType: quote.propertyType || undefined,
    });
  }, [quote]);

  // Expired quote WITH recovery context: we're auto-redirecting back to the
  // guest's dates. Show a brief "taking you back" state (not the dead-end
  // interstitial), and keep a manual link as a no-JS / slow-nav fallback.
  if (redirecting || (error && recoveryHref)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your saved quote expired — taking you right back to your dates to
          pick up where you left off…
        </p>
        {recoveryHref && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href={recoveryHref}
              className="inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Continue your booking
            </Link>
            <Link
              href="/properties"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Browse all properties
            </Link>
          </div>
        )}
      </div>
    );
  }

  // Expired quote with NO recovery context: generic message + browse.
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
        <p className="mt-4 text-sm text-muted-foreground">{error}</p>
        <Link
          href="/properties"
          className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Browse Properties
        </Link>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`footer { display: none !important; } header nav { display: none !important; }`}</style>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-12">
        <div className="mb-8 hidden items-center gap-4 md:flex">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            Confirm and pay
          </h1>
        </div>
        {GUESTY_PAY ? (
          <GuestyPayCheckout quote={quote} />
        ) : (
          <CheckoutForm quote={quote} />
        )}
      </div>
    </>
  );
}
