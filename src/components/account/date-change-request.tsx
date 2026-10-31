"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { resolveCheckInDate } from "@/lib/cancellation-policy";
import {
  DATE_CHANGE_REQUEST_LEAD,
  dateChangePriceCopy,
  formatStayDate,
} from "@/lib/date-change-requests";

interface PendingRequest {
  id: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  note: string | null;
  createdAt: string;
}

/**
 * Ask the team to move a stay. The form never quotes a price, collects a
 * card, or tells the guest the dates have changed.
 */
export function DateChangeRequest({
  reservationId,
  currentCheckIn,
  currentCheckOut,
}: {
  reservationId: string;
  currentCheckIn: string;
  currentCheckOut: string;
}) {
  const checkIn = resolveCheckInDate(currentCheckIn);
  const checkOut = resolveCheckInDate(currentCheckOut);
  const [requestedCheckIn, setRequestedCheckIn] = useState(checkIn ?? "");
  const [requestedCheckOut, setRequestedCheckOut] = useState(checkOut ?? "");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<PendingRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/account/reservations/${reservationId}/extend`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { request: PendingRequest | null };
        if (!cancelled && data.request) setPending(data.request);
      } catch {
        // The form still submits if the lookup fails.
      } finally {
        if (!cancelled) setLoadingPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/account/reservations/${reservationId}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            requestedCheckIn,
            requestedCheckOut,
            note,
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        requestId?: string;
        requestedCheckIn?: string;
        requestedCheckOut?: string;
        note?: string | null;
      };
      if (!res.ok) {
        setError(data.error || "We couldn't send that request.");
        return;
      }
      const next: PendingRequest = {
        id: data.requestId || "pending",
        requestedCheckIn: data.requestedCheckIn || requestedCheckIn,
        requestedCheckOut: data.requestedCheckOut || requestedCheckOut,
        note: data.note ?? (note.trim() || null),
        createdAt: new Date().toISOString(),
      };
      setSubmitted(next);
      setPending(next);
    } catch {
      setError("We couldn't send that request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = submitted ?? pending;

  return (
    <section className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">
          Request a date change
        </h2>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {DATE_CHANGE_REQUEST_LEAD}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {dateChangePriceCopy(checkIn)}
      </p>

      {checkIn && checkOut && (
        <p className="mt-4 text-sm text-foreground">
          <span className="text-muted-foreground">Current stay: </span>
          {formatStayDate(checkIn)} – {formatStayDate(checkOut)}
        </p>
      )}

      {loadingPending ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for an open request
        </div>
      ) : shown && !submitted ? (
        <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
          You already have a request in for{" "}
          {formatStayDate(shown.requestedCheckIn)} –{" "}
          {formatStayDate(shown.requestedCheckOut)}. Sending another one
          replaces it. Your reservation is unchanged until the team approves it.
        </p>
      ) : null}

      {submitted ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-medium">Request sent.</p>
          <p className="mt-1">
            You asked for {formatStayDate(submitted.requestedCheckIn)} –{" "}
            {formatStayDate(submitted.requestedCheckOut)}. Your dates stay{" "}
            {checkIn && checkOut
              ? `${formatStayDate(checkIn)} – ${formatStayDate(checkOut)}`
              : "as booked"}{" "}
            until the team approves this or contacts you. Nothing has been
            charged or refunded.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(null)}
            className="mt-3 text-sm font-medium text-green-900 underline"
          >
            Send a different request
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-foreground">
                Requested check-in
              </span>
              <input
                type="date"
                required
                value={requestedCheckIn}
                onChange={(event) => setRequestedCheckIn(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">
                Requested check-out
              </span>
              <input
                type="date"
                required
                value={requestedCheckOut}
                min={requestedCheckIn || undefined}
                onChange={(event) => setRequestedCheckOut(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-foreground">
              Note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Anything the team should know about the change."
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit request
          </button>
        </form>
      )}
    </section>
  );
}
