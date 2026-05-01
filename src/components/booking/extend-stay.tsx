"use client";

import { useState, useEffect } from "react";
import { format, parseISO, addDays, addMonths } from "date-fns";
import {
  CalendarPlus,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface ExtendStayProps {
  reservationId: string;
  listingId: string;
  currentCheckOut: string;
  onExtended: (newCheckOut: string) => void;
}

interface QuotePricing {
  currentTotal: number;
  newTotal: number;
  accommodation: number;
  taxes: number;
  total: number;
  currency: string;
}

interface QuoteResult {
  currentCheckOut: string;
  newCheckOut: string;
  pricing: QuotePricing;
}

type Step = "select-date" | "review" | "payment" | "success" | "error";

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ExtensionPaymentForm({
  onSuccess,
  onError,
  loading,
  amount,
}: {
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  loading: boolean;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements) return;
    setSubmitting(true);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (result.error) {
      onError(result.error.message || "Payment failed");
      setSubmitting(false);
    } else if (result.paymentIntent?.status === "succeeded") {
      onSuccess(result.paymentIntent.id);
    } else {
      onError("Payment requires additional verification. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleExpressConfirm(
    event: StripeExpressCheckoutElementConfirmEvent
  ) {
    if (!stripe || !elements) return;

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (result.error) {
      event.paymentFailed({ reason: "fail", message: result.error.message });
      onError(result.error.message || "Payment failed");
    } else if (result.paymentIntent?.status === "succeeded") {
      onSuccess(result.paymentIntent.id);
    }
  }

  return (
    <div className="space-y-4">
      {/* Express Checkout — Apple Pay, Google Pay */}
      <ExpressCheckoutElement
        options={{
          buttonType: { applePay: "plain", googlePay: "plain" },
          buttonHeight: 48,
          layout: { maxColumns: 2, maxRows: 1, overflow: "auto" },
        }}
        onConfirm={handleExpressConfirm}
        onClick={(event) => event.resolve()}
        onReady={(event) => {
          const methods = event.availablePaymentMethods;
          setExpressAvailable(
            !!methods && Object.values(methods).some(Boolean)
          );
        }}
      />

      {expressAvailable && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">
              Or pay with card
            </span>
          </div>
        </div>
      )}

      <PaymentElement
        options={{
          layout: {
            type: "accordion",
            defaultCollapsed: true,
            radios: false,
            spacedAccordionItems: true,
          },
        }}
        onChange={(e) => setReady(e.complete)}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || !ready || submitting || loading}
        className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting || loading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </span>
        ) : (
          `Confirm and Pay ${formatMoney(amount)}`
        )}
      </button>
    </div>
  );
}

