"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";
import { getPhotoUrl, formatCurrency } from "@/lib/utils";
import { getSelectedUpsells } from "@/lib/upsells";
import { CardBrandIcon } from "@/components/ui/card-brand-icon";
import {
  readConfirmationSession,
  type ConfirmationSession,
} from "./lib/confirmation-session";
import type { ConfirmationData } from "./lib/view-state";

interface Props {
  data: ConfirmationData;
}

interface Extra {
  title: string;
  amount: number;
}

export function BookingSummary({ data }: Props) {
  const [session, setSession] = useState<ConfirmationSession | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);

  useEffect(() => {
    const currentSession = readConfirmationSession(data.reservationId);
    setSession(currentSession);

    if (!currentSession) {
      setExtras([]);
      return;
    }

    const items: Extra[] = [];
    if (
      Array.isArray(currentSession.upsells) &&
      currentSession.upsells.length
    ) {
      items.push(
        ...getSelectedUpsells(currentSession.upsells)
          .filter((upsell) => upsell.id !== "pet-fee")
          .map((upsell) => ({
            title: upsell.title,
            amount: upsell.amount,
          }))
      );
    }

    const petCount =
      typeof currentSession.pets === "number" ? currentSession.pets : 0;
    if (petCount > 0) {
      items.push({
        title: petCount > 1 ? `Pet Fee (${petCount} pets)` : "Pet Fee",
        amount: petCount * 99,
      });
    }

    setExtras(items);
  }, [data.reservationId]);

  if (!data.listingTitle && !data.checkIn && !data.listingPicture) return null;

  const checkInDate = data.checkIn ? parseISO(data.checkIn) : null;
  const checkOutDate = data.checkOut ? parseISO(data.checkOut) : null;
  const nights =
    checkInDate && checkOutDate
      ? Math.round(
          (checkOutDate.getTime() - checkInDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const money = data.money;
  const extrasTotal = extras.reduce((sum, extra) => sum + extra.amount, 0);
  const stayAmount =
    session?.stayTotal ??
    (money?.hasDetailedBreakdown ? (money.stay ?? null) : null);
  const cleaningAmount =
    money?.hasDetailedBreakdown && (money.cleaning ?? 0) > 0
      ? money.cleaning
      : null;
  const taxesAmount =
    money?.hasDetailedBreakdown && (money.taxes ?? 0) > 0 ? money.taxes : null;
  const totalPaid = session?.totalPaid ?? money?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border">
        {data.listingPicture && (
          <div className="relative h-56 w-full">
            <Image
              src={getPhotoUrl(data.listingPicture, 600)}
              alt={data.listingTitle || "Property"}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 600px"
            />
          </div>
        )}
        <div className="p-4">
          {data.listingTitle && (
            <h3 className="leading-snug font-semibold text-foreground">
              {data.listingTitle}
            </h3>
          )}
          {checkInDate && checkOutDate && (
            <p className="mt-1 text-sm text-muted-foreground">
              {format(checkInDate, "EEE, MMM d")} –{" "}
              {format(checkOutDate, "EEE, MMM d")}
              {nights && ` · ${nights} ${nights === 1 ? "night" : "nights"}`}
            </p>
          )}
          {data.guests && (
            <p className="text-sm text-muted-foreground">
              {data.guests} {data.guests === 1 ? "guest" : "guests"}
            </p>
          )}
        </div>
      </div>

      {totalPaid > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Payment Summary</h3>
          <div className="space-y-2 rounded-xl border border-border p-4">
            {stayAmount != null && stayAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {nights && nights > 1
                    ? `Accommodation (${nights} nights)`
                    : "Accommodation"}
                </span>
                <span>{formatCurrency(stayAmount, { cents: true })}</span>
              </div>
            )}
            {cleaningAmount != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cleaning fee</span>
                <span>{formatCurrency(cleaningAmount, { cents: true })}</span>
              </div>
            )}
            {taxesAmount != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes</span>
                <span>{formatCurrency(taxesAmount, { cents: true })}</span>
              </div>
            )}
            {extras.map((item) => (
              <div key={item.title} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.title}</span>
                <span>{formatCurrency(item.amount, { cents: true })}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total paid</span>
              <span>
                {formatCurrency(
                  session?.totalPaid ?? money?.total ?? extrasTotal,
                  { cents: true }
                )}
              </span>
            </div>

            {data.payment && (data.payment.brand || data.payment.paidAt) && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                {data.payment.brand && data.payment.last4 && (
                  <div className="flex items-center justify-between">
                    <span>Payment method</span>
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <CardBrandIcon
                        brand={data.payment.brand}
                        title={`${formatCardBrand(data.payment.brand)} ending in ${data.payment.last4}`}
                      />
                      <span>···· {data.payment.last4}</span>
                    </span>
                  </div>
                )}
                {data.payment.paidAt && (
                  <div className="flex items-center justify-between">
                    <span>Paid on</span>
                    <span className="font-medium text-foreground">
                      {format(parseISO(data.payment.paidAt), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Confirmation code</span>
                  <span className="font-medium text-foreground">
                    {data.confirmationCode}
                  </span>
                </div>
                {data.payment.receiptUrl && (
                  <div className="pt-1">
                    <a
                      href={data.payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      View Stripe receipt
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Normalize Stripe's lowercase card brand strings ("visa", "mastercard",
 * "amex", "discover", "unionpay", "jcb", "diners", "unknown") into the
 * casing guests expect to see on a receipt.
 */
function formatCardBrand(brand: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    "american-express": "American Express",
    discover: "Discover",
    diners: "Diners Club",
    "diners-club": "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
    unknown: "Card",
  };
  const normalized = brand.toLowerCase().replace(/_/g, "-");
  return map[normalized] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}
