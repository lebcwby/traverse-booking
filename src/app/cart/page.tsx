"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bed,
  Calendar,
  Loader2,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart/cart-store";
import { getListingSlug, formatCurrency } from "@/lib/utils";

// Phase 1 scope: render the cart contents, fetch live batch quotes from
// /api/quotes/batch, show per-line + aggregated totals, and stub out the
// checkout CTA. Phase 2 will wire /cart/checkout for the real multi-listing
// payment + reservation flow.

interface BatchQuoteSummary {
  quoteId: string;
  hostPayout: number;
  fareAccommodation: number;
  fareCleaning: number;
  totalTaxes: number;
  currency: string;
  nights: number;
}

interface BatchQuoteLineResult {
  lineId: string;
  ok: boolean;
  quote?: BatchQuoteSummary;
  error?: string;
}

interface BatchQuoteResponse {
  results: BatchQuoteLineResult[];
  totals: {
    hostPayout: number;
    fareAccommodation: number;
    fareCleaning: number;
    totalTaxes: number;
    nights: number;
    currency: string;
    successCount: number;
    failureCount: number;
  };
}

export default function CartPage() {
  const { items, removeItem, hydrated, clearCart } = useCart();
  const [quoteData, setQuoteData] = useState<BatchQuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Stable key so we re-fetch only when the cart's quotable inputs change
  // (not on cosmetic re-renders).
  const quoteKey = useMemo(
    () =>
      items
        .map((i) => `${i.listingId}:${i.checkIn}:${i.checkOut}:${i.guests}`)
        .sort()
        .join("|"),
    [items]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      setQuoteData(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch("/api/quotes/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: items.map((i) => ({
              lineId: i.lineId,
              listingId: i.listingId,
              checkIn: i.checkIn,
              checkOut: i.checkOut,
              guestsCount: i.guests,
            })),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Batch quote ${res.status}`);
        }
        const data = (await res.json()) as BatchQuoteResponse;
        if (!cancelled) setQuoteData(data);
      } catch (err) {
        if (!cancelled) {
          setQuoteError(
            err instanceof Error ? err.message : "Could not load combined total"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [quoteKey, hydrated, items]);

  // Pre-hydration skeleton — keeps SSR from rendering "0 items" while
  // localStorage is still being read.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <div className="h-6 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-8 h-32 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-16">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Group Booking
          </p>
          <h1 className="mt-1 text-3xl font-bold text-neutral-900 sm:text-4xl">
            Your cart
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {items.length === 0
              ? "Add listings from any property page to build a multi-stay group booking."
              : `${items.length} listing${items.length === 1 ? "" : "s"} ready to book together.`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Empty your cart? This can't be undone.")) clearCart();
            }}
            className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Clear cart
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Line items */}
          <ul className="flex flex-col gap-4">
            {items.map((item) => {
              const result = quoteData?.results.find(
                (r) => r.lineId === item.lineId
              );
              return (
                <li key={item.lineId}>
                  <CartLineCard
                    item={item}
                    result={result}
                    loading={loading && !result}
                    onRemove={() => removeItem(item.lineId)}
                  />
                </li>
              );
            })}
          </ul>

          {/* Sticky summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SummaryCard
              quoteData={quoteData}
              quoteError={quoteError}
              loading={loading}
              itemCount={items.length}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center gap-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">
        <ShoppingBag className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Your group-booking cart is empty
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
          Browse properties, pick dates, and tap{" "}
          <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-700 shadow-sm">
            Add to group booking
          </span>{" "}
          to collect multiple listings — then book them all in a single
          checkout.
        </p>
      </div>
      <Link
        href="/properties"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        Browse properties
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function CartLineCard({
  item,
  result,
  loading,
  onRemove,
}: {
  item: CartItem;
  result: BatchQuoteLineResult | undefined;
  loading: boolean;
  onRemove: () => void;
}) {
  const slug = getListingSlug(item.listingTitle || item.listingNickname, item.listingId);
  const detailHref = `/properties/${slug}?checkIn=${item.checkIn}&checkOut=${item.checkOut}&guests=${item.guests}`;

  const nights = nightsBetween(item.checkIn, item.checkOut);
  const lineTotal = result?.quote?.hostPayout ?? null;
  const errored = result?.ok === false;

  // Prefer the stable `code` returned by /api/quotes/batch (see
  // src/lib/beapi-error.ts) so the cart UI doesn't substring-sniff raw
  // BEAPI text. Substring fallbacks remain only to cover deploys that
  // haven't shipped the classified-error contract yet.
  const friendlyError = useMemo(() => {
    if (!errored) return null;
    const code = (result as { code?: string } | null)?.code ?? "";
    const msg = result?.error ?? "";
    if (
      code === "DATES_UNAVAILABLE" ||
      /LISTING_IS_NOT_AVAILABLE|not applicable/i.test(msg)
    ) {
      return "These dates are no longer available for this listing.";
    }
    if (
      code === "INVALID_DATES" ||
      /checkInDateLocalized|checkOutDateLocalized/i.test(msg)
    ) {
      return "These dates aren't valid — try a different range.";
    }
    if (
      code === "INVALID_REQUEST" ||
      /WRONG_REQUEST_PARAMETERS/i.test(msg)
    ) {
      return "Something went wrong with this listing — please try different dates.";
    }
    // For any other classified code, the server-rendered message is already
    // sanitized — surface it directly. Falls back to a generic line if the
    // server returned nothing.
    return (
      msg || "Couldn't price this listing. Try refreshing or adjusting dates."
    );
  }, [errored, result]);

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row">
      {item.listingPicture ? (
        <Link
          href={detailHref}
          className="block h-32 w-full shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-32 sm:w-44"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.listingPicture}
            alt={item.listingTitle}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </Link>
      ) : (
        <div className="h-32 w-full shrink-0 rounded-xl bg-neutral-100 sm:h-32 sm:w-44" />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="line-clamp-2 text-base font-semibold leading-tight text-neutral-900 hover:underline"
            >
              {item.listingTitle}
            </Link>
            {item.city && (
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
                {item.city}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.listingTitle} from cart`}
            className="rounded-full p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-neutral-600">
          <li className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            {formatShortDate(item.checkIn)}–{formatShortDate(item.checkOut)} ·{" "}
            {nights} night{nights === 1 ? "" : "s"}
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            {item.guests} guest{item.guests === 1 ? "" : "s"}
          </li>
          {item.bedrooms != null && (
            <li className="flex items-center gap-1.5">
              <Bed className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              {item.bedrooms === 0 ? "Studio" : `${item.bedrooms} bd`}
            </li>
          )}
        </ul>

        <div className="mt-auto pt-3">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading live price…
            </p>
          ) : errored ? (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {friendlyError}
            </p>
          ) : lineTotal != null ? (
            <p className="text-sm">
              <span className="font-semibold text-neutral-900">
                {formatCurrency(lineTotal, { cents: true })}
              </span>
              <span className="text-neutral-500"> · taxes &amp; fees included</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SummaryCard({
  quoteData,
  quoteError,
  loading,
  itemCount,
}: {
  quoteData: BatchQuoteResponse | null;
  quoteError: string | null;
  loading: boolean;
  itemCount: number;
}) {
  const totals = quoteData?.totals;
  const failed = totals?.failureCount ?? 0;
  const success = totals?.successCount ?? 0;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">Combined total</h2>
      <p className="mt-1 text-xs text-neutral-500">
        {itemCount} listing{itemCount === 1 ? "" : "s"} ·{" "}
        {totals?.nights ?? 0} night{totals?.nights === 1 ? "" : "s"} total
      </p>

      <div className="mt-4 space-y-2 text-sm">
        {loading && !totals ? (
          <p className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pricing your group booking…
          </p>
        ) : totals ? (
          <>
            <div className="flex justify-between text-neutral-600">
              <span>Accommodation</span>
              <span>{formatCurrency(totals.fareAccommodation, { cents: true })}</span>
            </div>
            {totals.fareCleaning > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Cleaning</span>
                <span>{formatCurrency(totals.fareCleaning, { cents: true })}</span>
              </div>
            )}
            {totals.totalTaxes > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Taxes &amp; fees</span>
                <span>{formatCurrency(totals.totalTaxes, { cents: true })}</span>
              </div>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-3">
              <span className="text-base font-semibold text-neutral-900">Total</span>
              <span className="text-lg font-bold text-neutral-900">
                {formatCurrency(totals.hostPayout, { cents: true })}
              </span>
            </div>
            {failed > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {failed} listing{failed === 1 ? "" : "s"} couldn&apos;t be
                priced — fix or remove {failed === 1 ? "it" : "them"} to enable
                checkout.
              </p>
            )}
          </>
        ) : quoteError ? (
          <p className="text-sm text-red-700">
            {quoteError} — refresh the page to retry.
          </p>
        ) : null}
      </div>

      {/* Checkout enabled when every line has a clean quote. Routes to
          /cart/checkout which reads the cart from useCart() context. */}
      {failed === 0 && success > 0 ? (
        <Link
          href="/cart/checkout"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Proceed to Checkout
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title={
            failed > 0
              ? "Resolve unpriced listings first."
              : "Pricing your group booking…"
          }
          className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-primary/40 px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Proceed to Checkout
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      {success > 0 && (
        <p className="mt-4 text-[11px] text-neutral-400">
          Pricing locked at quote time — confirmed at checkout.
        </p>
      )}
    </div>
  );
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00Z`).getTime();
  const b = new Date(`${checkOut}T12:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function formatShortDate(iso: string): string {
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
