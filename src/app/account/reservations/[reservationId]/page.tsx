"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { format, parseISO, differenceInHours } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Key,
  Loader2,
  AlertTriangle,
  DollarSign,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { CardBrandIcon } from "@/components/ui/card-brand-icon";
import { ChangeDates } from "@/components/booking/change-dates";

interface InvoiceItem {
  title: string;
  amount: number;
  type: string;
  isTax: boolean;
}

interface Payment {
  amount: number;
  status: string;
  paidAt: string | null;
  currency: string;
}

interface DateChange {
  type: string;
  amount?: number;
  refundAmount?: number;
  previousCheckIn?: string;
  previousCheckOut?: string;
  newCheckIn?: string;
  newCheckOut?: string;
  recordedAt?: string;
}

interface Money {
  total: number;
  subtotal: number;
  cleaning: number;
  taxes: number;
  currency: string;
  invoiceItems: InvoiceItem[];
  payments: Payment[];
}

type RefundStatus =
  | "refund_pending"
  | "full_refund"
  | "non_refundable"
  | "pending_manual"
  | "failed";

interface Reservation {
  id: number;
  reservation_id: string;
  confirmation_code: string | null;
  guest_email: string;
  guest_name: string | null;
  listing_id: string | null;
  listing_name: string | null;
  listing_photo: string | null;
  check_in: string | null;
  check_out: string | null;
  guests_count: number | null;
  status: string | null;
  money: Money | null;
  date_changes: DateChange[] | null;
  key_code: string | null;
  canceled_at: string | null;
  refund_status: RefundStatus | null;
  refund_amount: number | null;
  stripe_refund_id: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "unknown").toLowerCase();
  let classes = "bg-muted text-muted-foreground";
  if (s === "confirmed") classes = "bg-green-100 text-green-800";
  else if (s === "canceled" || s === "cancelled")
    classes = "bg-red-100 text-red-800";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${classes}`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function CanceledBanner({
  canceledAt,
  refundStatus,
  refundAmount,
}: {
  canceledAt: string | null;
  refundStatus: Reservation["refund_status"];
  refundAmount: number | null;
}) {
  const dateLabel = canceledAt
    ? format(parseISO(canceledAt), "MMM d, yyyy")
    : "today";

  let tone = "border-border bg-muted/50 text-foreground";
  let body = "This reservation has been canceled.";

  if (refundStatus === "refund_pending") {
    tone = "border-blue-200 bg-blue-50 text-blue-900";
    body = `This reservation was canceled on ${dateLabel}. Your refund is being processed. We'll email you as soon as it's issued.`;
  } else if (refundStatus === "full_refund") {
    const amount =
      typeof refundAmount === "number" && refundAmount > 0
        ? `$${refundAmount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "your full payment";
    tone = "border-green-200 bg-green-50 text-green-900";
    body = `This reservation was canceled on ${dateLabel}. A full refund of ${amount} was issued to your card. Refunds typically appear in 5-10 business days.`;
  } else if (refundStatus === "non_refundable") {
    tone = "border-border bg-muted/50 text-foreground";
    body = `This reservation was canceled on ${dateLabel}. Per our cancellation policy, reservations canceled within 48 hours of check-in are non-refundable.`;
  } else if (refundStatus === "pending_manual") {
    tone = "border-blue-200 bg-blue-50 text-blue-900";
    body = `This reservation was canceled on ${dateLabel}. A refund is being processed manually — we'll email you within 24 hours.`;
  } else if (refundStatus === "failed") {
    tone = "border-amber-200 bg-amber-50 text-amber-900";
    body = `This reservation was canceled on ${dateLabel}. There was an issue processing your refund — we'll be in touch shortly.`;
  }

  return (
    <div className={`mt-6 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      {body}
    </div>
  );
}

function getNightCount(checkIn: string, checkOut: string): number {
  const inDate = parseISO(checkIn);
  const outDate = parseISO(checkOut);
  return Math.round(
    (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function isUpcoming(checkIn: string | null): boolean {
  if (!checkIn) return false;
  return parseISO(checkIn) > new Date();
}

/**
 * Guesty's invoice items come through with titles like "Accommodation fare"
 * and "Cleaning fee". Drop the trailing fare/fee suffix so the summary
 * reads as a clean list ("Accommodation", "Cleaning") without touching tax
 * lines ("Portland TLT") or upsell titles ("Early Check-in (1 PM)").
 */
function normalizeLineItemTitle(title: string): string {
  return title.replace(/\s+(fare|fee)$/i, "");
}

interface PaymentMethod {
  brand: string | null;
  last4: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
}

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  "american-express": "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  unknown: "Card",
};

function formatCardBrandLabel(brand: string): string {
  const key = brand.toLowerCase().replace(/_/g, "-");
  return (
    CARD_BRAND_LABELS[key] ?? brand.charAt(0).toUpperCase() + brand.slice(1)
  );
}

export default function ReservationDetailPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null
  );

  // Cancel flow state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReservation() {
      try {
        const res = await fetch("/api/account/reservations");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to load reservations");
        const data: Reservation[] = await res.json();
        const match = data.find((r) => r.reservation_id === reservationId);
        if (!match) {
          setError("Reservation not found");
        } else {
          setReservation(match);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchReservation();
  }, [reservationId]);

  // Fetch card brand / last4 / receipt URL separately so the main load
  // isn't blocked on a Stripe roundtrip. Fire-and-forget — payment info
  // is a nice-to-have, not load-bearing.
  useEffect(() => {
    let cancelled = false;
    async function fetchPaymentMethod() {
      try {
        const res = await fetch(
          `/api/account/reservations/${reservationId}/payment-method`
        );
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.payment) {
          setPaymentMethod(body.payment as PaymentMethod);
        }
      } catch {
        // Silent — summary without payment method info is still useful.
      }
    }
    fetchPaymentMethod();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  async function handleCancelConfirm() {
    setCanceling(true);
    setCancelError(null);
    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/cancel`,
        { method: "POST" }
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to cancel reservation");
      }
      setShowCancelModal(false);
      setReservation((prev) =>
        prev
          ? {
              ...prev,
              status: "canceled",
              canceled_at: body.canceledAt ?? new Date().toISOString(),
              refund_status: body.refundStatus ?? null,
              refund_amount:
                typeof body.refundAmount === "number"
                  ? body.refundAmount
                  : prev.refund_amount,
              stripe_refund_id: body.stripeRefundId ?? prev.stripe_refund_id,
            }
          : prev
      );
      // The cancellation banner renders at the top of the page; scroll up so
      // the user actually sees it instead of staring at the now-disabled
      // cancel button at the bottom.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setCanceling(false);
    }
  }

  // Refund eligibility calculation
  function getRefundEligible(): boolean {
    if (!reservation?.check_in) return false;
    const checkInDate = parseISO(reservation.check_in);
    return differenceInHours(checkInDate, new Date()) > 48;
  }

  // Key code visibility: only within 24 hours of check-in
  function shouldShowKeyCode(): boolean {
    if (!reservation?.key_code || !reservation?.check_in) return false;
    const checkInDate = parseISO(reservation.check_in);
    const now = new Date();
    const hoursUntilCheckIn = differenceInHours(checkInDate, now);
    return hoursUntilCheckIn <= 24 && hoursUntilCheckIn >= -48; // show during stay too
  }

  // Can cancel: confirmed + upcoming
  function canCancel(): boolean {
    if (!reservation) return false;
    const s = (reservation.status || "").toLowerCase();
    return s === "confirmed" && isUpcoming(reservation.check_in);
  }

  // Can extend: confirmed + checkout is today or in the future
  function canExtend(): boolean {
    if (!reservation?.check_out || !reservation?.listing_id) return false;
    const s = (reservation.status || "").toLowerCase();
    if (s !== "confirmed") return false;
    const checkout = parseISO(reservation.check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkout >= today;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <Link
          href="/account/reservations"
          className="-mx-2 -my-1 inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Reservations
        </Link>
        <p className="mt-8 text-center text-muted-foreground">
          {error || "Reservation not found"}
        </p>
      </div>
    );
  }

  const r = reservation;
  const nightCount =
    r.check_in && r.check_out ? getNightCount(r.check_in, r.check_out) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      {/* Back link */}
      <Link
        href="/account/reservations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Reservations
      </Link>

      {/* Persistent canceled banner */}
      {(r.status || "").toLowerCase() === "canceled" && (
        <CanceledBanner
          canceledAt={r.canceled_at}
          refundStatus={r.refund_status}
          refundAmount={r.refund_amount}
        />
      )}

      {/* Header */}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {r.listing_name || "Property"}
        </h1>
        <StatusBadge status={r.status} />
      </div>

      {/* Property photo */}
      <div className="mt-6">
        {r.listing_photo ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image
              src={r.listing_photo}
              alt={r.listing_name || "Property"}
              fill
              className="object-cover"
              sizes="(max-width: 896px) 100vw, 896px"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-muted">
            <MapPin className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Dates */}
      <section className="mt-8 rounded-lg border border-border p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Dates
        </div>
        {r.check_in && r.check_out ? (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Check-in</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {format(parseISO(r.check_in), "EEE, MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">4:00 PM</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Check-out</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {format(parseISO(r.check_out), "EEE, MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">11:00 AM</p>
            </div>
            {nightCount !== null && (
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {nightCount} {nightCount === 1 ? "night" : "nights"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Dates TBD</p>
        )}
      </section>

      {/* Guests */}
      {r.guests_count && (
        <section className="mt-4 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            Guests
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {r.guests_count} {r.guests_count === 1 ? "guest" : "guests"}
          </p>
        </section>
      )}

      {/* Confirmation code */}
      {r.confirmation_code && (
        <section className="mt-4 rounded-lg border border-border p-5">
          <p className="text-xs text-muted-foreground">Confirmation Code</p>
          <p className="mt-1 text-xl font-semibold tracking-wide text-foreground">
            {r.confirmation_code}
          </p>
        </section>
      )}

      {/* Payment details */}
      {r.money && r.money.total > 0 && (
        <section className="mt-4 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Payment details
          </div>

          <div className="mt-4 space-y-2.5">
            {/* Line items */}
            {r.money.invoiceItems.length > 0 ? (
              r.money.invoiceItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {normalizeLineItemTitle(item.title)}
                  </span>
                  <span className="text-foreground">
                    $
                    {item.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))
            ) : (
              <>
                {r.money.subtotal > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Accommodation
                      {nightCount
                        ? ` (${nightCount} ${nightCount === 1 ? "night" : "nights"})`
                        : ""}
                    </span>
                    <span className="text-foreground">
                      $
                      {r.money.subtotal.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {r.money.cleaning > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cleaning fee</span>
                    <span className="text-foreground">
                      $
                      {r.money.cleaning.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {r.money.taxes > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span className="text-foreground">
                      $
                      {r.money.taxes.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Divider + Total */}
            <div className="border-t border-border pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Total
                </span>
                <span className="text-sm font-semibold text-foreground">
                  $
                  {r.money.total.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {/* Payment status */}
            {r.money.payments.length > 0 && (
              <div className="mt-1 space-y-1.5 border-t border-border pt-2.5">
                {r.money.payments.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CardBrandIcon
                      brand={paymentMethod?.brand ?? null}
                      title={
                        paymentMethod?.brand && paymentMethod?.last4
                          ? `${formatCardBrandLabel(paymentMethod.brand)} ending in ${paymentMethod.last4}`
                          : "Card"
                      }
                    />
                    <span>
                      {paymentMethod?.last4 && (
                        <span className="mr-1 font-medium text-foreground">
                          ···· {paymentMethod.last4}
                        </span>
                      )}
                      $
                      {p.amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      &middot; {p.status === "SUCCEEDED" ? "Paid" : p.status}
                      {p.paidAt && (
                        <>
                          {" "}
                          &middot; {format(parseISO(p.paidAt), "MMM d, yyyy")}
                        </>
                      )}
                    </span>
                  </div>
                ))}
                {paymentMethod?.receiptUrl && (
                  <a
                    href={paymentMethod.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    View Stripe receipt
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Refund line */}
            {r.refund_status === "full_refund" &&
              typeof r.refund_amount === "number" &&
              r.refund_amount > 0 && (
                <div className="mt-1 pt-2.5 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>
                      -$
                      {r.refund_amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      &middot; Refunded
                      {r.canceled_at && (
                        <>
                          {" "}
                          &middot;{" "}
                          {format(parseISO(r.canceled_at), "MMM d, yyyy")}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
          </div>
        </section>
      )}

      {/* Change history — only shown when date changes exist */}
      {r.date_changes && r.date_changes.length > 0 && (
        <section className="mt-4">
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
              Change History ({r.date_changes.length})
            </summary>
            <div className="border-t border-border px-5 py-4 space-y-3">
              {r.date_changes.map((dc, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between text-sm"
                >
                  <div>
                    <p className="text-foreground">
                      {dc.previousCheckIn && dc.newCheckIn
                        ? `${format(parseISO(dc.previousCheckIn), "MMM d")}–${format(parseISO(dc.previousCheckOut || dc.previousCheckIn), "MMM d")} → ${format(parseISO(dc.newCheckIn), "MMM d")}–${format(parseISO(dc.newCheckOut || dc.newCheckIn), "MMM d, yyyy")}`
                        : "Date change"}
                    </p>
                    {dc.recordedAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(
                          parseISO(dc.recordedAt),
                          "MMM d, yyyy 'at' h:mm a"
                        )}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {dc.type === "charge" && dc.amount && (
                      <span className="text-foreground font-medium">
                        +$
                        {dc.amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    {dc.type === "refund" && dc.refundAmount && (
                      <span className="text-green-700 font-medium">
                        -$
                        {dc.refundAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                    {dc.type === "no-refund-shorten" && (
                      <span className="text-muted-foreground text-xs">
                        No refund
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Key code / Check-in instructions */}
      {shouldShowKeyCode() && (
        <section className="mt-4 rounded-lg border border-border bg-blue-50 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
            <Key className="h-4 w-4" />
            Check-In Instructions
          </div>
          <p className="mt-3 text-2xl font-bold tracking-widest text-blue-900">
            {r.key_code}
          </p>
        </section>
      )}

      {/* Guest portal */}
      {r.confirmation_code && (r.status || "").toLowerCase() !== "canceled" && (
        <section className="mt-4 rounded-lg border border-border p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            Guest Portal
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Access your check-in instructions, door codes, Wi-Fi details, house
            manual, ID verification, and more.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Check-in instructions",
              "Early check-in",
              "Late check-out",
              "ID verification",
              "House manual",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
          <a
            href={`https://app.booktraverse.com/${r.confirmation_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open Guest Portal
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>
      )}

      {/* Change dates */}
      {canExtend() && r.check_in && (
        <section className="mt-6">
          <ChangeDates
            reservationId={r.reservation_id}
            listingId={r.listing_id!}
            currentCheckIn={r.check_in}
            currentCheckOut={r.check_out!}
            onChanged={(newCheckIn, newCheckOut) => {
              setReservation((prev) =>
                prev
                  ? { ...prev, check_in: newCheckIn, check_out: newCheckOut }
                  : prev
              );
            }}
          />
        </section>
      )}

      {/* Cancel section */}
      {canCancel() && (
        <section className="mt-10 border-t border-border pt-8">
          <button
            onClick={() => setShowCancelModal(true)}
            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Cancel Reservation
          </button>
        </section>
      )}

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !canceling && setShowCancelModal(false)}
          />
          <div className="relative z-10 mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Cancel Reservation
              </h2>
            </div>

            <div className="mt-4 space-y-3">
              {getRefundEligible() ? (
                <p className="text-sm text-foreground">
                  You will receive a <strong>full refund</strong>.
                </p>
              ) : (
                <p className="text-sm text-foreground">
                  This cancellation is <strong>non-refundable</strong>. You will
                  not receive a refund.
                </p>
              )}

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Cancellation Policy
                </p>
                <p className="mt-1">
                  Cancellations made more than 48 hours before check-in receive
                  a full refund. Cancellations within 48 hours of check-in are
                  non-refundable.
                </p>
              </div>
            </div>

            {cancelError && (
              <p className="mt-3 text-sm text-red-600">{cancelError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Keep Reservation
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={canceling}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {canceling ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Canceling...
                  </span>
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
