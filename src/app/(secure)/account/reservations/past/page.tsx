"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO, isAfter, startOfToday } from "date-fns";
import { ChevronLeft, Home, Loader2 } from "lucide-react";

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

export default function PastTripsPage() {
  const [past, setPast] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReservations() {
      try {
        const res = await fetch("/api/account/reservations");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) return;
        const data: Reservation[] = await res.json();
        const today = startOfToday();
        const pastTrips = data.filter(
          (r) =>
            r.status?.toLowerCase() !== "canceled" &&
            r.status?.toLowerCase() !== "cancelled" &&
            (!r.check_in || !isAfter(parseISO(r.check_in), today))
        );
        setPast(pastTrips);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchReservations();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <Link
        href="/account/reservations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Trips
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        Past trips
      </h1>

      {past.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No past trips.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {past.map((r) => (
            <Link
              key={r.reservation_id}
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
          ))}
        </div>
      )}
    </div>
  );
}
