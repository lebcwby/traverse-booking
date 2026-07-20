"use client";

import {
  useState,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export interface ExpressCheckoutBillingDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface StripePaymentProps {
  clientSecret: string;
  billingDetails: ExpressCheckoutBillingDetails;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onExpressPaymentSuccess?: (
    paymentIntentId: string,
    billingDetails: ExpressCheckoutBillingDetails
  ) => void;
  onBeforeExpressConfirm?: (
    billingDetails: ExpressCheckoutBillingDetails
  ) => Promise<void>;
  onError: (error: string) => void;
  loading: boolean;
  disabled: boolean;
  hideButton?: boolean;
  onCardReady?: (complete: boolean) => void;
  onSubmitRef?: MutableRefObject<(() => void) | null>;
  /** Content to render between express checkout and the card form */
  middleContent?: ReactNode;
  /** Increment to trigger elements.fetchUpdates() after PI amount changes (coupon, upsells) */
  piVersion?: number;
  /** Hybrid checkout: render ONLY the Apple/Google Pay express button — no Link,
   *  no Stripe card PaymentElement, no divider/middleContent/submit button. The
   *  card path is handled by GuestyPay in the parent. */
  walletsOnly?: boolean;
}

function PaymentForm({
  billingDetails,
  onPaymentSuccess,
  onExpressPaymentSuccess,
  onBeforeExpressConfirm,
  onError,
  loading,
  disabled,
  hideButton,
  onCardReady,
  onSubmitRef,
  middleContent,
  piVersion,
  walletsOnly,
}: Omit<StripePaymentProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);
  const paymentMethodBillingDetails = {
    name: [billingDetails.firstName, billingDetails.lastName]
      .filter(Boolean)
      .join(" ")
      .trim(),
    email: billingDetails.email.trim(),
    phone: billingDetails.phone.trim(),
  };

  // When the PI amount changes (coupon applied, upsells changed), tell Stripe
  // Elements to re-fetch the PI so express checkout shows the correct amount.
  const lastPiVersion = useRef(piVersion ?? 0);
  useEffect(() => {
    if (
      piVersion !== undefined &&
      piVersion !== lastPiVersion.current &&
      elements
    ) {
      lastPiVersion.current = piVersion;
      elements.fetchUpdates();
    }
  }, [piVersion, elements]);

  async function handleSubmit() {
    if (!stripe || !elements) {
      console.error("[Stripe] handleSubmit invoked but Stripe.js not ready", {
        hasStripe: !!stripe,
        hasElements: !!elements,
      });
      onError(
        "Payment form isn't ready yet. Please refresh the page and try again."
      );
      return;
    }
    let returnUrl = `${window.location.origin}/book/3ds-callback`;

    try {
      const stored = sessionStorage.getItem("booking_pending");
      if (stored) {
        const pending = JSON.parse(stored);
        if (pending?.pendingCheckoutToken) {
          returnUrl += `?pendingCheckoutToken=${encodeURIComponent(pending.pendingCheckoutToken)}`;
        }
      }
    } catch {
      // If session storage is unavailable, Stripe can still redirect back without the lookup token.
    }

    try {
      console.log("[Stripe] Calling confirmPayment");
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: paymentMethodBillingDetails,
          },
        },
        redirect: "if_required",
      });
      console.log("[Stripe] confirmPayment returned", {
        hasError: !!result.error,
        piStatus: result.paymentIntent?.status,
      });

      if (result.error) {
        onError(result.error.message || "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        onPaymentSuccess(result.paymentIntent.id);
      } else if (result.paymentIntent?.status === "processing") {
        onError(
          "Your payment is still processing. Please wait for confirmation before retrying."
        );
      } else if (result.paymentIntent?.status) {
        onError(
          `Payment requires additional handling (${result.paymentIntent.status}). Please complete any prompts and try again.`
        );
      } else {
        console.error(
          "[Stripe] confirmPayment returned no error and no paymentIntent",
          result
        );
        onError(
          "We didn't get a response from Stripe. Please refresh the page and try again."
        );
      }
    } catch (err) {
      console.error("[Stripe] confirmPayment threw synchronously:", err);
      onError(
        err instanceof Error
          ? err.message
          : "Unexpected payment error. Please refresh and try again."
      );
    }
  }

  async function handleExpressConfirm(
    event: StripeExpressCheckoutElementConfirmEvent
  ) {
    if (!stripe || !elements) {
      const message =
        "Payment form isn't ready yet. Please refresh the page and try again.";
      console.error("[Stripe] express confirm invoked before Stripe.js ready", {
        hasStripe: !!stripe,
        hasElements: !!elements,
      });
      event.paymentFailed({ reason: "fail", message });
      onError(message);
      return;
    }

    const returnUrl = `${window.location.origin}/book/3ds-callback`;
    const fullName = event.billingDetails?.name || "";
    const nameParts = fullName.trim().split(/\s+/);
    const billingDetails: ExpressCheckoutBillingDetails = {
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      email: event.billingDetails?.email || "",
      phone: event.billingDetails?.phone || "",
    };

    try {
      await onBeforeExpressConfirm?.(billingDetails);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to prepare payment. Please refresh and try again.";
      console.error("[Stripe] express pre-confirm sync failed:", err);
      event.paymentFailed({ reason: "fail", message });
      onError(message);
      return;
    }

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: {
              name: fullName.trim(),
              email: billingDetails.email.trim(),
              phone: billingDetails.phone.trim(),
            },
          },
        },
        redirect: "if_required",
      });

      if (result.error) {
        event.paymentFailed({ reason: "fail", message: result.error.message });
        onError(result.error.message || "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        if (onExpressPaymentSuccess) {
          onExpressPaymentSuccess(result.paymentIntent.id, billingDetails);
        } else {
          onPaymentSuccess(result.paymentIntent.id);
        }
      } else if (result.paymentIntent?.status === "processing") {
        onError(
          "Your payment is still processing. Please wait for confirmation before retrying."
        );
      } else if (result.paymentIntent?.status) {
        onError(
          `Payment requires additional handling (${result.paymentIntent.status}). Please complete any prompts and try again.`
        );
      } else {
        const message =
          "We didn't get a response from Stripe. Please refresh the page and try again.";
        console.error(
          "[Stripe] express confirmPayment returned no error and no paymentIntent",
          result
        );
        event.paymentFailed({ reason: "fail", message });
        onError(message);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unexpected payment error. Please refresh and try again.";
      console.error(
        "[Stripe] express confirmPayment threw synchronously:",
        err
      );
      event.paymentFailed({ reason: "fail", message });
      onError(message);
    }
  }

  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit;
    }
  });

  return (
    <div className="space-y-6">
      {/* Express Checkout — Apple Pay, Google Pay, Link */}
      <div>
        <ExpressCheckoutElement
          options={{
            emailRequired: true,
            phoneNumberRequired: true,
            // Hybrid: cards go to GuestyPay, so the Stripe express zone is
            // restricted to true device wallets — no Link/PayPal/Amazon Pay.
            ...(walletsOnly
              ? {
                  paymentMethods: {
                    applePay: "auto" as const,
                    googlePay: "auto" as const,
                    link: "never" as const,
                    amazonPay: "never" as const,
                    paypal: "never" as const,
                  },
                }
              : {}),
            buttonType: {
              applePay: "book",
              googlePay: "book",
            },
            buttonHeight: 48,
            layout: {
              maxColumns: 3,
              maxRows: 2,
              overflow: "auto",
            },
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
      </div>

      {/* In wallets-only (hybrid) mode nothing renders below the express button —
          the parent supplies the "or pay with card" divider + the GuestyPay form. */}
      {!walletsOnly && (
        <>
          {/* Divider */}
          {expressAvailable && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or pay with card
                </span>
              </div>
            </div>
          )}

      {/* Middle content — guest form, upsells, etc. inserted by parent */}
      {middleContent}

      {/* Card / payment methods */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Payment</h3>
        <PaymentElement
          options={{
            layout: {
              type: "accordion",
              defaultCollapsed: false,
              radios: false,
              spacedAccordionItems: true,
            },
            fields: {
              billingDetails: {
                email: "never",
              },
            },
          }}
          onChange={(e) => {
            const isRedirectMethod = [
              "affirm",
              "klarna",
              "amazon_pay",
              "apple_pay",
              "google_pay",
              "link",
            ].includes(e.value.type);
            const isReady = e.complete || isRedirectMethod;
            setReady(isReady);
            onCardReady?.(isReady);
          }}
          onReady={() => setReady(false)}
        />
      </div>

          {!hideButton && (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={!stripe || !ready || loading || disabled}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Booking"
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function StripePayment({ clientSecret, ...props }: StripePaymentProps) {
  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
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
        appearance: {
          // "stripe" theme applies strong defaults that override our base
          // fontFamily variable on individual element classes. Start from
          // the "flat" theme which is more permissive, then add targeted
          // rules so our font sticks on inputs, labels, tabs, and the
          // accordion row headers.
          theme: "flat",
          variables: {
            fontFamily:
              "Plus Jakarta Sans, system-ui, -apple-system, Segoe UI, sans-serif",
            // Match the site's design tokens (from globals.css):
            // --color-primary = hsl(178 29% 22%) = #284847 (dark teal)
            // --color-warm    = hsl(38 73% 60%)  = #E3AD4F (warm gold)
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
      }}
    >
      <PaymentForm {...props} />
    </Elements>
  );
}
