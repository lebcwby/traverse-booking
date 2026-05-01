import type { Metadata } from "next";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "List Your Property | Book Traverse",
  description:
    "List your vacation rental on Book Traverse — a direct booking channel for Portland properties. No OTA commissions, SEO-driven traffic, and instant booking.",
  alternates: { canonical: "/list-your-property" },
};

const breadcrumbSchema = getBreadcrumbSchema([
  { name: "Book Traverse", url: "https://www.booktraverse.com" },
  {
    name: "List Your Property",
    url: "https://www.booktraverse.com/list-your-property",
  },
]);

export default function ListPropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
