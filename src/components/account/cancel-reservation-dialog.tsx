"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { CANCELLATION_WINDOW_COPY } from "@/lib/cancellation-policy";

/**
 * Confirmation before a guest cancels from the account page.
 *
 * Inside the 14-day window the confirm button itself says the stay is
 * non-refundable. Outside it, the same dialog promises a full refund.
 * The server re-checks the cutoff; this copy is what the guest agrees to.
 */
export function CancelReservationDialog({
  refundEligible,
  canceling,
  error,
  onClose,
  onConfirm,
}: {
  refundEligible: boolean;
  canceling: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !canceling && onClose()}
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
          {refundEligible ? (
            <p className="text-sm text-foreground">
              You will receive a <strong>full refund</strong>.
            </p>
          ) : (
            <p className="text-sm text-foreground">
              This cancellation is <strong>non-refundable</strong>. You will not
              receive a refund for this stay.
            </p>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Cancellation Policy</p>
            <p className="mt-1">{CANCELLATION_WINDOW_COPY}</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={canceling}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Keep Reservation
          </button>
          <button
            onClick={onConfirm}
            disabled={canceling}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {canceling ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Canceling...
              </span>
            ) : refundEligible ? (
              "Confirm Cancellation"
            ) : (
              "Cancel without refund"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
