"use client";

import { Loader2, CheckCircle2 } from "lucide-react";

/**
 * Shown when the payment succeeded but the reservation is still being created.
 *
 * Deliberately NOT styled as an error. The old red "your reservation is still
 * being finalized / our team has been notified" copy read as a failure, so
 * guests either called support or re-booked — and a re-book on different dates
 * or a different unit slips past the same-stay double-charge guards entirely,
 * producing two real reservations and two real charges.
 *
 * The message the guest needs is: your money is safe, this is normal, don't pay
 * again, we're watching it for you.
 */
export function BookingRecoveryNotice({
  recovering,
  timedOut,
  className = "",
}: {
  recovering: boolean;
  timedOut: boolean;
  className?: string;
}) {
  if (!recovering && !timedOut) return null;

  if (recovering) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-lg border border-border bg-secondary/40 p-4 text-center ${className}`}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Payment received — confirming your reservation
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This occasionally takes a couple of minutes. Please keep this page open
          and don&apos;t pay again — we&apos;ll take you to your confirmation as
          soon as it&apos;s ready.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border border-border bg-secondary/40 p-4 text-center ${className}`}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Your payment went through
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your reservation is taking longer than usual to finish. It&apos;s being
        completed automatically and your confirmation will arrive by email
        shortly — <strong>please don&apos;t pay again</strong>. If you&apos;d
        like it confirmed now, call us at{" "}
        <a href="tel:+17207592013" className="underline">
          (720) 759-2013
        </a>
        .
      </p>
    </div>
  );
}
