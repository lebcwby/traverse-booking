"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO, isAfter, startOfToday } from "date-fns";
import { ChevronRight, Home, Loader2 } from "lucide-react";

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
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || "unknown").toLowerCase();
  let classes = "bg-muted text-muted-foreground";
  if (s === "confirmed") classes = "bg-green-100 text-green-800";
  else if (s === "canceled" || s === "cancelled")
    classes = "bg-red-100 text-red-800";

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function formatDateRange(
  checkIn: string | null,
  checkOut: string | null
): string {
  if (!checkIn || !checkOut) return "Dates TBD";
  const inDate = parseISO(checkIn);
  const outDate = parseISO(checkOut);
  const inYear = inDate.getFullYear();
  const outYear = outDate.getFullYear();
  if (inYear === outYear) {
    return `${format(inDate, "MMM d")} \u2013 ${format(outDate, "MMM d, yyyy")}`;
  }
  return `${format(inDate, "MMM d, yyyy")} \u2013 ${format(outDate, "MMM d, yyyy")}`;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReservations() {
      try {
        const res = await fetch("/api/account/reservations");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to load reservations");
        const data = await res.json();
        setReservations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    fetchReservations();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <p className="text-center text-muted-foreground">{error}</p>
      </div>
    );
  }

  const today = startOfToday();
  const isCanceled = (r: Reservation) => {
    const s = r.status?.toLowerCase();
    return s === "canceled" || s === "cancelled";
  };
  const upcoming = reservations
    .filter(
      (r) =>
        !isCanceled(r) && r.check_in && isAfter(parseISO(r.check_in), today)
    )
    .sort((a, b) => {
      if (!a.check_in || !b.check_in) return 0;
      return parseISO(a.check_in).getTime() - parseISO(b.check_in).getTime();
    });
  // Past includes anything that's not upcoming: actual past stays AND any
  // canceled reservation regardless of check-in date. Without this, a
  // canceled future reservation falls into neither bucket and disappears.
  const past = reservations.filter(
    (r) => isCanceled(r) || !r.check_in || !isAfter(parseISO(r.check_in), today)
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Trips</h1>

      {upcoming.length === 0 ? (
        /* Empty / no-upcoming state — Airbnb-style illustration layout */
        <div className="mt-10 flex flex-col items-center gap-10 sm:flex-row sm:items-start sm:gap-16">
          {/* Illustration: stacked cards with timeline dots */}
          <div className="relative w-64 shrink-0">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />
            <div className="space-y-4 pl-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="relative flex items-center gap-4">
                  <div className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  <div className="ml-4 flex h-16 flex-1 items-center gap-3 rounded-xl border border-border bg-white px-3 shadow-sm">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className={`h-2.5 rounded bg-muted ${i === 0 ? "w-3/4" : i === 1 ? "w-full" : "w-2/3"}`}
                      />
                      <div
                        className={`h-2 rounded bg-muted/60 ${i === 0 ? "w-1/2" : i === 1 ? "w-3/5" : "w-2/5"}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text + CTA */}
          <div className="text-center sm:text-left sm:pt-4">
            <h2 className="text-xl font-semibold text-foreground">
              Build the perfect trip
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Explore homes, experiences, and services. When you book, your
              reservations will show up here.
            </p>
            <Link
              href="/properties"
              className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-foreground">Upcoming</h2>
          <div className="mt-4 space-y-4">
            {upcoming.map((r) => (
              <ReservationCard key={r.reservation_id} reservation={r} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <Link
          href="/account/settings?section=trips"
          className="mt-12 flex items-center justify-between rounded-xl bg-muted/50 px-5 py-4 transition-colors hover:bg-muted"
        >
          <span className="text-sm font-medium text-foreground">
            Find past trips in your profile
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  const r = reservation;
  return (
    <Link
      href={`/account/reservations/${r.reservation_id}`}
      className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
    >
      {r.listing_photo ? (
        <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-md">
          <Image
            src={r.listing_photo}
            alt={r.listing_name || "Property"}
            fill
            className="object-cover"
            sizes="112px"
          />
        </div>
      ) : (
        <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center rounded-md bg-muted">
          <Home className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">
          {r.listing_name || "Property"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateRange(r.check_in, r.check_out)}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {r.confirmation_code && (
            <span className="text-xs text-muted-foreground">
              Confirmation: {r.confirmation_code}
            </span>
          )}
          <StatusBadge status={r.status} />
        </div>
      </div>
    </Link>
  );
}
