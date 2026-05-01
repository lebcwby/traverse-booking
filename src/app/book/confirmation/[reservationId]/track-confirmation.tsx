"use client";

import { useEffect } from "react";
import { identifyUser, trackBookingCompleted } from "@/lib/tracking";
import {
  readConfirmationSession,
  updateConfirmationSession,
} from "./lib/confirmation-session";

export function TrackConfirmation({
  reservationId,
}: {
  reservationId: string;
}) {
  // Scroll-restoration leak: navigating from /book/[quoteId] (which the user
  // may have scrolled down) to the confirmation page can land mid-page. Force
  // top-of-page on mount.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const session = readConfirmationSession(reservationId);
    if (!session || session.tracked) return;

    const {
      reservationId: sessionReservationId,
      listingId,
      listingTitle,
      checkIn,
      checkOut,
      guests,
      totalPaid,
      guestEmail,
      guestPhone,
      guestFirstName,
      guestLastName,
      guestPostalCode,
      guestCountry,
      eventId,
    } = session;

    if (
      !listingId ||
      !listingTitle ||
      !checkIn ||
      !checkOut ||
      typeof guests !== "number" ||
      typeof totalPaid !== "number"
    ) {
      return;
    }

    if (guestEmail) {
      try {
        identifyUser(guestEmail, guestPhone, guestFirstName, guestLastName);
      } catch {
        // Klaviyo identify failure must not block conversion tracking
      }
    }

    trackBookingCompleted({
      listingId,
      listingTitle,
      checkIn,
      checkOut,
      guests,
      total: totalPaid,
      reservationId: sessionReservationId || reservationId,
      guestEmail,
      guestPhone,
      guestFirstName,
      guestLastName,
      guestPostalCode,
      guestCountry,
      eventId,
    });

    updateConfirmationSession({ tracked: true });
  }, [reservationId]);

  return null;
}
