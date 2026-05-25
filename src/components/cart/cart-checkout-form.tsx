"use client";

// Multi-listing cart checkout form. Distilled from the single-listing
// checkout-form.tsx — reuses GuestForm + StripePayment (which gives us
// Apple/Google Pay via the Express Checkout element for free) but drops
// upsells, photo galleries, account creation, and the per-quote coupon
// flow (cart-level coupon below replaces it).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Tag, X } from "lucide-react";
import {
  GuestForm,
  type GuestInfo,
  isValidEmail,
} from "@/components/booking/guest-form";
import { StripePayment } from "@/components/booking/stripe-payment";
import { useCart } from "@/lib/cart/cart-store";
import { formatCurrency } from "@/lib/utils";
import { trackCartCheckoutStage } from "@/lib/tracking";

interface CartLineQuote {
  lineId: string;
  listingId: string;
  listingTitle: string;
  hostPayout: number;
}

interface CartPaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  cartId: string;
  stripeCustomerId: string | null;
  totalAmount: number;
  lines: CartLineQuote[];
}

interface CouponLineResult {
  lineId: string;
  ok: boolean;
  hostPayoutBefore?: number;
  hostPayoutAfter?: number;
  quoteId?: string;
  ratePlanId?: string;
  error?: string;
}

interface CouponResponse {
  coupon: string;
  appliedCount: number;
  totalLines: number;
  totalSavings: number;
  results: CouponLineResult[];
}

const initialGuest: GuestInfo = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

