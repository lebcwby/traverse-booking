import type { Metadata } from "next";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Book Traverse. Questions about vacation rentals, bookings, or your upcoming stay? We're here to help.",
  alternates: { canonical: "/contact" },
};

// Contact info is static — safe to render as server-side JSON-LD in layout
// while the page itself remains a client component for form state
const contactSchema = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "@id": "https://www.booktraverse.com/#organization",
  name: "Book Traverse",
  url: "https://www.booktraverse.com",
  telephone: "+1-720-759-2013",
  email: "bookings@traversehospitality.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Leadville",
    addressRegion: "CO",
    postalCode: "80461",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-720-759-2013",
    email: "bookings@traversehospitality.com",
    contactType: "customer service",
    availableLanguage: "English",
  },
};

const breadcrumbSchema = getBreadcrumbSchema([
  { name: "Book Traverse", url: "https://www.booktraverse.com" },
  { name: "Contact Us", url: "https://www.booktraverse.com/contact" },
]);

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={contactSchema} />
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
