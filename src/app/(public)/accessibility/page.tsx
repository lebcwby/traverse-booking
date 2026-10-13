import type { Metadata } from "next";
import { TrackedContactLink } from "@/components/analytics/tracked-contact-link";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "Book Traverse's commitment to digital accessibility for all users.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Accessibility Statement
      </h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Our Commitment
          </h2>
          <p className="mt-2">
            Book Traverse is committed to ensuring digital accessibility for
            people with disabilities. We continually improve the user experience
            for everyone and apply the relevant accessibility standards to make
            sure we provide equal access to all users.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Standards</h2>
          <p className="mt-2">
            We aim to conform to the Web Content Accessibility Guidelines (WCAG)
            2.1 at Level AA. These guidelines explain how to make web content
            more accessible to people with a wide array of disabilities,
            including visual, auditory, physical, speech, cognitive, language,
            learning, and neurological disabilities.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Features</h2>
          <p className="mt-2">
            Our website includes the following accessibility features:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Semantic HTML to convey meaning and structure</li>
            <li>Keyboard navigation support throughout the site</li>
            <li>
              Screen reader compatibility with ARIA labels where appropriate
            </li>
            <li>
              Responsive design that adapts to different screen sizes and zoom
              levels
            </li>
            <li>
              Sufficient color contrast ratios for text and interactive elements
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Feedback</h2>
          <p className="mt-2">
            If you encounter accessibility barriers on our website, please let
            us know. We take your feedback seriously and will work to address
            concerns promptly.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Email:{" "}
              <TrackedContactLink
                href="mailto:bookings@traversehospitality.com"
                className="text-primary hover:underline"
              >
                bookings@traversehospitality.com
              </TrackedContactLink>
            </li>
            <li>
              Phone:{" "}
              <TrackedContactLink
                href="tel:+17207592013"
                className="text-primary hover:underline"
              >
                (720) 759-2013
              </TrackedContactLink>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Continuous Improvement
          </h2>
          <p className="mt-2">
            We regularly review our website for accessibility and work to
            remediate any issues we identify. Our goal is to ensure that all
            visitors can access, navigate, and interact with our site
            effectively regardless of ability or assistive technology.
          </p>
        </section>
      </div>
    </div>
  );
}