export function CartCheckoutForm() {
  const router = useRouter();
  const { items, hydrated, clearCart } = useCart();

  const [guest, setGuest] = useState<GuestInfo>(initialGuest);
  const [marketingOptIn, setMarketingOptIn] = useState(true);

  // Server-side cart PI state.
  const [pi, setPi] = useState<CartPaymentIntentResponse | null>(null);
  const [piError, setPiError] = useState<string | null>(null);
  const [piLoading, setPiLoading] = useState(true);
  const [piVersion, setPiVersion] = useState(0);

  // Coupon state.
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [coupon, setCoupon] = useState<CouponResponse | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Reservation flow state.
  const [reserving, setReserving] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  // Funnel-event dedup refs — each cart mount fires begin_checkout /
  // add_shipping_info / add_payment_info at most once, regardless of
  // re-renders or coupon-driven PI recreation.
  const hasFiredBeginCheckoutRef = useRef(false);
  const hasFiredAddShippingRef = useRef(false);
  const hasFiredAddPaymentRef = useRef(false);

  // Derived: only quoted, valid lines (the cart page already filters out
  // unpriced lines before linking here, but defense in depth).
  const lines = useMemo(
    () => items.map((i) => ({ lineId: i.lineId, listingId: i.listingId })),
    [items]
  );

  // 1. Create the combined PI on mount (and any time the cart contents change).
  useEffect(() => {
    if (!hydrated) return;
    if (items.length === 0) {
      router.replace("/cart");
      return;
    }
    let cancelled = false;
    setPiLoading(true);
    setPiError(null);
    (async () => {
      try {
        // We re-quote each line server-side via /api/quotes/batch first, so we
        // collect the active quoteIds before creating the PI. Cart-store items
        // don't carry a quoteId snapshot — they only hold dates/guests.
        const batch = await fetch("/api/quotes/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: items.map((it) => ({
              lineId: it.lineId,
              listingId: it.listingId,
              checkIn: it.checkIn,
              checkOut: it.checkOut,
              guestsCount: it.guests,
            })),
          }),
        });
        if (!batch.ok) {
          throw new Error(`Couldn't price your group booking (${batch.status})`);
        }
        const batchData = (await batch.json()) as {
          results: { lineId: string; ok: boolean; quote?: { quoteId: string } }[];
        };
        const failed = batchData.results.filter((r) => !r.ok);
        if (failed.length > 0) {
          throw new Error(
            `${failed.length} listing${failed.length === 1 ? "" : "s"} could not be priced. Return to the cart and remove or update them.`
          );
        }
        const piPayload = items.map((it) => {
          const result = batchData.results.find((r) => r.lineId === it.lineId);
          return {
            lineId: it.lineId,
            quoteId: result?.quote?.quoteId || "",
            pets: it.pets,
          };
        });

        const r = await fetch("/api/cart/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: piPayload }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Couldn't initialize checkout.");
        }
        const data = (await r.json()) as CartPaymentIntentResponse;
        if (cancelled) return;
        setPi(data);
        setPiVersion((v) => v + 1);
        // Fire `begin_checkout` exactly once per cart-mount — only on first
        // successful PI creation. Coupon recreates the PI but we don't want
        // to double-count the funnel event.
        if (!hasFiredBeginCheckoutRef.current) {
          hasFiredBeginCheckoutRef.current = true;
          trackCartCheckoutStage("begin_checkout", {
            cartId: data.cartId,
            paymentIntentId: data.paymentIntentId,
            lines: data.lines.map((l) => ({
              listingId: l.listingId,
              listingTitle: l.listingTitle,
              hostPayout: l.hostPayout,
            })),
            total: data.totalAmount,
          });
        }
      } catch (e) {
        if (cancelled) return;
        setPiError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setPiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally re-create the PI when the lineIds change (not on every
    // item field change) since /api/cart/payment-intent is idempotent on the
    // sorted quoteIds + email anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.map((i) => i.lineId).join(","), router]);

  // 2. PATCH the PI with guest details on email blur. Also fires the
  //    `add_shipping_info` funnel event the first time the email is valid.
  const onEmailBlur = useCallback(async () => {
    if (!pi || !isValidEmail(guest.email)) return;
    try {
      await fetch("/api/cart/payment-intent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: pi.paymentIntentId,
          guest,
          marketingOptIn,
        }),
      });
      if (!hasFiredAddShippingRef.current) {
        hasFiredAddShippingRef.current = true;
        trackCartCheckoutStage("add_shipping_info", {
          cartId: pi.cartId,
          paymentIntentId: pi.paymentIntentId,
          lines: pi.lines.map((l) => ({
            listingId: l.listingId,
            listingTitle: l.listingTitle,
            hostPayout: l.hostPayout,
          })),
          total: pi.totalAmount,
        });
      }
    } catch (e) {
      console.error("[CartCheckout] PATCH failed:", e);
    }
  }, [pi, guest, marketingOptIn]);

  // 3. Apply coupon — calls /api/cart/quotes/coupons. On success, recreate PI
  //    so the combined total reflects the new line totals.
  const applyCoupon = useCallback(async () => {
    if (!pi || !couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const linePayload = items.map((it) => {
        const piLine = pi.lines.find((l) => l.lineId === it.lineId);
        return {
          lineId: it.lineId,
          // We need the quoteId — not in pi.lines; fall back via batch quote.
          quoteId: piLine ? piLine.lineId : it.lineId,
        };
      });
      // The batch quote we ran on mount already returned quoteIds, but we
      // didn't persist them into pi.lines. Re-batch is the simplest path —
      // it's idempotent and fast.
      const batch = await fetch("/api/quotes/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: items.map((it) => ({
            lineId: it.lineId,
            listingId: it.listingId,
            checkIn: it.checkIn,
            checkOut: it.checkOut,
            guestsCount: it.guests,
          })),
        }),
      });
      const batchData = (await batch.json()) as {
        results: { lineId: string; ok: boolean; quote?: { quoteId: string } }[];
      };
      for (const lp of linePayload) {
        const r = batchData.results.find((rr) => rr.lineId === lp.lineId);
        if (r?.quote?.quoteId) lp.quoteId = r.quote.quoteId;
      }

      const r = await fetch("/api/cart/quotes/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupon: couponInput.trim(),
          lines: linePayload,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Couldn't apply that coupon.");
      }
      const data = (await r.json()) as CouponResponse;
      if (data.appliedCount === 0) {
        setCouponError(
          "This coupon doesn't apply to any of the listings in your cart."
        );
        setCoupon(null);
      } else {
        setCoupon(data);
        // Re-create the PI with the new totals.
        const newPiPayload = items.map((it) => {
          const couponLine = data.results.find(
            (l) => l.lineId === it.lineId && l.ok
          );
          const batchLine = batchData.results.find(
            (rr) => rr.lineId === it.lineId
          );
          return {
            lineId: it.lineId,
            quoteId: couponLine?.quoteId || batchLine?.quote?.quoteId || "",
            pets: it.pets,
          };
        });
        const piRes = await fetch("/api/cart/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: newPiPayload, guest }),
        });
        const piData =
          (await piRes.json()) as CartPaymentIntentResponse | { error: string };
        if ("error" in piData) {
          throw new Error(piData.error);
        }
        setPi(piData);
        setPiVersion((v) => v + 1);
      }
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : String(e));
    } finally {
      setCouponLoading(false);
    }
  }, [pi, couponInput, items, guest]);

  // 4. After Stripe confirms the combined PI, finalize via the coordinator.
  const handlePaymentSuccess = useCallback(
    async (paymentIntentId: string) => {
      setReserving(true);
      setReservationError(null);
      try {
        // Make sure latest guest fields are persisted before the coordinator
        // pulls from the durable row.
        await fetch("/api/cart/payment-intent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            guest,
            marketingOptIn,
          }),
        });

        const r = await fetch("/api/cart/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });
        const data = await r.json();
        if (!r.ok && r.status !== 202) {
          throw new Error(data.error || "Cart reservation failed.");
        }
        const cartId = data.cartId as string;
        if (cartId) {
          // Clear local cart on terminal success/partial — the user has been
          // billed, the reservations exist, no value in keeping the local
          // state. The confirmation page loads from server state.
          if (data.status === "success" || data.status === "partial") {
            clearCart();
          }
          router.push(`/cart/confirmation/${cartId}`);
        } else {
          throw new Error("No cart confirmation id returned.");
        }
      } catch (e) {
        setReservationError(e instanceof Error ? e.message : String(e));
      } finally {
        setReserving(false);
      }
    },
    [guest, marketingOptIn, router, clearCart]
  );

  // ── Render ──────────────────────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (piError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Couldn&apos;t start your checkout
            </p>
            <p className="mt-1 text-sm text-red-700">{piError}</p>
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="mt-3 inline-flex items-center rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
            >
              Back to cart
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (piLoading || !pi) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        <p className="text-sm text-neutral-500">
          Pricing your group booking…
        </p>
      </div>
    );
  }

  const total = pi.totalAmount;
  const guestValid =
    guest.firstName.trim().length > 0 &&
    guest.lastName.trim().length > 0 &&
    isValidEmail(guest.email) &&
    guest.phone.trim().length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      {/* Left: form */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">
            Guest details
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            We use this for all {pi.lines.length} reservation
            {pi.lines.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-4">
            <GuestForm
              guest={guest}
              onChange={setGuest}
              onEmailBlur={onEmailBlur}
            />
          </div>
          <label className="mt-4 flex items-start gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300"
            />
            <span>
              Send me Colorado travel tips and seasonal deals from Traverse.
              No spam, unsubscribe any time.
            </span>
          </label>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Payment</h2>
          {reservationError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reservationError}</span>
            </div>
          )}
          <div className="mt-4">
            <StripePayment
              clientSecret={pi.clientSecret}
              billingDetails={{
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email,
                phone: guest.phone,
              }}
              onPaymentSuccess={handlePaymentSuccess}
              onError={setReservationError}
              loading={reserving}
              disabled={!guestValid || reserving}
              piVersion={piVersion}
              onCardReady={(complete) => {
                if (complete && !hasFiredAddPaymentRef.current) {
                  hasFiredAddPaymentRef.current = true;
                  trackCartCheckoutStage("add_payment_info", {
                    cartId: pi.cartId,
                    paymentIntentId: pi.paymentIntentId,
                    lines: pi.lines.map((l) => ({
                      listingId: l.listingId,
                      listingTitle: l.listingTitle,
                      hostPayout: l.hostPayout,
                    })),
                    total: pi.totalAmount,
                  });
                }
              }}
            />
          </div>
          {reserving && (
            <p className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirming your {pi.lines.length} reservation
              {pi.lines.length === 1 ? "" : "s"}…
            </p>
          )}
        </section>
      </div>

      {/* Right: summary */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">
            Your group booking
          </h2>
          <ul className="mt-4 divide-y divide-neutral-100">
            {pi.lines.map((line) => {
              const item = items.find((i) => i.lineId === line.lineId);
              return (
                <li key={line.lineId} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {item?.listingPicture ? (
                    <Image
                      src={item.listingPicture}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-neutral-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {line.listingTitle}
                    </p>
                    {item && (
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {item.checkIn} → {item.checkOut} · {item.guests} guest
                        {item.guests === 1 ? "" : "s"}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-medium text-neutral-700">
                      {formatCurrency(line.hostPayout, { cents: true })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Coupon row */}
          <div className="mt-4 border-t border-neutral-200 pt-4">
            {!coupon ? (
              <>
                <label className="text-xs font-medium text-neutral-600">
                  Have a coupon?
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                    disabled={couponLoading}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={!couponInput.trim() || couponLoading}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-neutral-300"
                  >
                    {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </button>
                </div>
                {couponError && (
                  <p className="mt-2 text-xs text-red-700">{couponError}</p>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div className="text-xs">
                      <p className="font-semibold text-emerald-900">
                        <Tag className="mr-1 inline h-3 w-3" />
                        {coupon.coupon}
                      </p>
                      <p className="mt-0.5 text-emerald-800">
                        {formatCurrency(coupon.totalSavings, { cents: true })}{" "}
                        off applied to {coupon.appliedCount} of{" "}
                        {coupon.totalLines} stays
                      </p>
                      {coupon.appliedCount < coupon.totalLines && (
                        <p className="mt-1 text-emerald-700/80">
                          (some listings don&apos;t qualify)
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCouponInput("");
                    }}
                    aria-label="Remove coupon"
                    className="text-emerald-700 hover:text-emerald-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4">
            <span className="text-base font-semibold text-neutral-900">Total</span>
            <span className="text-lg font-bold text-neutral-900">
              {formatCurrency(total, { cents: true })}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            One charge for all {pi.lines.length} reservations. Free
            cancellation up to 14 days before each check-in.
          </p>
        </div>
      </aside>
    </div>
  );
}
