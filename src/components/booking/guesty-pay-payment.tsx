"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { loadScript } from "@guestyorg/tokenization-js";
import type { GuestyTokenizationV2Namespace } from "@guestyorg/tokenization-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface GuestyPayPaymentProps {
  listingId: string;
  paymentProviderId: string;
  amount: number;
  guestName: string;
  quoteId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  onPaymentMethod: (ccToken: string) => void;
  onError: (error: string) => void;
  loading: boolean;
  disabled: boolean;
  hideButton?: boolean;
  onCardReady?: (complete: boolean) => void;
  onSubmitRef?: MutableRefObject<(() => void) | null>;
}

const CONTAINER_ID = "guesty-tokenization-container";

// Load the SDK in sandbox mode for the test booking (NEXT_PUBLIC_GUESTY_PAY_SANDBOX).
// Sandbox tokenizes against Guesty's test environment with test card numbers.
const SANDBOX = process.env.NEXT_PUBLIC_GUESTY_PAY_SANDBOX === "true";

export function GuestyPayPayment({
  listingId,
  paymentProviderId,
  amount,
  quoteId,
  guestFirstName,
  guestLastName,
  guestEmail,
  guestPhone,
  guestAddress,
  onPaymentMethod,
  onError,
  loading,
  disabled,
  hideButton,
  onCardReady,
  onSubmitRef,
}: GuestyPayPaymentProps) {
  const sdkRef = useRef<GuestyTokenizationV2Namespace | null>(null);
  const cardValidRef = useRef(false);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        const sdk = await loadScript({ version: "v2", sandbox: SANDBOX });
        if (destroyed || !sdk) return;
        sdkRef.current = sdk;

        await sdk.render({
          containerId: CONTAINER_ID,
          providerId: paymentProviderId,
          onStatusChange: (isValid: boolean) => {
            cardValidRef.current = isValid;
            onCardReady?.(isValid);
          },
          initialValues: {
            firstName: guestFirstName,
            lastName: guestLastName,
            ...(guestAddress?.street && { street: guestAddress.street }),
            ...(guestAddress?.city && { city: guestAddress.city }),
            ...(guestAddress?.state && { state: guestAddress.state }),
            ...(guestAddress?.zipCode && { zipCode: guestAddress.zipCode }),
            ...(guestAddress?.country && { country: guestAddress.country }),
          },
          showSupportedCards: true,
          styles: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            colorText: "#0a0a0a",
            colorBorder: "#e5e5e5",
            colorBorderHover: "#a3a3a3",
            colorPlaceholder: "#a3a3a3",
            colorBackground: "#ffffff",
            colorFormBackground: "#ffffff",
            colorBackgroundDisabled: "#ffffff",
            borderRadius: 8,
            inputHeight: 48,
            inputPadding: 14,
            fontSizeMd: 16,
          },
        });
      } catch (err) {
        if (!destroyed) {
          console.error("Guesty tokenization init error:", err);
          onError("Failed to load payment form. Please refresh and try again.");
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      try {
        sdkRef.current?.destroy().catch(() => {});
      } catch {}
      sdkRef.current = null;
    };
    // Only re-init if the provider changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentProviderId]);

  async function handleSubmit() {
    const sdk = sdkRef.current;
    if (!sdk) return;

    try {
      sdk.validate();

      const payload = {
        listingId,
        amount,
        currency: "USD",
        quoteId,
        guest: {
          firstName: guestFirstName,
          lastName: guestLastName,
          email: guestEmail,
          phone: guestPhone,
        },
      };
      const result = await sdk.submit(payload);

      if (!result?._id) {
        onError("Payment processing failed. Please try again.");
        return;
      }

      onPaymentMethod(result._id);
    } catch (err: unknown) {
      console.error("Guesty tokenization submit error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Payment failed. Please try again.";
      onError(message);
    }
  }

  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = handleSubmit;
    }
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Payment</h3>
      <div id={CONTAINER_ID} />
      {!hideButton && (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!cardValidRef.current || loading || disabled}
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
    </div>
  );
}
