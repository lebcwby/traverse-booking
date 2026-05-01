"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function StripeRedirectResult() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [allowRetry, setAllowRetry] = useState(true);
  const calledRef = useRef(false);

  const paymentIntent = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");
  const pendingCheckoutToken = searchParams.get("pendingCheckoutToken");

  useEffect(() => {
    if (!paymentIntent || redirectStatus !== "succeeded") {
      setError(
        redirectStatus === "failed"
          ? "Your payment was declined. Please try again with a different payment method."
          : "Payment verification failed. Please try booking again."
      );
      setProcessing(false);
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    async function createReservation() {
      async function loadPendingCheckout() {
        let token = pendingCheckoutToken;
        if (!token) {
          try {
            const stored = sessionStorage.getItem("booking_pending");
            if (stored) {
              const pending = JSON.parse(stored);
              token = pending?.pendingCheckoutToken || null;
            }
          } catch {
            token = null;
          }
        }
        if (!token) return null;

        const pendingRes = await fetch(
          `/api/pending-checkout?paymentIntentId=${encodeURIComponent(paymentIntent || "")}&token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        if (!pendingRes.ok) return null;
        return pendingRes.json();
      }

      async function waitForCompletedReservation() {
        for (let attempt = 0; attempt < 8; attempt++) {
          const pending = await loadPendingCheckout();
          if (pending?.status === "completed" && pending?.reservationId) {
            return pending;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        return null;
      }

      function buildBookingDataFromPending(pending: {
        paymentIntentId: string;
        quoteId: string;
        ratePlanId?: string;
        guest?: {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
        };
        tracking?: {
          listingId?: string;
          listingTitle?: string;
          picture?: string;
          checkIn?: string;
          checkOut?: string;
          guests?: number;
          totalPaid?: number;
          stayTotal?: number;
          eventId?: string;
        };
        upsells?: string[];
        pets?: number;
      }) {
        return {
          paymentIntentId: pending.paymentIntentId,
          quoteId: pending.quoteId,
          ratePlanId: pending.ratePlanId,
          guest: pending.guest,
          listingId: pending.tracking?.listingId,
          listingTitle: pending.tracking?.listingTitle,
          picture: pending.tracking?.picture,
          checkIn: pending.tracking?.checkIn,
          checkOut: pending.tracking?.checkOut,
          guests: pending.tracking?.guests,
          total: pending.tracking?.totalPaid,
          stayTotal: pending.tracking?.stayTotal,
          upsells: pending.upsells,
          pets: pending.pets,
          eventId: pending.tracking?.eventId,
        };
      }

      function persistConfirmation(
        bookingData: {
          listingId?: string;
          listingTitle?: string;
          picture?: string;
          checkIn?: string;
          checkOut?: string;
          guests?: number;
          stayTotal?: number;
          total?: number;
          guest?: {
            email?: string;
            phone?: string;
            firstName?: string;
            lastName?: string;
          };
          eventId?: string;
          upsells?: string[];
          pets?: number;
          marketingOptIn?: boolean;
        },
        reservationId: string,
        totalPaid?: number,
        confirmationCode?: string
      ) {
        sessionStorage.setItem(
          "booking_confirmation",
          JSON.stringify({
            listingId: bookingData.listingId,
            listingTitle: bookingData.listingTitle,
            picture: bookingData.picture,
            checkIn: bookingData.checkIn,
            checkOut: bookingData.checkOut,
            guests: bookingData.guests,
            stayTotal: bookingData.stayTotal || bookingData.total || 0,
            totalPaid:
              totalPaid || bookingData.total || bookingData.stayTotal || 0,
            reservationId,
            confirmationCode,
            guestEmail: bookingData.guest?.email,
            guestPhone: bookingData.guest?.phone,
            guestFirstName: bookingData.guest?.firstName,
            guestLastName: bookingData.guest?.lastName,
            eventId: bookingData.eventId,
            marketingOptIn: bookingData.marketingOptIn || false,
            tracked: false,
            upsells: bookingData.upsells,
            pets: bookingData.pets,
          })
        );
      }

      try {
        const stored = sessionStorage.getItem("booking_pending");
        let bookingData = stored ? JSON.parse(stored) : null;
        const initialPending = await loadPendingCheckout();

        if (
          initialPending?.status === "completed" &&
          initialPending?.reservationId
        ) {
          if (!bookingData) {
            bookingData = buildBookingDataFromPending(initialPending);
          }
          persistConfirmation(
            bookingData,
            initialPending.reservationId,
            bookingData?.total,
            initialPending.confirmationCode
          );
          sessionStorage.removeItem("booking_pending");
          router.replace(`/book/confirmation/${initialPending.reservationId}`);
          return;
        }

        if (!bookingData) {
          if (initialPending) {
            bookingData = buildBookingDataFromPending(initialPending);
          }
        }
        if (!bookingData) {
          const completedPending = await waitForCompletedReservation();
          if (completedPending?.reservationId) {
            router.replace(
              `/book/confirmation/${completedPending.reservationId}`
            );
            return;
          }
          setAllowRetry(false);
          setError(
            "Booking session expired. We’re still checking your payment. Contact support if you were charged and do not receive a confirmation."
          );
          setProcessing(false);
          return;
        }

        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: paymentIntent,
            quoteId: bookingData.quoteId,
            ratePlanId: bookingData.ratePlanId,
            guest: bookingData.guest,
            upsells: bookingData.upsells,
            pets: bookingData.pets,
            tracking: {
              listingId: bookingData.listingId,
              listingTitle: bookingData.listingTitle,
              checkIn: bookingData.checkIn,
              checkOut: bookingData.checkOut,
              guests: bookingData.guests,
              total: bookingData.total,
              eventId: bookingData.eventId,
            },
          }),
        });

        const data = await res.json();
        if (res.status === 202 && data.pendingRecovery) {
          const completedPending = await waitForCompletedReservation();
          if (completedPending?.reservationId) {
            persistConfirmation(
              bookingData,
              completedPending.reservationId,
              bookingData.total,
              completedPending.confirmationCode
            );
            sessionStorage.removeItem("booking_pending");
            router.replace(
              `/book/confirmation/${completedPending.reservationId}`
            );
            return;
          }
          setAllowRetry(false);
          setError(
            data.error ||
              "Your payment was received and your reservation is being finalized. Please do not retry."
          );
          setProcessing(false);
          return;
        }
        if (!res.ok) {
          const completedPending = await waitForCompletedReservation();
          if (completedPending?.reservationId) {
            persistConfirmation(
              bookingData,
              completedPending.reservationId,
              bookingData.total,
              completedPending.confirmationCode
            );
            sessionStorage.removeItem("booking_pending");
            router.replace(
              `/book/confirmation/${completedPending.reservationId}`
            );
            return;
          }
          setError(
            data.error || "Reservation creation failed. Please contact support."
          );
          setProcessing(false);
          return;
        }
        persistConfirmation(
          {
            ...bookingData,
            total: data.chargedAmount || bookingData.total,
            upsells: Array.isArray(data.appliedUpsells)
              ? data.appliedUpsells
              : bookingData.upsells,
            pets:
              typeof data.appliedPets === "number"
                ? data.appliedPets
                : bookingData.pets,
          },
          data.reservationId,
          data.chargedAmount,
          data.confirmationCode
        );

        sessionStorage.removeItem("booking_pending");
        router.replace(`/book/confirmation/${data.reservationId}`);
      } catch {
        setAllowRetry(false);
        setError(
          "Something went wrong completing your booking. Please contact support."
        );
        setProcessing(false);
      }
    }

    createReservation();
  }, [paymentIntent, pendingCheckoutToken, redirectStatus, router]);

  const retryLink = (() => {
    try {
      const stored = sessionStorage.getItem("booking_pending");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.quoteId) return `/book/${data.quoteId}`;
        if (data.listingId) return `/properties/${data.listingId}`;
      }
    } catch {
      /* ignore */
    }
    return "/properties";
  })();

  if (processing) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="text-center">
              <Link href="/" className="inline-block">
                <Image
                  src="/book-traverse-wordmark-dark.png"
                  alt="Book Traverse"
                  width={140}
                  height={47}
                  className="mx-auto"
                />
              </Link>
            </div>
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <h1 className="text-xl font-bold text-foreground">
                Completing your booking...
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                Your payment has been verified. Please wait while we finalize
                your reservation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <Image
                src="/book-traverse-wordmark-dark.png"
                alt="Book Traverse"
                width={140}
                height={47}
                className="mx-auto"
              />
            </Link>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Booking Update
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>

          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/contact">Contact Support</Link>
            </Button>
            {allowRetry && (
              <Button
                asChild
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link href={retryLink}>Return to Booking</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ThreeDSCallbackPage() {
  return (
    <Suspense fallback={null}>
      <StripeRedirectResult />
    </Suspense>
  );
}
