import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Do Not Sell or Share My Personal Information",
  description:
    "Opt out of the sale or sharing of your personal information under the California Consumer Privacy Act (CCPA).",
  robots: { index: false, follow: true },
  alternates: { canonical: "/do-not-sell" },
};

export default function DoNotSellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
