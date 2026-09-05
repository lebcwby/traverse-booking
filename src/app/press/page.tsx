import type { Metadata } from "next";
import Link from "next/link";
import {
  PRESS_RELEASES,
  getReleasesByDate,
  formatReleaseDate,
} from "./releases";

const URL = "https://www.booktraverse.com/press";

export const metadata: Metadata = {
  // Layout title template appends " | Traverse Hospitality" — don't repeat it.
  title: "Press Room",
  description:
    "Company news and press releases from Traverse Hospitality, a Colorado-owned vacation rental and property management company in Crested Butte, Leadville, Vail, Avon, Granby, and Twin Lakes.",
  alternates: { canonical: URL },
  openGraph: {
    type: "website",
    url: URL,
    title: "Press Room",
    description:
      "Company news and press releases from Traverse Hospitality.",
    images: [{ url: "/press/grand-lodge-crested-butte.jpg" }],
  },
};

export default function PressPage() {
  const releases = getReleasesByDate();
  const [latest, ...rest] = releases;

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${URL}#collectionpage`,
    name: "Press Room — Traverse Hospitality",
    url: URL,
    publisher: { "@id": "https://www.booktraverse.com/#organization" },
    hasPart: PRESS_RELEASES.map((r) => ({
      "@type": "NewsArticle",
      headline: r.headline,
      datePublished: r.date,
      url: `${URL}/${r.slug}`,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* ═══ HERO ═══ */}
      <div style={{ background: "#14142b", color: "#fff" }}>
        <div
          style={{
            maxWidth: "1040px",
            margin: "0 auto",
            padding: "72px 24px 64px",
          }}
        >
          <nav style={{ fontSize: "13px", marginBottom: "18px", opacity: 0.55 }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>
              Home
            </Link>
            {" / "}
            <span>Press</span>
          </nav>
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "clamp(36px, 6vw, 54px)",
              fontWeight: 800,
              lineHeight: 1.1,
              margin: "0 0 18px",
              letterSpacing: "-0.02em",
            }}
          >
            Press Room
          </h1>
          <p
            style={{
              fontSize: "18px",
              lineHeight: 1.65,
              maxWidth: "620px",
              margin: 0,
              opacity: 0.8,
            }}
          >
            Company news and announcements from Traverse Hospitality. For
            interviews, data, or photography, email{" "}
            <a
              href="mailto:press@traversehospitality.com"
              style={{ color: "#fff", textDecoration: "underline" }}
            >
              press@traversehospitality.com
            </a>
            .
          </p>
        </div>
      </div>

      <div
        style={{ maxWidth: "1040px", margin: "0 auto", padding: "56px 24px 80px" }}
      >
        {/* ═══ LATEST ═══ */}
        {latest && (
          <Link
            href={`/press/${latest.slug}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <article
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                overflow: "hidden",
                background: "#fff",
                marginBottom: "56px",
              }}
            >
              {latest.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latest.image}
                  alt={latest.imageAlt || latest.headline}
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 8.6",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
              <div style={{ padding: "34px 36px 38px" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "#0f766e",
                      background: "#ccfbf1",
                      padding: "5px 11px",
                      borderRadius: "999px",
                    }}
                  >
                    Latest release
                  </span>
                  <span style={{ fontSize: "14px", color: "#64748b" }}>
                    {formatReleaseDate(latest.date)}
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "clamp(23px, 3.2vw, 31px)",
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: "#1e293b",
                    margin: "0 0 14px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {latest.headline}
                </h2>
                <p
                  style={{
                    fontSize: "16.5px",
                    lineHeight: 1.65,
                    color: "#545b5f",
                    margin: "0 0 20px",
                  }}
                >
                  {latest.excerpt}
                </p>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#0f766e",
                  }}
                >
                  Read the full release →
                </span>
              </div>
            </article>
          </Link>
        )}

        {/* ═══ ARCHIVE ═══ */}
        {rest.length > 0 && (
          <>
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#64748b",
                margin: "0 0 8px",
              }}
            >
              Archive
            </h2>
            <div style={{ borderTop: "1px solid #e2e8f0" }}>
              {rest.map((r) => (
                <Link
                  key={r.slug}
                  href={`/press/${r.slug}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "26px 0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: "9px",
                    }}
                  >
                    <span style={{ fontSize: "14px", color: "#64748b" }}>
                      {formatReleaseDate(r.date)}
                    </span>
                    {r.legacyBrand && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#7c5e10",
                          background: "#fef3c7",
                          padding: "4px 10px",
                          borderRadius: "999px",
                        }}
                      >
                        Issued as {r.legacyBrand}
                      </span>
                    )}
                  </div>
                  <h3
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: "20px",
                      fontWeight: 700,
                      lineHeight: 1.32,
                      color: "#1e293b",
                      margin: "0 0 8px",
                    }}
                  >
                    {r.headline}
                  </h3>
                  <p
                    style={{
                      fontSize: "16px",
                      lineHeight: 1.62,
                      color: "#545b5f",
                      margin: 0,
                    }}
                  >
                    {r.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ═══ MEDIA CONTACT ═══ */}
        <div
          style={{
            marginTop: "56px",
            padding: "36px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "21px",
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 10px",
            }}
          >
            Media enquiries
          </h2>
          <p
            style={{
              fontSize: "16px",
              lineHeight: 1.65,
              color: "#545b5f",
              margin: "0 0 6px",
            }}
          >
            Traverse Hospitality · 11 Snowmass Road, Mt. Crested Butte, CO 81225
          </p>
          <p style={{ fontSize: "16px", lineHeight: 1.65, margin: 0 }}>
            <a
              href="mailto:press@traversehospitality.com"
              style={{ color: "#0f766e", fontWeight: 600 }}
            >
              press@traversehospitality.com
            </a>
            <span style={{ color: "#94a3b8" }}> · </span>
            <a
              href="tel:+19705333583"
              style={{ color: "#0f766e", fontWeight: 600 }}
            >
              (970) 533-3583
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
