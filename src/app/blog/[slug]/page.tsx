	import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_POSTS, getPost } from "../posts";
import "../blog-content.css";


export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

// The full set of posts is a static array in posts.ts, so generateStaticParams
// above is exhaustive — a slug that isn't one of them can never become valid
// without a deploy. Force static generation + reject unknown params so Next
// serves a real routing-level 404 (not a rendered 200 "soft 404", which it did
// while the route was dynamic: notFound() resolved after the 200 response had
// begun streaming, letting Google index an unbounded space of 200-OK "not
// found" URLs). New posts still only need a posts.ts entry + a content dir;
// generateStaticParams picks them up at build.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `https://www.booktraverse.com/blog/${post.slug}`;
  const ogImage = post.image || "/markets/crested-butte.jpg";
  return {
    // Layout title template appends " | Traverse Hospitality"; don't repeat it.
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt,
      images: [{ url: ogImage }],
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  let content = "";
  try {
    const mod = await import(`../${slug}/content`);
    content = mod.pageContent || "";
  } catch {
    content = `<p>This post is being migrated. Check back soon or <a href="https://booktraverse.com/traversehospitality/blog/${post.oldSlug}/">read it on our current site</a>.</p>`;
  }

  const heroImg = post.image || "/markets/crested-butte.jpg";
  const postUrl = `https://www.booktraverse.com/blog/${post.slug}`;
  const blogSchema = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${postUrl}#blogposting`,
      headline: post.title,
      description: post.excerpt,
      ...(post.image
        ? { image: `https://www.booktraverse.com${post.image}` }
        : {}),
      datePublished: post.date,
      dateModified: post.date,
      author: post.author.includes("Traverse")
        ? { "@type": "Organization", name: post.author }
        : { "@type": "Person", name: post.author },
      publisher: { "@id": "https://www.booktraverse.com/#organization" },
      mainEntityOfPage: postUrl,
      url: postUrl,
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
          name: "Blog",
          item: "https://www.booktraverse.com/blog",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title,
          item: postUrl,
        },
      ],
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      {/* ═══ HERO HEADER ═══ */}
      <div
        style={{
          position: "relative",
          minHeight: "420px",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          backgroundImage: `url('${heroImg}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(20,20,43,0.92) 0%, rgba(20,20,43,0.4) 50%, rgba(20,20,43,0.15) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: "760px",
            margin: "0 auto",
            padding: "0 24px 48px",
            width: "100%",
            color: "#fff",
          }}
        >
          {/* Breadcrumb */}
          <nav style={{ fontSize: "13px", marginBottom: "16px", opacity: 0.6 }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none" }}>Home</Link>
            {" / "}
            <Link href="/blog" style={{ color: "#fff", textDecoration: "none" }}>Blog</Link>
          </nav>

          {/* Category badge */}
          <span
            style={{
              display: "inline-block",
              padding: "5px 14px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginBottom: "16px",
            }}
          >
            {post.category}
          </span>
         <span style={{ fontSize: "13px", opacity: 0.5, marginLeft: "12px" }}>
            {post.date} · {Math.max(3, Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 230))} min read
          </span>

          {/* Title */}
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "clamp(28px, 4vw, 42px)",
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: "12px",
              marginBottom: "16px",
            }}
          >
            {post.title}
          </h1>

          {/* Author line */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {post.author.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{post.author}</div>
              <div style={{ fontSize: "12px", opacity: 0.5 }}>
                190+ vacation rentals across Colorado
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ARTICLE BODY ═══ */}
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
      <div
          className="blog-content"
          dangerouslySetInnerHTML={{
            __html: (() => {
              const firstImgIndex = content.indexOf('<img');
              if (firstImgIndex === -1 || firstImgIndex > 500) return content;
              const endIndex = content.indexOf('>', firstImgIndex) + 1;
              const before = content.slice(0, firstImgIndex);
              const after = content.slice(endIndex);
              return before + after;
            })(),
          }}
        />

        {/* CTA Widget */}
        <div
          style={{
            marginTop: "56px",
            padding: "40px 36px",
            background: "#f8fafc",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <h3
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#1e293b",
              marginBottom: "10px",
            }}
          >
            Planning a Trip to the Colorado Rockies?
          </h3>
          <p
            style={{
              fontSize: "16px",
              color: "#545b5f",
              marginBottom: "24px",
              lineHeight: 1.6,
            }}
          >
            Browse 190+ vacation rentals across Crested Butte, Leadville, Vail, and more!
          </p>
          <Link
            href="/properties"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              background: "#14142b",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Browse All Properties
          </Link>
        </div>
{/* Related Posts */}
        {(() => {
          const related = BLOG_POSTS.filter(
            (p) => p.market === post.market && p.slug !== post.slug
          ).slice(0, 3);
          if (related.length === 0) return null;
          return (
            <div style={{ marginTop: "56px" }}>
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "20px",
                }}
              >
                More from {post.category}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    style={{
                      padding: "20px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      textDecoration: "none",
                      color: "inherit",
                      transition: "border-color 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#545b5f", fontWeight: 600 }}>
                      {r.category}
                    </span>
                    <h4 style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", marginTop: "6px", lineHeight: 1.35 }}>
                      {r.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* CTA Widget */}

        {/* Back to blog */}
        <div style={{ marginTop: "32px", paddingTop: "32px", borderTop: "1px solid #e2e8f0" }}>
          <Link
            href="/blog"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1e293b",
              textDecoration: "none",
            }}
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}