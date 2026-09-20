import type { Metadata } from "next";
import Link from "next/link";
import { reportBody } from "./report-body";
import "../blog/blog-content.css";

// Report page for the Summer 2026 Market Snapshot: the report in its own
// voice (report-body.ts), plus the chart, headline figures, the PDF, and the
// Willow Fire note the PDF predates. The press release that announces it is a
// different text at /press/summer-2026-market-snapshot; keep them different —
// two identical bodies on one domain get folded together by Google.
//
// The four figures below are the report's own (pages 2 and 4). If the PDF is
// ever reissued, change them here and in the press release together.

const URL = "https://www.booktraverse.com/summer-2026-market-snapshot";
const PDF = "/reports/Traverse_Summer_2026_Market_Snapshot.pdf";
const CHART = "/press/summer-2026-revpar-vs-market.png";
const PUBLISHED = "2026-09-20";

const STATS = [
  {
    value: "+3.3%",
    label: "Revenue per available night vs. summer 2025",
    note: "Competitive sets: −10.6%",
  },
  {
    value: "+7.8%",
    label: "Average nightly rate vs. summer 2025",
    note: "Competitive sets: roughly flat",
  },
  {
    value: "71.8%",
    label: "Summer occupancy, June–August",
    note: "Competitive sets: about 62%",
  },
  {
    value: "4.88",
    label: "Average guest rating, August 2026",
    note: "All channels, all homes",
  },
];

export const metadata: Metadata = {
  // Layout title template appends " | Traverse Hospitality".
  title: "Summer 2026 Market Snapshot",
  description:
    "Traverse Hospitality's Summer 2026 Market Snapshot: managed homes grew revenue per available night 3.3% while Colorado mountain competitive sets fell 10.6%. Month-by-month data, methodology, and full PDF.",
  alternates: { canonical: URL },
  openGraph: {
    type: "article",
    url: URL,
    title: "Summer 2026 Market Snapshot | Traverse Hospitality",
    description:
      "Managed homes grew revenue per available night 3.3% while Colorado mountain competitive sets fell 10.6%. Month-by-month data, methodology, and full PDF.",
    images: [{ url: "/press/summer-2026-revpar-vs-market.jpg", width: 1200, height: 675 }],
    publishedTime: PUBLISHED,
  },
  twitter: {
    card: "summary_large_image",
    title: "Summer 2026 Market Snapshot | Traverse Hospitality",
    description:
      "Managed homes grew revenue per available night 3.3% while competitive sets fell 10.6%.",
    images: ["/press/summer-2026-revpar-vs-market.jpg"],
  },
};