export function ExtendStay({
  reservationId,
  listingId,
  currentCheckOut,
  onExtended,
}: ExtendStayProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select-date");
  const [extraNights, setExtraNights] = useState(1);
  const [maxNights, setMaxNights] = useState(0);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [originalCheckOut, setOriginalCheckOut] = useState<string | null>(null);
  const [actualAmount, setActualAmount] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCheckOut, setNewCheckOut] = useState<string | null>(null);

  // Normalize to YYYY-MM-DD — DB may store full ISO timestamps
  const normalizedCheckOut = currentCheckOut.slice(0, 10);

  const selectedDate = format(
    addDays(parseISO(normalizedCheckOut), extraNights),
    "yyyy-MM-dd"
  );

  // Load calendar when opened
  useEffect(() => {
    if (!open) return;
    setLoadingCalendar(true);
    setError(null);

    const from = normalizedCheckOut;
    const to = format(addMonths(parseISO(normalizedCheckOut), 2), "yyyy-MM-dd");

    fetch(`/api/listings/${listingId}/calendar?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then((data) => {
        let count = 0;
        for (const day of data) {
          if (day.date <= normalizedCheckOut) continue;
          if (day.status === "available") {
            count++;
          } else {
            break;
          }
        }
        setMaxNights(count);
        if (count === 0) setError("No dates available for extension.");
      })
      .catch(() => setError("Failed to load availability"))
      .finally(() => setLoadingCalendar(false));
  }, [open, normalizedCheckOut, listingId]);

  async function handleGetQuote() {
    setLoadingQuote(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "quote", newCheckOut: selectedDate }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get pricing");
      setQuote(data);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingQuote(false);
    }
  }

  async function handleCreatePaymentIntent() {
    if (!quote) return;
    setError(null);

    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "payment-intent",
            newCheckOut: selectedDate,
            expectedAmount: quote.pricing.total,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setClientSecret(data.clientSecret);
      setOriginalCheckOut(data.originalCheckOut);
      setActualAmount(data.amount);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleRollback() {
    if (!originalCheckOut) return;
    try {
      await fetch(`/api/account/reservations/${reservationId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          originalCheckOut,
        }),
      });
    } catch {
      // Best-effort rollback
    }
  }

  async function handlePaymentSuccess(piId: string) {
    setFinalizing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finalize",
            paymentIntentId: piId,
            newCheckOut: selectedDate,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        if (data.charged) {
          // Payment went through but Guesty update failed
          setError(
            "Your payment was processed but we couldn't update your reservation automatically. Our team has been notified and will complete the extension shortly."
          );
          setStep("error");
        } else {
          throw new Error(data.error || "Failed to finalize extension");
        }
        return;
      }

      setNewCheckOut(selectedDate);
      setStep("success");
      onExtended(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setFinalizing(false);
    }
  }

  function handleClose() {
    // If we're in the payment step with dates already updated on Guesty, roll back
    if ((step === "payment" || step === "review") && originalCheckOut) {
      handleRollback();
    }
    setOpen(false);
    setTimeout(() => {
      if (step !== "success") {
        setStep("select-date");
        setExtraNights(1);
        setQuote(null);
        setClientSecret(null);
        setOriginalCheckOut(null);
        setActualAmount(null);
        setError(null);
      }
    }, 300);
  }

  function handleBack() {
    setError(null);
    if (step === "review") {
      setStep("select-date");
    } else if (step === "payment") {
      // Dates were updated on Guesty at payment-intent step — rollback
      handleRollback();
      setOriginalCheckOut(null);
      setActualAmount(null);
      setClientSecret(null);
      setStep("review");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
      >
        <CalendarPlus className="h-4 w-4" />
        Extend Stay
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          {(step === "review" || step === "payment") && (
            <button
              onClick={handleBack}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-base font-semibold text-foreground">
            {step === "success"
              ? "Stay Extended!"
              : step === "error"
                ? "Extension Issue"
                : "Extend Your Stay"}
          </h3>
        </div>
        <button
          onClick={handleClose}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {step === "success" || step === "error" ? "Close" : "Cancel"}
        </button>
      </div>

      <div className="p-5">
        {error && step !== "error" && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Step 1: Select nights */}
        {step === "select-date" && (
          <div>
            {loadingCalendar ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : maxNights === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No dates available for extension. The property may have an
                upcoming reservation.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Current checkout:{" "}
                  <strong className="text-foreground">
                    {format(parseISO(normalizedCheckOut), "EEE, MMM d, yyyy")}
                  </strong>
                </p>

                {/* Night stepper */}
                <div className="mt-6 flex items-center justify-center gap-6">
                  <button
                    onClick={() => setExtraNights((n) => Math.max(1, n - 1))}
                    disabled={extraNights <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">
                      {extraNights}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {extraNights === 1 ? "night" : "nights"}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExtraNights((n) => Math.min(maxNights, n + 1))
                    }
                    disabled={extraNights >= maxNights}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-4 text-center text-sm text-muted-foreground">
                  New checkout:{" "}
                  <strong className="text-foreground">
                    {format(parseISO(selectedDate), "EEE, MMM d, yyyy")}
                  </strong>
                </p>

                {maxNights > 0 && (
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    Up to {maxNights} {maxNights === 1 ? "night" : "nights"}{" "}
                    available
                  </p>
                )}

                <button
                  onClick={handleGetQuote}
                  disabled={loadingQuote}
                  className="mt-6 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loadingQuote ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting price...
                    </span>
                  ) : (
                    "See Price"
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Review pricing */}
        {step === "review" && quote && (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                +{extraNights} {extraNights === 1 ? "night" : "nights"} &middot;{" "}
                {format(parseISO(normalizedCheckOut), "MMM d")} &rarr;{" "}
                {format(parseISO(quote.newCheckOut), "EEE, MMM d, yyyy")}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Additional accommodation ({extraNights}{" "}
                  {extraNights === 1 ? "night" : "nights"})
                </span>
                <span className="text-foreground">
                  {formatMoney(quote.pricing.accommodation)}
                </span>
              </div>
              {quote.pricing.taxes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Additional taxes
                  </span>
                  <span className="text-foreground">
                    {formatMoney(quote.pricing.taxes)}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2.5">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    Extension charge
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatMoney(quote.pricing.total)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 px-4 py-3 mt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current booking total</span>
                  <span>{formatMoney(quote.pricing.currentTotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-foreground mt-1">
                  <span>New booking total</span>
                  <span>{formatMoney(quote.pricing.newTotal)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreatePaymentIntent}
              className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === "payment" && clientSecret && (
          <div>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "flat",
                  variables: {
                    fontFamily:
                      "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                    colorPrimary: "#284847",
                    colorText: "#1c1c1c",
                    colorTextSecondary: "#4b5563",
                    colorDanger: "#dc2626",
                    colorBackground: "#ffffff",
                    borderRadius: "8px",
                    fontSizeBase: "16px",
                    fontWeightNormal: "400",
                    fontWeightMedium: "500",
                    fontWeightBold: "600",
                  },
                  rules: {
                    ".Input": {
                      fontFamily:
                        "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                      border: "1px solid #e5e7eb",
                      boxShadow: "none",
                      padding: "10px 12px",
                    },
                    ".Input:focus": {
                      borderColor: "#284847",
                      boxShadow: "0 0 0 1px #284847",
                    },
                    ".Label": {
                      fontFamily:
                        "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                      fontWeight: "500",
                      color: "#1c1c1c",
                    },
                    ".Tab": {
                      fontFamily:
                        "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                      border: "1px solid #e5e7eb",
                      boxShadow: "none",
                    },
                    ".Tab--selected": {
                      borderColor: "#284847",
                    },
                    ".AccordionItem": {
                      fontFamily:
                        "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                      border: "1px solid #e5e7eb",
                      boxShadow: "none",
                    },
                    ".Error": {
                      fontFamily:
                        "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
                    },
                  },
                },
                fonts: [
                  {
                    family: "Plus Jakarta Sans",
                    src: "url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TR_V.woff2)",
                    weight: "400",
                  },
                  {
                    family: "Plus Jakarta Sans",
                    src: "url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_KE79TR_V.woff2)",
                    weight: "500",
                  },
                  {
                    family: "Plus Jakarta Sans",
                    src: "url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_m0z9TR_V.woff2)",
                    weight: "600",
                  },
                  {
                    family: "Plus Jakarta Sans",
                    src: "url(https://fonts.gstatic.com/s/plusjakartasans/v8/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_gkz9TR_V.woff2)",
                    weight: "700",
                  },
                ],
              }}
            >
              <ExtensionPaymentForm
                onSuccess={handlePaymentSuccess}
                onError={(msg) => {
                  setError(msg);
                  // Don't rollback on payment error — guest can retry
                }}
                loading={finalizing}
                amount={actualAmount || quote?.pricing.total || 0}
              />
            </Elements>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="py-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <p className="mt-4 text-base font-semibold text-foreground">
              Your stay has been extended!
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              New checkout:{" "}
              <strong className="text-foreground">
                {newCheckOut &&
                  format(parseISO(newCheckOut), "EEE, MMM d, yyyy")}
              </strong>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Refresh the page to see updated payment details.
            </p>
          </div>
        )}

        {/* Step: Error (payment went through but Guesty failed) */}
        {step === "error" && (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <CalendarPlus className="h-6 w-6 text-amber-600" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">
              Payment received
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
