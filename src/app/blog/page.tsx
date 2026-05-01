import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "./posts";

export const metadata: Metadata = {
  title: "Blog — Traverse Hospitality",
  description:
    "Travel guides, property spotlights, and tips for vacation rental owners. Written by the Traverse Hospitality team from Crested Butte and Leadville, Colorado.",
  alternates: { canonical: "https://www.booktraverse.com/blog/" },
};

export default function BlogIndex() {
  const featured = BLOG_POSTS[0];
  const rest = BLOG_POSTS.slice(1);

  return (
    <div>
      {/* ═══ HERO HEADER ═══ */}
      <div
        style={{
          background: "#14142b",
          padding: "80px 24px 60px",
          textAlign: "center",
          color: "#fff",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            opacity: 0.4,
            display: "block",
            marginBottom: "16px",
          }}
        >
          Traverse Hospitality
        </span>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 700,
            marginBottom: "16px",
          }}
        >
          Blog
        </h1>
        <p
          style={{
            fontSize: "17px",
            opacity: 0.6,
            maxWidth: "50ch",
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Travel guides, property spotlights, and insider tips from our team in
          Crested Butte and Leadville.
        </p>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>

        {/* ═══ FEATURED POST ═══ */}
        <Link
          href={`/blog/${featured.slug}`}
          style={{
            display: "grid",
            gridTemplateColumns: featured.image ? "1.2fr 1fr" : "1fr",
            gap: "0",
            marginBottom: "56px",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
            textDecoration: "none",
            color: "inherit",
            transition: "box-shadow 0.3s",
          }}
        >
          {featured.image && (
            <img
              src={featured.image}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                minHeight: "300px",
                objectFit: "cover",
              }}
            />
          )}
          <div
            style={{
              padding: "40px 36px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "#14142b",
                color: "#fff",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                marginBottom: "16px",
                alignSelf: "flex-start",
              }}
            >
              {featured.category}
            </span>
            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "26px",
                fontWeight: 700,
                color: "#1e293b",
                lineHeight: 1.25,
                marginBottom: "12px",
              }}
            >
              {featured.title}
            </h2>
            <p
              style={{
                fontSize: "15px",
                color: "#545b5f",
                lineHeight: 1.65,
                marginBottom: "20px",
              }}
            >
              {featured.excerpt}
            </p>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {featured.author} · {featured.date}
            </div>
          </div>
        </Link>

        {/* ═══ SECTION LABEL ═══ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            paddingBottom: "16px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            All Articles
          </h2>
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            {BLOG_POSTS.length} posts
          </span>
        </div>

        {/* ═══ POST GRID ═══ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "24px",
          }}
        >
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s, transform 0.15s",
              }}
            >
              {post.image ? (
                <img
                  src={post.image}
                  alt=""
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "180px",
                    background: "linear-gradient(135deg, #14142b, #334155)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(255,255,255,0.3)",
                    fontSize: "40px",
                  }}
                >
                  ✦
                </div>
              )}
              <div style={{ padding: "22px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#545b5f",
                      fontWeight: 600,
                    }}
                  >
                    {post.category}
                  </span>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {post.date}
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "17px",
                    fontWeight: 600,
                    color: "#1e293b",
                    lineHeight: 1.35,
                    marginBottom: "8px",
                  }}
                >
                  {post.title}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}
                >
                  {post.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}