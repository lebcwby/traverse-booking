import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refer an owner",
  description:
    "Refer a vacation rental owner to Traverse Hospitality. Submit a referral and earn when they sign on for management.",
  alternates: { canonical: "https://www.booktraverse.com/referrals-form" },
  // Internal form — don't surface in social cards or search results.
  robots: { index: false, follow: false },
};

export default function ReferralsFormPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
          Refer an owner to Traverse
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Know a Colorado vacation rental owner who could use full-service
          management? Send them our way.
        </p>
      </header>
      <iframe
        src="https://team.traversehospitality.com/refer"
        title="Refer an owner to Traverse"
        loading="lazy"
        style={{
          border: 0,
          width: "100%",
          maxWidth: "680px",
          height: "900px",
          display: "block",
          margin: "0 auto",
        }}
      />
    </main>
  );
}
