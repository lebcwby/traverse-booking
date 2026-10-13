import type { Metadata } from "next";
import { getBreadcrumbSchema, JsonLd } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Property Management in Colorado",
  description:
    "Find out how much your property can earn. Full-service short-term rental management across Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes — higher earnings, 24/7 local care, and 50+ distribution channels.",
  alternates: { canonical: "/property-management" },
};

const breadcrumbSchema = getBreadcrumbSchema([
  { name: "Traverse Hospitality", url: "https://www.booktraverse.com" },
  {
    name: "Property Management",
    url: "https://www.booktraverse.com/property-management",
  },
]);

export default function PropertyManagementLayout({
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
