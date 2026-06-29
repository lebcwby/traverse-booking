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
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { trackClickBookNow } from "@/lib/tracking";
import { GuestyPayPayment } from "./guesty-pay-payment";
import type { QuoteData } from "./checkout-form";

export function GuestyPayCheckout({ quote }: { quote: QuoteData }) {
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
            I agree to the booking terms and cancellation policy.
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
