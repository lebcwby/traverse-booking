"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO, addDays, addMonths } from "date-fns";
import {
  CalendarDays,
  Loader2,
  CheckCircle,
  ChevronLeft,
  AlertTriangle,
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
import { Calendar } from "@/components/ui/calendar";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface ChangeDatesProps {
  reservationId: string;
  listingId: string;
  currentCheckIn: string;
  currentCheckOut: string;
  onChanged: (newCheckIn: string, newCheckOut: string) => void;
}

interface QuoteResult {
  newCheckIn: string;
  newCheckOut: string;
  originalCheckIn: string;
  originalCheckOut: string;
  window: string;
  action: "charge" | "refund" | "no-refund" | "no-change";
  pricing: {
    currentTotal: number;
    newTotal: number;
    delta: number;
    deltaDirection: "charge" | "refund" | "none";
    accommodation: number;
    taxes: number;
    currency: string;
  };
}

type Step = "calendar" | "review" | "payment" | "success" | "error";

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Payment Form ─────────────────────────────────────────────────

function PaymentForm({
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
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (result.error) {
      onError(result.error.message || "Payment failed");
      setSubmitting(false);
    } else if (result.paymentIntent?.status === "succeeded") {
      onSuccess(result.paymentIntent.id);
    } else {
      onError("Payment requires additional verification.");
      setSubmitting(false);
    }
  }

  async function handleExpressConfirm(
    event: StripeExpressCheckoutElementConfirmEvent
  ) {
    if (!stripe || !elements) return;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
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
          fields: {
            billingDetails: {
              email: "never",
            },
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

// ─── Main Component ───────────────────────────────────────────────

export function ChangeDates({
  reservationId,
  listingId,
  currentCheckIn: rawCheckIn,
  currentCheckOut: rawCheckOut,
  onChanged,
}: ChangeDatesProps) {
  const currentCheckIn = rawCheckIn.slice(0, 10);
  const currentCheckOut = rawCheckOut.slice(0, 10);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("calendar");
  const [info, setInfo] = useState<{
    window: string;
    canChangeCheckIn: boolean;
    canChangeCheckOut: boolean;
  } | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [selectedCheckIn, setSelectedCheckIn] = useState<Date | undefined>(
    parseISO(currentCheckIn)
  );
  const [selectedCheckOut, setSelectedCheckOut] = useState<Date | undefined>(
    parseISO(currentCheckOut)
  );
  // Localized dates from Guesty (set after info fetch)
  const [resolvedCheckIn, setResolvedCheckIn] = useState(currentCheckIn);
  const [resolvedCheckOut, setResolvedCheckOut] = useState(currentCheckOut);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newCheckIn = selectedCheckIn
    ? format(selectedCheckIn, "yyyy-MM-dd")
    : resolvedCheckIn;
  const newCheckOut = selectedCheckOut
    ? format(selectedCheckOut, "yyyy-MM-dd")
    : resolvedCheckOut;

  const datesChanged =
    newCheckIn !== resolvedCheckIn || newCheckOut !== resolvedCheckOut;

  // Load info + calendar when opened
  useEffect(() => {
    if (!open) return;
    setLoadingCalendar(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Get change window info
        const infoRes = await fetch(
          `/api/account/reservations/${reservationId}/extend`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "info" }),
          }
        );
        const infoData = await infoRes.json();
        if (infoRes.ok) {
          setInfo(infoData);
          if (infoData.currentCheckIn) {
            setResolvedCheckIn(infoData.currentCheckIn);
            setSelectedCheckIn(parseISO(infoData.currentCheckIn));
          }
          if (infoData.currentCheckOut) {
            setResolvedCheckOut(infoData.currentCheckOut);
            setSelectedCheckOut(parseISO(infoData.currentCheckOut));
          }
        }

        // Use localized dates from info for calendar range
        const ciForCal = infoData?.currentCheckIn || currentCheckIn;
        const coForCal = infoData?.currentCheckOut || currentCheckOut;

        // Get calendar availability (3 months)
        const from = format(addMonths(parseISO(ciForCal), -1), "yyyy-MM-dd");
        const to = format(addMonths(parseISO(coForCal), 3), "yyyy-MM-dd");
        const calRes = await fetch(
          `/api/listings/${listingId}/calendar?from=${from}&to=${to}`
        );
        const calData = await calRes.json();

        const available = new Set<string>();
        for (const day of calData) {
          if (day.status === "available") {
            available.add(day.date);
          }
        }
        // Force-add ALL dates within the current reservation as available,
        // since the BEAPI marks our own reservation dates as "booked".
        // Use Guesty's localized dates (not UTC-sliced DB timestamps).
        const ciDate = parseISO(infoData?.currentCheckIn || currentCheckIn);
        const coDate = parseISO(infoData?.currentCheckOut || currentCheckOut);
        for (
          let d = new Date(ciDate);
          d <= coDate;
          d.setDate(d.getDate() + 1)
        ) {
          available.add(format(d, "yyyy-MM-dd"));
        }
        setAvailableDates(available);
      } catch {
        setError("Failed to load availability");
      } finally {
        setLoadingCalendar(false);
      }
    };

    fetchData();
  }, [open, currentCheckIn, currentCheckOut, listingId, reservationId]);

  const isDateDisabled = useCallback(
    (date: Date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");
      // Past dates (before today) are always disabled
      if (dateStr < today) return true;
      // Must be in the available set (includes our own reservation dates)
      return !availableDates.has(dateStr);
    },
    [availableDates]
  );

  async function handleGetQuote() {
    if (!datesChanged) return;
    setLoadingQuote(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "quote",
            newCheckIn: info?.canChangeCheckIn ? newCheckIn : undefined,
            newCheckOut,
          }),
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
            expectedAmount: quote.pricing.delta,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setClientSecret(data.clientSecret);
      setActualAmount(data.amount);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handlePaymentSuccess(piId: string) {
    if (!quote) return;
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
            newCheckIn: quote.newCheckIn,
            newCheckOut: quote.newCheckOut,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.charged) {
          setError(
            "Payment processed but date update failed. Our team has been notified."
          );
          setStep("error");
          return;
        }
        throw new Error(data.error || "Failed to finalize");
      }
      setStep("success");
      onChanged(quote.newCheckIn, quote.newCheckOut);
      // Scroll to the success state and reload after a moment
      // to refresh payment details with updated financials
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleConfirmNoCharge() {
    if (!quote) return;
    setFinalizing(true);
    setError(null);
    try {
      const action =
        quote.action === "refund" ? "finalize-refund" : "finalize-no-charge";
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            newCheckIn: quote.newCheckIn,
            newCheckOut: quote.newCheckOut,
            refundAmount:
              quote.action === "refund" ? quote.pricing.delta : undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update dates");
      setStep("success");
      onChanged(quote.newCheckIn, quote.newCheckOut);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleRollback() {
    if (!quote) return;
    try {
      await fetch(`/api/account/reservations/${reservationId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          originalCheckIn: quote.originalCheckIn,
          originalCheckOut: quote.originalCheckOut,
        }),
      });
    } catch {
      // Best-effort
    }
  }

  function handleClose() {
    if (quote && step !== "success") handleRollback();
    setOpen(false);
    setTimeout(() => {
      if (step !== "success") {
        setStep("calendar");
        setSelectedCheckIn(parseISO(resolvedCheckIn));
        setSelectedCheckOut(parseISO(resolvedCheckOut));
        setQuote(null);
        setClientSecret(null);
        setError(null);
      }
    }, 300);
  }

  function handleBack() {
    setError(null);
    if (step === "review") {
      handleRollback();
      setQuote(null);
      setStep("calendar");
    } else if (step === "payment") {
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
        <CalendarDays className="h-4 w-4" />
        Change Dates
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
              ? "Dates Updated!"
              : step === "error"
                ? "Issue"
                : "Change Dates"}
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

        {/* Step 1: Calendar */}
        {step === "calendar" && (
          <div>
            {loadingCalendar ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {info?.canChangeCheckIn ? (
                  <p className="mb-4 text-sm text-muted-foreground">
                    Select new check-in and check-out dates:
                  </p>
                ) : (
                  <>
                    <p className="mb-1 text-sm text-muted-foreground">
                      Check-in:{" "}
                      <strong className="text-foreground">
                        {format(parseISO(resolvedCheckIn), "EEE, MMM d, yyyy")}
                      </strong>{" "}
                      (fixed during stay)
                    </p>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Select a new checkout date:
                    </p>
                  </>
                )}

                <div className="flex justify-center">
                  {info?.canChangeCheckIn ? (
                    <Calendar
                      mode="range"
                      selected={
                        selectedCheckIn && selectedCheckOut
                          ? { from: selectedCheckIn, to: selectedCheckOut }
                          : undefined
                      }
                      onSelect={(range) => {
                        if (range?.from) setSelectedCheckIn(range.from);
                        if (range?.to) setSelectedCheckOut(range.to);
                      }}
                      numberOfMonths={2}
                      disabled={isDateDisabled}
                      defaultMonth={parseISO(resolvedCheckIn)}
                      fromDate={new Date()}
                      toDate={addMonths(parseISO(resolvedCheckOut), 3)}
                    />
                  ) : (
                    <Calendar
                      mode="single"
                      selected={selectedCheckOut}
                      onSelect={(date) => {
                        if (date) setSelectedCheckOut(date);
                      }}
                      numberOfMonths={2}
                      disabled={isDateDisabled}
                      defaultMonth={parseISO(resolvedCheckIn)}
                      fromDate={addDays(parseISO(resolvedCheckIn), 1)}
                      toDate={addMonths(parseISO(resolvedCheckOut), 3)}
                    />
                  )}
                </div>

                {selectedCheckIn && selectedCheckOut && (
                  <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-center">
                    <p className="text-sm text-muted-foreground">
                      {format(selectedCheckIn, "EEE, MMM d")} &rarr;{" "}
                      <strong className="text-foreground">
                        {format(selectedCheckOut, "EEE, MMM d, yyyy")}
                      </strong>
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGetQuote}
                  disabled={!datesChanged || loadingQuote || !selectedCheckOut}
                  className="mt-4 w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loadingQuote ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking price...
                    </span>
                  ) : !datesChanged ? (
                    "Select new dates"
                  ) : (
                    "Review Changes"
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === "review" &&
          quote &&
          (() => {
            const newNights = Math.round(
              (parseISO(quote.newCheckOut).getTime() -
                parseISO(quote.newCheckIn).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const oldNights = Math.round(
              (parseISO(quote.originalCheckOut).getTime() -
                parseISO(quote.originalCheckIn).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return (
              <div className="space-y-5">
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      {format(parseISO(quote.newCheckIn), "EEE, MMM d")} &rarr;{" "}
                      {format(parseISO(quote.newCheckOut), "EEE, MMM d, yyyy")}
                    </p>
                    <span className="text-sm font-medium text-foreground">
                      {newNights} {newNights === 1 ? "night" : "nights"}
                    </span>
                  </div>
                  {(quote.newCheckIn !== quote.originalCheckIn ||
                    quote.newCheckOut !== quote.originalCheckOut) && (
                    <p className="mt-1 text-xs text-muted-foreground line-through">
                      {format(parseISO(quote.originalCheckIn), "MMM d")} &ndash;{" "}
                      {format(parseISO(quote.originalCheckOut), "MMM d, yyyy")}{" "}
                      ({oldNights} {oldNights === 1 ? "night" : "nights"})
                    </p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current total</span>
                    <span className="text-foreground">
                      {formatMoney(quote.pricing.currentTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New total</span>
                    <span className="text-foreground">
                      {formatMoney(quote.pricing.newTotal)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2.5">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {quote.action === "charge"
                          ? "Additional charge"
                          : quote.action === "refund"
                            ? "Refund"
                            : quote.action === "no-refund"
                              ? "Difference (no refund)"
                              : "No price change"}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          quote.action === "refund"
                            ? "text-green-700"
                            : "text-foreground"
                        }`}
                      >
                        {quote.action === "no-change"
                          ? "$0.00"
                          : quote.action === "refund"
                            ? `-${formatMoney(quote.pricing.delta)}`
                            : formatMoney(quote.pricing.delta)}
                      </span>
                    </div>
                  </div>
                </div>

                {quote.action === "no-refund" && (
                  <p className="text-xs text-muted-foreground">
                    Shortenings within 48 hours of check-in or during your stay
                    are not eligible for a refund.
                  </p>
                )}

                {quote.action === "refund" && (
                  <p className="text-xs text-green-700">
                    A refund of {formatMoney(quote.pricing.delta)} will be
                    issued to your original payment method. Refunds typically
                    appear in 5-10 business days.
                  </p>
                )}

                {quote.action === "charge" ? (
                  <button
                    onClick={handleCreatePaymentIntent}
                    className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Continue to Payment
                  </button>
                ) : (
                  <button
                    onClick={handleConfirmNoCharge}
                    disabled={finalizing}
                    className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {finalizing ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating...
                      </span>
                    ) : quote.action === "refund" ? (
                      "Confirm & Get Refund"
                    ) : (
                      "Confirm Changes"
                    )}
                  </button>
                )}
              </div>
            );
          })()}

        {/* Step 3: Payment */}
        {step === "payment" && clientSecret && (
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
                  ".Tab--selected": { borderColor: "#284847" },
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
              ],
            }}
          >
            <PaymentForm
              onSuccess={handlePaymentSuccess}
              onError={(msg) => setError(msg)}
              loading={finalizing}
              amount={actualAmount || quote?.pricing.delta || 0}
            />
          </Elements>
        )}

        {/* Step 4: Success */}
        {step === "success" && quote && (
          <div className="py-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <p className="mt-4 text-base font-semibold text-foreground">
              Your dates have been updated!
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {format(parseISO(quote.newCheckIn), "EEE, MMM d")} &rarr;{" "}
              {format(parseISO(quote.newCheckOut), "EEE, MMM d, yyyy")}
            </p>
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div className="py-6 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <p className="mt-4 text-base font-semibold text-foreground">
              Something went wrong
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
