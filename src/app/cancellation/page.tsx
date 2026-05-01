import type { Metadata } from "next";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "Cancellation and refund policy for Book Traverse reservations.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/cancellation" },
};

export default function CancellationPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Cancellation Policy
      </h1>
      <p className="mt-3 text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Semi-Flexible Cancellation Policy
          </h2>
          <p className="mt-2">
            We understand that plans can change. Guests may cancel for a full
            refund up to 48 hours before check-in. After that, the reservation
            is non-refundable. These terms apply to all reservations made
            through Book Traverse unless otherwise specified at the time of
            booking.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Cancellation Windows
          </h2>
          <div className="mt-3 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">
                More than 48 hours before check-in
              </p>
              <p className="mt-1">Full refund.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">
                Less than 48 hours before check-in
              </p>
              <p className="mt-1">
                No refund. The full reservation amount is non-refundable.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            How to Cancel
          </h2>
          <p className="mt-2">
            To cancel your reservation, please contact us as soon as possible at{" "}
            <TrackedContactLink
              href="mailto:hello@booktraverse.com"
              className="text-primary hover:underline"
            >
              hello@booktraverse.com
            </TrackedContactLink>{" "}
            or call{" "}
            <TrackedContactLink
              href="tel:+19713624726"
              className="text-primary hover:underline"
            >
              (971) 362-4726
            </TrackedContactLink>
            . Cancellations are effective as of the date we receive your
            request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Early Departures
          </h2>
          <p className="mt-2">
            If you choose to leave before your scheduled check-out date, no
            refund will be provided for the unused nights.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">No-Shows</h2>
          <p className="mt-2">
            If you do not check in on your scheduled arrival date and do not
            contact us, the reservation will be treated as a no-show and no
            refund will be issued.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Modifications
          </h2>
          <p className="mt-2">
            Date changes and other modifications are subject to availability and
            may result in a price adjustment. Please contact us to discuss any
            changes to your reservation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Extenuating Circumstances
          </h2>
          <p className="mt-2">
            In cases of documented emergencies, natural disasters, or
            government-imposed travel restrictions, we may offer modified
            cancellation terms at our discretion. Please contact us to discuss
            your situation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Third-Party Bookings
          </h2>
          <p className="mt-2">
            Reservations made through third-party platforms (Airbnb, VRBO,
            Booking.com, etc.) are subject to the cancellation policies of those
            platforms. Please refer to the platform through which you booked for
            their specific terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            Questions about our cancellation policy? Reach out at{" "}
            <TrackedContactLink
              href="mailto:hello@booktraverse.com"
              className="text-primary hover:underline"
            >
              hello@booktraverse.com
            </TrackedContactLink>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
