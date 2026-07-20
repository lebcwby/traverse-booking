"use client";

// Guesty Pay checkout — the flag-gated alternative to the Stripe <CheckoutForm>.
//
// Phase 2 of the Guesty Pay re-activation (docs/payments/guesty-pay-reactivation-plan.md).
// Self-contained on purpose: the live Stripe CheckoutForm (3000+ lines) is left
// completely untouched. The /book page renders THIS instead only when
// NEXT_PUBLIC_GUESTY_PAY_ENABLED === "true".
//
// Flow: fetch the listing's GuestyPay paymentProviderId → render the Guesty
// tokenization card field (<GuestyPayPayment>) → on submit it returns a Guesty
// ccToken → POST /api/reservations/guesty-instant (creates + charges via Guesty
// Pay, vaults the card) → confirmation page.
//
// ⚠️ Scope (Phase 2 increment 1): base booking only. Upsells / pet fees and 3DS
// `authURL` handling are follow-ups — see TODO(sandbox)/TODO(upsells) below and
// the plan doc. Card-only (no Apple/Google Pay — that's the known trade-off).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { trackClickBookNow } from "@/lib/tracking";
import { GuestyPayPayment } from "./guesty-pay-payment";
import {
  StripePayment,
  type ExpressCheckoutBillingDetails,
} from "./stripe-payment";
import type { QuoteData } from "./checkout-form";