export default function MarketSnapshotPage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Report",
      "@id": `${URL}#report`,
      name: "Traverse Hospitality — Summer 2026 Market Snapshot",
      headline:
        "Summer 2026 Market Snapshot: how the mountain short-term rental market moved, and how Traverse-managed homes performed against it",
      description:
        "An eight-page report on the Colorado mountain short-term rental market for June–August 2026. Traverse-managed homes with a full prior-year history grew revenue per available night 3.3% while their PriceLabs competitive sets fell 10.6%.",
      url: URL,
      datePublished: PUBLISHED,
      dateModified: PUBLISHED,
      inLanguage: "en-US",
      about: [
        "short-term rental market",
        "vacation rental revenue",
        "Crested Butte, Colorado",
        "Leadville, Colorado",
      ],
      author: { "@id": "https://www.booktraverse.com/#organization" },
      publisher: { "@id": "https://www.booktraverse.com/#organization" },
      image: `https://www.booktraverse.com${CHART}`,
      encoding: {
        "@type": "MediaObject",
        contentUrl: `https://www.booktraverse.com${PDF}`,
        encodingFormat: "application/pdf",
        name: "Traverse_Summer_2026_Market_Snapshot.pdf",
      },
      mainEntityOfPage: URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.booktraverse.com/" },
        { "@type": "ListItem", position: 2, name: "Press", item: "https://www.booktraverse.com/press" },
        { "@type": "ListItem", position: 3, name: "Summer 2026 Market Snapshot", item: URL },
      ],
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* ═══ HEADER ═══ */}
      <div style={{ background: "#14142b", color: "#fff" }}>
        <div style={{ maxWidth: "780px", margin: "0 auto", padding: "56px 24px 44px" }}>
          <nav style={{ fontSize: "13px", marginBottom: "20px", opacity: 0.55 }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
              Home
            </Link>
            {" / "}
            <Link href="/press" style={{ color: "#fff", textDecoration: "none" }}>
              Press
            </Link>
          </nav>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#5eead4",
                border: "1px solid rgba(94,234,212,0.35)",
                padding: "5px 11px",
                borderRadius: "999px",
              }}
            >
              Market report
            </span>
            <span style={{ fontSize: "14px", opacity: 0.7 }}>
              Published September 20, 2026 · Data through August 31, 2026
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "clamp(30px, 4.8vw, 44px)",
              fontWeight: 800,
              lineHeight: 1.15,
              margin: "0 0 18px",
              letterSpacing: "-0.02em",
            }}
          >
            Summer 2026 Market Snapshot
          </h1>
          <p style={{ fontSize: "17.5px", lineHeight: 1.65, margin: 0, opacity: 0.82 }}>
            How the mountain short-term rental market moved this summer, how
            Traverse-managed homes performed against it, and the practices behind
            the results. Originally prepared for Traverse owners; published in
            full.
          </p>
        </div>
      </div>

      {/* ═══ CHART ═══ */}
      <div style={{ background: "#14142b" }}>
        <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CHART}
            alt="Bar chart: revenue per available night, change vs. summer 2025. Traverse-managed homes +14.5% in June, −5.1% in July, +6.3% in August, +3.3% for the summer; their competitive sets −4.3%, −14.3%, −9.8%, and −10.6%."
            style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
          />
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 24px 24px" }}>
        <p
          style={{
            fontSize: "13.5px",
            lineHeight: 1.6,
            color: "#64748b",
            margin: "0 0 36px",
          }}
        >
          Revenue per available night, change vs. summer 2025: Traverse-managed
          homes with a full prior-year history vs. their PriceLabs competitive
          sets, June–August 2026. Source: Traverse Hospitality Summer 2026 Market
          Snapshot; PriceLabs Portfolio Analytics.
        </p>

        {/* Headline figures */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            margin: "0 0 44px",
          }}
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                border: "1px solid #e2e8f0",
                borderLeft: "4px solid #0f766e",
                borderRadius: "12px",
                background: "#f8fafc",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "30px",
                  fontWeight: 800,
                  lineHeight: 1,
                  color: "#1e293b",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: "13.5px", lineHeight: 1.4, color: "#334155", marginTop: "6px" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px" }}>{s.note}</div>
            </div>
          ))}
        </div>

        {/* Download */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "20px 22px",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            background: "#fff",
            margin: "0 0 44px",
          }}
        >
          <div style={{ flex: "1 1 260px" }}>
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "17px",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              Read the full report
            </div>
            <div style={{ fontSize: "14px", color: "#64748b", marginTop: "2px" }}>
              Eight pages, PDF, with methodology and sources on the last page.
            </div>
          </div>
          <a
            href={PDF}
            download="Traverse_Summer_2026_Market_Snapshot.pdf"
            style={{
              display: "inline-block",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              padding: "12px 20px",
              borderRadius: "10px",
              textDecoration: "none",
            }}
          >
            Download the PDF
          </a>
        </div>

        <div className="blog-content" dangerouslySetInnerHTML={{ __html: reportBody }} />

        {/* Note added at publication */}
        <div
          style={{
            marginTop: "40px",
            padding: "18px 22px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            fontSize: "15px",
            lineHeight: 1.65,
            color: "#7c5e10",
          }}
        >
          <strong>Note added at publication.</strong> The PDF below was written
          for Traverse owners before the Willow Fire's effect on Leadville could
          be separated out in the data. The human-caused Willow Fire started June 28
          west of town, grew past 7,000 acres, kept evacuation orders in place
          from July 5 to July 30 and closed the airport to all but medical
          flights. Competitive sets around our Leadville one-bedroom homes lost
          about 20% of their revenue per available night for the summer, roughly
          double the decline across all Traverse markets; Traverse-managed
          Leadville one-bedrooms finished essentially flat (+1.7%) over the same
          June 1 – August 31 window, from the same PriceLabs source.
        </div>

        {/* PDF embed */}
        <div style={{ marginTop: "44px" }}>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 14px",
            }}
          >
            The report
          </h2>
          <object
            data={PDF}
            type="application/pdf"
            aria-label="Summer 2026 Market Snapshot, PDF"
            style={{
              width: "100%",
              height: "780px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              display: "block",
            }}
          >
            <p style={{ fontSize: "15px", color: "#334155" }}>
              Your browser can&apos;t display the PDF inline.{" "}
              <a href={PDF} style={{ color: "#0f766e", fontWeight: 600 }}>
                Download the Summer 2026 Market Snapshot
              </a>
              .
            </p>
          </object>
        </div>

        <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: "1px solid #e2e8f0" }}>
          <Link href="/press/summer-2026-market-snapshot" style={{ color: "#0f766e", fontWeight: 600, fontSize: "15px" }}>
            Read the announcement →
          </Link>
          <span style={{ color: "#94a3b8" }}> · </span>
          <Link href="/press" style={{ color: "#0f766e", fontWeight: 600, fontSize: "15px" }}>
            All press releases
          </Link>
        </div>
      </div>
    </div>
  );
}
