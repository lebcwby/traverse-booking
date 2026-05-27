// Multi-listing cart confirmation page. Forked from the single-listing
// /book/confirmation/[reservationId] pattern because the layout for
// "here are your N reservations" is too different to parameterize cleanly.
// Three outcomes to render: full success, partial-success (some refunded),
// full refund (everything failed). Refund-failed rows fall back to a
// generic "we'll resolve" message.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  PartyPopper,
  Phone,
  XCircle,
} from "lucide-react";
import { getPendingCartCheckoutByCartId } from "@/lib/cart/pending-cart-checkouts";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking Confirmed",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ cartId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CartConfirmationPage({ params }: Props) {
  const { cartId } = await params;
  if (!UUID_RE.test(cartId)) notFound();

  const record = await getPendingCartCheckoutByCartId(cartId);
  if (!record) notFound();

  const reserved = record.lines.filter((l) => l.status === "reserved");
  const refunded = record.lines.filter((l) => l.status === "refunded");
  const failed = record.lines.filter((l) => l.status === "failed");
  const charged = reserved.reduce((s, l) => s + l.hostPayout, 0);
  const refundedTotal = refunded.reduce(
    (s, l) => s + (l.refundAmount ?? 0),
    0
  );

  const outcome =
    record.status === "completed"
      ? "success"
      : record.status === "partial"
        ? "partial"
        : record.status === "refunded"
          ? "refunded"
          : "pending";

  const guestFirstName = record.guest.firstName?.trim() || null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {/* SUCCESS — celebratory hero */}
      {outcome === "success" && (
        <section className="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-8 sm:p-10">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <PartyPopper className="h-7 w-7 text-emerald-700" />
            </div>
          </div>
          <h1 className="mt-5 text-center text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Thank you{guestFirstName ? `, ${guestFirstName}` : ""}!
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-neutral-700 sm:text-lg">
            Your group booking is confirmed and{" "}
            <strong className="text-neutral-900">we can&apos;t wait to host you</strong> in Colorado.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-neutral-600">
            A receipt for all {record.lines.length} stays is on its way to{" "}
            <strong className="text-neutral-900">{record.guest.email}</strong>, plus a
            per-stay confirmation for each reservation. We&apos;ll reach out
            roughly a week before each check-in with arrival details, parking,
            and local recommendations.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a
              href="tel:+17207592013"
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 font-semibold text-white hover:bg-neutral-800"
            >
              <Phone className="h-4 w-4" />
              (720) 759-2013
            </a>
            <a
              href="mailto:bookings@traversehospitality.com"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 font-semibold text-neutral-800 hover:border-neutral-400"
            >
              <Mail className="h-4 w-4" />
              bookings@traversehospitality.com
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Questions, special requests, or need to tweak something?
            Reach out anytime — our team in Crested Butte and Leadville is here
            to help.
          </p>
        </section>
      )}

      {/* PARTIAL / REFUNDED — outcome banner */}
      {outcome !== "success" && (
        <div
          className={`mb-8 flex items-start gap-3 rounded-2xl border p-5 ${
            outcome === "partial"
              ? "border-amber-200 bg-amber-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {outcome === "partial" ? (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          ) : (
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {outcome === "partial"
                ? `${reserved.length} of ${record.lines.length} reservations confirmed.`
                : outcome === "refunded"
                  ? "Your booking couldn't be confirmed."
                  : "We're still finalizing your booking."}
            </h1>
            <p className="mt-2 text-sm text-neutral-700">
              {outcome === "partial"
                ? `We confirmed what we could and refunded the rest. The unfulfilled portion (${formatCurrency(refundedTotal, { cents: true })}) will appear back on your card within 5–10 business days.`
                : outcome === "refunded"
                  ? `None of your reservations could be confirmed and your full payment of ${formatCurrency(refundedTotal, { cents: true })} has been refunded. Our team has been notified and will follow up.`
                  : `We're still confirming your reservations. We'll email ${record.guest.email} as soon as everything is finalized.`}
            </p>
          </div>
        </div>
      )}

      {/* Reservation cards */}
      <h2 className="text-base font-semibold text-neutral-900">Your stays</h2>
      <ul className="mt-4 space-y-4">
        {record.lines.map((line) => {
          const status =
            line.status === "reserved"
              ? "reserved"
              : line.status === "refunded"
                ? "refunded"
                : line.status === "failed"
                  ? "failed"
                  : "pending";
          return (
            <li
              key={line.lineId}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                      status === "reserved"
                        ? "bg-emerald-100 text-emerald-800"
                        : status === "refunded"
                          ? "bg-amber-100 text-amber-900"
                          : status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {status === "reserved"
                      ? "Confirmed"
                      : status === "refunded"
                        ? "Refunded"
                        : status === "failed"
                          ? "Not confirmed"
                          : "Pending"}
                  </span>
                  <h3 className="mt-2 truncate text-base font-semibold text-neutral-900">
                    {line.listingTitle}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {line.listingCity ? `${line.listingCity} · ` : ""}
                    {line.checkIn} → {line.checkOut} · {line.guests} guest
                    {line.guests === 1 ? "" : "s"}
                  </p>
                  {line.reservationId && status === "reserved" && (
                    <p className="mt-2 text-sm text-neutral-700">
                      Confirmation code:{" "}
                      <span className="font-mono font-medium text-neutral-900">
                        {line.reservationId}
                      </span>
                    </p>
                  )}
                  {status === "refunded" && line.refundAmount && (
                    <p className="mt-2 text-sm text-amber-800">
                      Refunded {formatCurrency(line.refundAmount, { cents: true })}
                    </p>
                  )}
                  {line.errorMessage && status === "failed" && (
                    <p className="mt-2 text-sm text-red-700">
                      {line.errorMessage}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-base font-semibold ${
                      status === "reserved"
                        ? "text-neutral-900"
                        : "text-neutral-400 line-through"
                    }`}
                  >
                    {formatCurrency(line.hostPayout, { cents: true })}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Totals */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <dl className="space-y-2 text-sm">
          {reserved.length > 0 && (
            <div className="flex items-baseline justify-between">
              <dt className="text-neutral-700">
                Charged for {reserved.length} confirmed stay
                {reserved.length === 1 ? "" : "s"}
              </dt>
              <dd className="font-semibold text-neutral-900">
                {formatCurrency(charged, { cents: true })}
              </dd>
            </div>
          )}
          {refunded.length > 0 && (
            <div className="flex items-baseline justify-between text-amber-800">
              <dt>
                Refunded ({refunded.length} stay
                {refunded.length === 1 ? "" : "s"})
              </dt>
              <dd className="font-semibold">
                −{formatCurrency(refundedTotal, { cents: true })}
              </dd>
            </div>
          )}
          {failed.length > 0 && (
            <div className="flex items-baseline justify-between text-red-700">
              <dt>
                Pending refund ({failed.length} stay
                {failed.length === 1 ? "" : "s"})
              </dt>
              <dd className="text-sm font-medium">our team is on it</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-neutral-500">
          Cart ID:{" "}
          <span className="font-mono">{record.cartId}</span>
        </p>
      </div>

      {/* CTA — for success the hero already has phone+email; only show
          Browse-more here. For partial/refunded outcomes, surface both
          contact channels since the hero is a banner not a CTA block. */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/properties"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Browse more properties
        </Link>
        {outcome !== "success" && (
          <a
            href="mailto:bookings@traversehospitality.com"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 hover:border-neutral-400"
          >
            <Mail className="h-4 w-4" />
            Contact our team
          </a>
        )}
      </div>
    </div>
  );
}
