import type { Metadata } from "next";
import Link from "next/link";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for booking with Book Traverse.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Terms & Conditions
      </h1>
      <p className="mt-3 text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Agreement to Terms
          </h2>
          <p className="mt-2">
            By making a reservation through Book Traverse (&quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these
            Terms & Conditions. If you do not agree, please do not complete your
            booking. These terms apply to all bookings made through
            booktraverse.com and any related services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Booking & Payment
          </h2>
          <p className="mt-2">
            A reservation is confirmed once full payment has been received and
            you have received a confirmation email. All prices are listed in US
            dollars and include applicable taxes and fees unless otherwise
            stated. We reserve the right to cancel any booking that cannot be
            verified or that we suspect may be fraudulent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Check-In & Check-Out
          </h2>
          <p className="mt-2">
            Standard check-in time is 4:00 PM and check-out time is 10:00 AM
            local time unless otherwise communicated. Early check-in or late
            check-out may be available upon request and is not guaranteed. You
            will receive detailed access instructions prior to your arrival.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. House Rules
          </h2>
          <p className="mt-2">
            Guests must comply with all house rules provided for the property,
            including but not limited to noise restrictions, maximum occupancy
            limits, pet policies, and smoking prohibitions. Violation of house
            rules may result in immediate termination of your stay without
            refund.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Property Care & Damages
          </h2>
          <p className="mt-2">
            You are responsible for leaving the property in a reasonably clean
            and undamaged condition. Any damages, excessive cleaning
            requirements, or missing items will be assessed and charged to the
            payment method on file. We reserve the right to charge a damage
            deposit or hold a security authorization on your card prior to or
            during your stay.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Liability
          </h2>
          <p className="mt-2">
            Book Traverse shall not be liable for any loss, injury, or damage to
            persons or property during your stay, except where caused by our
            gross negligence. This includes but is not limited to theft,
            accidents, natural events, or utility interruptions. Guests are
            encouraged to carry personal travel insurance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Force Majeure
          </h2>
          <p className="mt-2">
            We shall not be held responsible for failure to perform any
            obligation under these terms due to causes beyond our reasonable
            control, including natural disasters, government actions, pandemics,
            or other extraordinary events.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Modifications
          </h2>
          <p className="mt-2">
            We reserve the right to update these terms at any time. Changes will
            be effective upon posting to this page. Your continued use of our
            services after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        {/* Required for A2P 10DLC / TCPA registration. Carriers check the
            Terms for four things specifically: who is texting and why,
            STOP/HELP instructions, a carrier liability disclaimer, and message
            frequency plus rates — with a link to the Privacy Policy. All four
            are below; do not thin this section out.
            (A2P Compliance Guide, April 2026, Step 6.) */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. SMS &amp; Text Messaging
          </h2>
          <p className="mt-2">
            Traverse Hospitality manages short-term rental properties in
            Colorado. If you give us your mobile number and tick the relevant
            box, we may text you about your enquiry, your reservation or your
            property — for example confirmations, arrival details, appointment
            reminders and replies to questions you have asked us. Ticking the
            separate marketing box also allows us to send occasional offers and
            announcements.
          </p>
          <p className="mt-3">
            Consent is optional and is never a condition of booking or of any
            purchase. Notification and marketing consents are collected
            separately, and neither is ticked for you.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Stopping messages.</strong> You
            can cancel SMS messages at any time by replying{" "}
            <strong className="text-foreground">STOP</strong>. We will confirm
            your unsubscription and you will not receive further messages. To
            re-subscribe, simply sign up again. For help, reply{" "}
            <strong className="text-foreground">HELP</strong> or contact us at{" "}
            <TrackedContactLink
              href="mailto:bookings@traversehospitality.com"
              className="text-primary hover:underline"
            >
              bookings@traversehospitality.com
            </TrackedContactLink>
            .
          </p>
          <p className="mt-3">
            <strong className="text-foreground">
              Message frequency and rates.
            </strong>{" "}
            Message and data rates may apply. Message frequency varies. You are
            responsible for any messaging or data fees charged by your carrier.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Carriers.</strong> Carriers are
            not liable for delayed or undelivered messages.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">Privacy.</strong> For
            privacy-related questions, please review our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Governing Law
          </h2>
          <p className="mt-2">
            These terms shall be governed by and construed in accordance with
            the laws of the State of Colorado, without regard to its conflict
            of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">11. Contact</h2>
          <p className="mt-2">
            If you have any questions about these terms, please contact us at{" "}
            <TrackedContactLink
              href="mailto:bookings@traversehospitality.com"
              className="text-primary hover:underline"
            >
              bookings@traversehospitality.com
            </TrackedContactLink>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