// `withWallets` (hybrid mode) layers a Stripe Apple/Google Pay express zone on
// top of the GuestyPay card form: wallets → Stripe (GuestyPay tokenization is
// card-only), cards → GuestyPay. Base booking only on both rails, so the
// charged amount is identical regardless of payment method.
export function GuestyPayCheckout({
  quote,
  withWallets,
}: {
  quote: QuoteData;
  withWallets?: boolean;
}) {
  const router = useRouter();
  const [guest, setGuest] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitRef = useRef<(() => void) | null>(null);

  // Resolve the listing's GuestyPay payment provider for the tokenization render.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/listings/${quote.listingId}/payment-provider`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.paymentProviderId || data?._id) {
          setProviderId(data.paymentProviderId || data._id);
        } else {
          setProviderError("Payment is temporarily unavailable for this listing.");
        }
      })
      .catch(() => {
        if (!cancelled)
          setProviderError("Couldn't load the payment form. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [quote.listingId]);

  // Hybrid: a base-amount Stripe PaymentIntent that backs the Apple/Google Pay
  // express zone. upsellIds:[] / pets:0 → the PI equals the quote total, so a
  // wallet tap charges exactly what the GuestyPay card path would.
  const [walletClientSecret, setWalletClientSecret] = useState<string | null>(
    null
  );
  useEffect(() => {
    if (!withWallets) return;
    let cancelled = false;
    fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId: quote.quoteId, upsellIds: [], pets: 0 }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.clientSecret) setWalletClientSecret(d.clientSecret);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [withWallets, quote.quoteId]);

  // Apple/Google Pay tap → the existing Stripe reservation path (charge in
  // Traverse's Stripe, card vaulted in Stripe). The wallet supplies billing
  // details; fall back to any typed guest fields. Base booking only.
  async function handleWalletSuccess(
    piId: string,
    billing: ExpressCheckoutBillingDetails
  ) {
    setSubmitting(true);
    setError(null);
    const walletGuest = {
      firstName: billing.firstName || guest.firstName,
      lastName: billing.lastName || guest.lastName,
      email: billing.email || guest.email,
      phone: billing.phone || guest.phone,
    };
    const walletTracking = {
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      listingNickname: quote.listingNickname,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
      total: quote.pricing.total,
    };
    // CRITICAL: persist the recovery row BEFORE attempting the reservation.
    // The card is already charged by this point (the express element confirms
    // the PI before this callback), so if reservation finalization fails and no
    // pending_checkouts row exists, the charge orphans with no way to recover —
    // which is exactly what happened on the first hybrid test. With the row in
    // place, finalizer failures are marked `paid_pending_reservation` and the
    // recover-checkouts cron retries them (and last_error is captured for
    // diagnosis). Awaited so the row exists before the finalizer runs.
    await fetch("/api/pending-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: piId,
        quoteId: quote.quoteId,
        ratePlanId: quote.ratePlanId,
        guest: walletGuest,
        tracking: walletTracking,
        upsells: [],
        pets: 0,
      }),
    }).catch(() => {});
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId: piId,
          quoteId: quote.quoteId,
          ratePlanId: quote.ratePlanId,
          guest: walletGuest,
          upsells: [],
          pets: 0,
          tracking: {
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            listingNickname: quote.listingNickname,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            guests: quote.guests,
            total: quote.pricing.total,
          },
          marketingOptIn,
        }),
      });
      const data = await res.json();
      if (res.status === 202 && data.pendingRecovery) {
        setError(
          data.error ||
            "Your payment was received and your reservation is being finalized. Please don't retry."
        );
        setSubmitting(false);
        return;
      }
      if (!res.ok || !data.reservationId) {
        setError(
          data.error || "We couldn't complete your booking. Please try again."
        );
        setSubmitting(false);
        return;
      }
      router.push(`/book/confirmation/${data.reservationId}`);
    } catch {
      setError("Something went wrong completing your booking. Please try again.");
      setSubmitting(false);
    }
  }

  const guestValid =
    guest.firstName.trim() &&
    guest.lastName.trim() &&
    /.+@.+\..+/.test(guest.email) &&
    guest.phone.trim();

  function handleComplete() {
    setError(null);
    if (!guestValid) {
      setError("Please fill in your name, email, and phone.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the terms to continue.");
      return;
    }
    setSubmitting(true);
    trackClickBookNow({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      guests: quote.guests,
      value: quote.pricing.total,
    });
    // Triggers the Guesty tokenization → onPaymentMethod(ccToken) below.
    submitRef.current?.();
  }

  async function onPaymentMethod(ccToken: string) {
    try {
      const res = await fetch("/api/reservations/guesty-instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          ratePlanId: quote.ratePlanId,
          ccToken,
          guest,
          marketingOptIn,
          tracking: {
            listingId: quote.listingId,
            listingTitle: quote.listingTitle,
            listingNickname: quote.listingNickname,
            checkIn: quote.checkIn,
            checkOut: quote.checkOut,
            guests: quote.guests,
          },
        }),
      });
      const data = await res.json();
      // 3D Secure: the card needs authentication — send the guest to Guesty's
      // auth page; it redirects back to finalize. (TODO(sandbox): confirm the
      // return flow.)
      if (data.requiresAuth && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      if (!res.ok || !data.reservationId) {
        setError(data.error || "We couldn't complete your booking. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/book/confirmation/${data.reservationId}`);
    } catch {
      setError("Something went wrong completing your booking. Please try again.");
      setSubmitting(false);
    }
  }

  const p = quote.pricing;
  const field =
    "w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Left: guest details + payment */}
      <div className="space-y-6 lg:col-span-2">
        {/* Hybrid wallet zone — Apple/Google Pay via Stripe. Auto-hides on
            devices without a wallet, so desktop-no-wallet users just see the
            card form below. */}
        {withWallets && walletClientSecret && (
          <section>
            <StripePayment
              clientSecret={walletClientSecret}
              walletsOnly
              billingDetails={{
                firstName: guest.firstName,
                lastName: guest.lastName,
                email: guest.email,
                phone: guest.phone,
              }}
              onExpressPaymentSuccess={handleWalletSuccess}
              onPaymentSuccess={() => {}}
              onError={(msg) => {
                setError(msg);
                setSubmitting(false);
              }}
              loading={submitting}
              disabled={submitting}
            />
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or pay with card
                </span>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your details
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              className={field}
              placeholder="First name"
              value={guest.firstName}
              onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
            />
            <input
              className={field}
              placeholder="Last name"
              value={guest.lastName}
              onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
            />
            <input
              className={field}
              type="email"
              placeholder="Email"
              value={guest.email}
              onChange={(e) => setGuest({ ...guest, email: e.target.value })}
            />
            <input
              className={field}
              type="tel"
              placeholder="Phone"
              value={guest.phone}
              onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
            />
          </div>
        </section>

        {/* TODO(upsells): pet fee + add-ons aren't handled on the Guesty Pay
            rail yet — they'd be added as Guesty invoice items or folded into the
            quote. Base booking only for now. */}

        <section>
          {providerError ? (
            <p className="text-sm text-red-600">{providerError}</p>
          ) : !providerId ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secure payment…
            </div>
          ) : (
            <GuestyPayPayment
              listingId={quote.listingId}
              paymentProviderId={providerId}
              amount={p.total}
              quoteId={quote.quoteId}
              guestName={`${guest.firstName} ${guest.lastName}`.trim()}
              guestFirstName={guest.firstName}
              guestLastName={guest.lastName}
              guestEmail={guest.email}
              guestPhone={guest.phone}
              onPaymentMethod={onPaymentMethod}
              onError={(msg) => {
                setError(msg);
                setSubmitting(false);
              }}
              onCardReady={setCardReady}
              onSubmitRef={submitRef}
              loading={submitting}
              disabled={submitting}
              hideButton
            />
          )}
          {/* TODO(sandbox): 3D Secure — GuestyPayPayment.submit() doesn't send a
              threeDS object yet, so SCA-required cards won't authenticate. Wire
              the threeDS payload + authURL redirect after the sandbox test. */}
        </section>

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="underline text-foreground/70 hover:text-foreground"
            >
              booking terms
            </Link>{" "}
            and{" "}
            <Link
              href="/cancellation"
              target="_blank"
              className="underline text-foreground/70 hover:text-foreground"
            >
              cancellation policy
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5"
          />
          <span>Send me travel tips and special offers.</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="button"
          size="lg"
          onClick={handleComplete}
          disabled={submitting || !cardReady || !guestValid || !acceptedTerms}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            `Confirm and pay ${formatCurrency(p.total)}`
          )}
        </Button>
      </div>

      {/* Right: price summary */}
      <aside className="lg:col-span-1">
        <div className="rounded-xl border border-border p-5">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            {quote.listingTitle}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {quote.checkIn} → {quote.checkOut} · {quote.guests} guest
            {quote.guests === 1 ? "" : "s"} · {p.nights} night
            {p.nights === 1 ? "" : "s"}
          </p>
          <div className="space-y-1.5 text-sm">
            <Row label="Accommodation" value={p.accommodation} />
            {p.cleaning ? <Row label="Cleaning fee" value={p.cleaning} /> : null}
            {p.taxes ? <Row label="Taxes" value={p.taxes} /> : null}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(p.total)}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-[#2d7d46]">
            No booking fees — best rate, direct.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
