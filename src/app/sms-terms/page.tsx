import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SMS Terms of Service",
  description:
    "SMS Terms of Service for Traverse Hospitality text message communications.",
  alternates: { canonical: "/sms-terms" },
};

export default function SmsTermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        SMS Terms of Service
      </h1>
      <p className="mt-3 text-muted-foreground">Last updated: June 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Program Description
          </h2>
          <p className="mt-2">
            By opting in to SMS communications from Traverse Hospitality
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you consent to
            receive text messages at the mobile number you provided. Messages
            may include:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Booking confirmations and reservation updates</li>
            <li>Check-in instructions and property access details</li>
            <li>Trip reminders and time-sensitive alerts</li>
            <li>Abandoned cart reminders for incomplete bookings</li>
            <li>
              Promotional offers, special rates, and marketing messages about
              Traverse Hospitality properties and services
            </li>
          </ul>
          <p className="mt-2">
            Messages are sent by Traverse Hospitality, operator of vacation
            rental properties in Colorado (Crested Butte, Leadville, Vail,
            Avon, Granby, and Twin Lakes). Our website is{" "}
            <Link href="/" className="text-primary hover:underline">
              www.booktraverse.com
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Message Frequency
          </h2>
          <p className="mt-2">
            Message frequency varies. Transactional messages are sent as needed
            in connection with your booking (typically 2–5 messages per
            reservation). Recurring marketing messages are sent periodically and
            may be up to 4 messages per month. We will not send more messages
            than necessary to fulfill the purposes described above.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. How to Stop (STOP Instructions)
          </h2>
          <p className="mt-2">
            You may opt out of SMS messages at any time. To stop receiving
            messages, reply <strong>STOP</strong> to any text message from us.
            After texting STOP, you will receive a single confirmation message
            and no further SMS messages will be sent to your number, except as
            required by law. You can re-enroll at any time by texting{" "}
            <strong>START</strong> to the same number.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. How to Get Help (HELP Instructions)
          </h2>
          <p className="mt-2">
            For help, reply <strong>HELP</strong> to any message or contact us
            directly:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              Email:{" "}
              <a
                href="mailto:bookings@traversehospitality.com"
                className="text-primary hover:underline"
              >
                bookings@traversehospitality.com
              </a>
            </li>
            <li>
              Phone:{" "}
              <a
                href="tel:+17207592013"
                className="text-primary hover:underline"
              >
                (720) 759-2013
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Message and Data Rates
          </h2>
          <p className="mt-2">
            Message and data rates may apply depending on your mobile carrier
            plan. Traverse Hospitality does not charge for SMS messages, but
            your carrier&apos;s standard messaging and data rates apply.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Carrier Liability Disclaimer
          </h2>
          <p className="mt-2">
            Carriers (such as AT&amp;T, Verizon, T-Mobile, and others) are not
            liable for delayed or undelivered messages. Traverse Hospitality is
            not responsible for any delays or failures in the transmission of
            SMS messages caused by your mobile carrier or network conditions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Privacy
          </h2>
          <p className="mt-2">
            Your mobile number and any information collected in connection with
            our SMS program is used only to send you messages described in this
            policy and is governed by our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            . We do not sell or share your mobile number with third parties for
            their own marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Eligibility
          </h2>
          <p className="mt-2">
            By opting in, you represent that you are the account holder or have
            the account holder&apos;s permission to enroll the mobile number
            you provided, and that you are at least 18 years of age.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Changes to These Terms
          </h2>
          <p className="mt-2">
            We may update these SMS Terms of Service from time to time. The
            &quot;Last updated&quot; date at the top of this page reflects the
            most recent revision. Continued use of our SMS program after changes
            are posted constitutes your acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Contact Us
          </h2>
          <p className="mt-2">
            For questions about these SMS Terms of Service, please contact us
            at{" "}
            <a
              href="mailto:bookings@traversehospitality.com"
              className="text-primary hover:underline"
            >
              bookings@traversehospitality.com
            </a>{" "}
            or call{" "}
            <a href="tel:+17207592013" className="text-primary hover:underline">
              (720) 759-2013
            </a>
            .
          </p>
        </section>

      </div>
    </div>
  );
}
