import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PRESS_RELEASES, getRelease, formatReleaseDate } from "../releases";
import "../../blog/blog-content.css";

export function generateStaticParams() {
  return PRESS_RELEASES.map((r) => ({ slug: r.slug }));
}

// Same reasoning as blog/[slug]: the release set is a static array, so
// generateStaticParams is exhaustive and an unknown slug can never become
// valid without a deploy. force-static + dynamicParams:false makes those a
// real routing-level 404 instead of a streamed 200 soft-404.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const release = getRelease(slug);
  if (!release) return {};
  const url = `https://www.booktraverse.com/press/${release.slug}`;
  const images = release.image ? [{ url: release.image }] : undefined;
  return {
    title: release.headline,
    description: release.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: release.headline,
      description: release.excerpt,
      ...(images ? { images } : {}),
      publishedTime: release.date,
    },
    twitter: {
      card: release.image ? "summary_large_image" : "summary",
      title: release.headline,
      description: release.excerpt,
      ...(release.image ? { images: [release.image] } : {}),
    },
  };
}

export default async function PressReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const release = getRelease(slug);
  if (!release) notFound();

  let content = "";
  try {
    const mod = await import(`../${slug}/content`);
    content = mod.pageContent || "";
  } catch {
    content = "";
  }

  const url = `https://www.booktraverse.com/press/${release.slug}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "@id": `${url}#newsarticle`,
      headline: release.headline,
      description: release.excerpt,
      ...(release.image
        ? { image: `https://www.booktraverse.com${release.image}` }
        : {}),
      datePublished: release.date,
      dateModified: release.date,
      author: {
        "@type": "Organization",
        name: release.legacyBrand || "Traverse Hospitality",
      },
      publisher: { "@id": "https://www.booktraverse.com/#organization" },
      mainEntityOfPage: url,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.booktraverse.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Press",
          item: "https://www.booktraverse.com/press",
        },
        { "@type": "ListItem", position: 3, name: release.headline, item: url },
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
        <div
          style={{
            maxWidth: "780px",
            margin: "0 auto",
            padding: "56px 24px 52px",
          }}
        >
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
              Press release
            </span>
            <span style={{ fontSize: "14px", opacity: 0.7 }}>
              {formatReleaseDate(release.date)}
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "clamp(27px, 4.4vw, 40px)",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: "0 0 20px",
              letterSpacing: "-0.02em",
            }}
          >
            {release.headline}
          </h1>

          {release.subheadline && (
            <p
              style={{
                fontSize: "17.5px",
                lineHeight: 1.65,
                margin: 0,
                opacity: 0.82,
              }}
            >
              {release.subheadline}
            </p>
          )}
        </div>
      </div>

      {/* ═══ COVER IMAGE ═══ */}
      {release.image && (
        <div style={{ background: "#14142b" }}>
          <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={release.image}
              alt={release.imageAlt || release.headline}
              style={{
                width: "100%",
                aspectRatio: "16 / 8.6",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ BODY ═══ */}
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "48px 24px 24px" }}>
        {release.legacyBrand && (
          <p
            style={{
              fontSize: "14.5px",
              lineHeight: 1.6,
              color: "#7c5e10",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "12px",
              padding: "14px 18px",
              margin: "0 0 32px",
            }}
          >
            This release was issued in {new Date(`${release.date}T12:00:00Z`).getUTCFullYear()}{" "}
            under our former name, <strong>{release.legacyBrand}</strong>. The
            company rebranded as Traverse Hospitality in 2024.
          </p>
        )}

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <div style={{ marginTop: "48px", paddingTop: "28px", borderTop: "1px solid #e2e8f0" }}>
          <Link
            href="/press"
            style={{ color: "#0f766e", fontWeight: 600, fontSize: "15px" }}
          >
            ← All press releases
          </Link>
        </div>
      </div>
    </div>
  );
}
