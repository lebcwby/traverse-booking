import type { Metadata } from "next";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Book Traverse collects, uses, and protects your personal information.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      <p className="mt-3 text-muted-foreground">Last updated: February 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Information We Collect
          </h2>
          <p className="mt-2">
            When you make a reservation or interact with our website, we may
            collect the following information:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Name, email address, phone number, and mailing address</li>
            <li>
              Payment information (processed securely via our payment providers)
            </li>
            <li>
              Booking details including dates, guest count, and property
              preferences
            </li>
            <li>Communications you send to us</li>
            <li>
              Device and browser information, IP address, and usage data
              collected via cookies
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. How We Use Your Information
          </h2>
          <p className="mt-2">We use your personal information to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Process and manage your reservations</li>
            <li>
              Communicate booking confirmations, check-in instructions, and
              updates
            </li>
            <li>Process payments and prevent fraud</li>
            <li>Respond to your inquiries and provide customer support</li>
            <li>Improve our website, services, and guest experience</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Information Sharing
          </h2>
          <p className="mt-2">
            We do not sell your personal information. We may share it with
            trusted third parties only as necessary to provide our services:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Payment processors (Stripe) for secure transaction handling</li>
            <li>Property management platforms for booking coordination</li>
            <li>
              Service providers who assist with cleaning, maintenance, or guest
              communication
            </li>
            <li>Legal authorities when required by law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Cookies & Tracking
          </h2>
          <p className="mt-2">
            Our website uses cookies and similar technologies to enhance your
            browsing experience, analyze site traffic, and understand how
            visitors interact with our site. You can manage cookie preferences
            through your browser settings. Disabling cookies may affect certain
            features of our website.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Data Security
          </h2>
          <p className="mt-2">
            We implement reasonable technical and organizational measures to
            protect your personal information against unauthorized access,
            alteration, or destruction. Payment information is processed through
            PCI-compliant payment providers and is never stored on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Data Retention
          </h2>
          <p className="mt-2">
            We retain your personal information for as long as necessary to
            fulfill the purposes for which it was collected, including to
            satisfy legal, accounting, or reporting requirements. Booking
            records are typically retained for seven years.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Your Rights
          </h2>
          <p className="mt-2">
            You have the right to access, correct, or request deletion of your
            personal information. You may also opt out of marketing
            communications at any time. To exercise any of these rights, please
            contact us at{" "}
            <TrackedContactLink
              href="mailto:bookings@traversehospitality.com"
              className="text-primary hover:underline"
            >
              bookings@traversehospitality.com
            </TrackedContactLink>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Children&apos;s Privacy
          </h2>
          <p className="mt-2">
            Our services are not directed to individuals under the age of 18. We
            do not knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated revision date. Your continued
            use of our services after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy or how we handle
            your data, please contact us at{" "}
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
