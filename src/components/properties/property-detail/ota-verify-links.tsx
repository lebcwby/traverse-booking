"use client";

// "See for yourself" — deep-links to the SAME home on Airbnb / Vrbo /
// Booking.com with the guest's picked dates pre-filled, so they can verify our
// direct price is lower on the OTA's own page. Reads the selected dates from the
// booking date-range context, so the links update as the guest changes dates.

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useDateRange } from "./date-range-context";
import { buildOtaDeepLinks, type OtaBaseLinks } from "@/lib/ota-links";
import { trackCompareOnOta } from "@/lib/tracking";

export function OtaVerifyLinks({ listingId }: { listingId: string }) {
  const { dateRange, guests } = useDateRange();
  const [raw, setRaw] = useState<OtaBaseLinks | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/listings/${listingId}/ota-links`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: OtaBaseLinks | null) => {
        if (!cancelled && d) setRaw(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!raw || (!raw.airbnb && !raw.vrbo && !raw.booking)) return null;

  const checkIn = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const checkOut = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
  const links = buildOtaDeepLinks(raw, { checkIn, checkOut, guests });

  const items = [
    links.airbnb ? { name: "Airbnb", url: links.airbnb } : null,
    links.vrbo ? { name: "Vrbo", url: links.vrbo } : null,
    links.booking ? { name: "Booking.com", url: links.booking } : null,
  ].filter((x): x is { name: string; url: string } => x !== null);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-semibold text-foreground">
        Don&apos;t take our word for it
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        See the exact same home for your dates on the big sites — then come back
        and book direct, no booking fees.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <a
            key={it.name}
            href={it.url}
            target="_blank"
            // nofollow + sponsored: comparison links, don't pass SEO equity.
            rel="noopener noreferrer nofollow sponsored"
            onClick={() => trackCompareOnOta(it.name, listingId)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Compare on {it.name}
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}
