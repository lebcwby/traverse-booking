import Link from "next/link";
import type { Metadata } from "next";

// App-level not-found boundary. Rendered by Next whenever notFound() is called
// anywhere in the tree (or a route is unmatched). Having an explicit boundary —
// rather than Next's internal default — ensures the 404 STATUS is sent for
// dynamically rendered routes (/properties/[id], /plan/[id]) whose param space
// is unbounded and so can't be pinned with dynamicParams:false. Keep it a plain
// server component with no data needs so it renders instantly.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "480px" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#94a3b8",
            marginBottom: "12px",
          }}
        >
          404 — Page not found
        </p>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#14142b",
            marginBottom: "14px",
          }}
        >
          We couldn&rsquo;t find that page
        </h1>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.6,
            color: "#545b5f",
            marginBottom: "28px",
          }}
        >
          The link may be broken or the page may have moved. Let&rsquo;s get you
          back to planning your Colorado stay.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/properties"
            style={{
              display: "inline-block",
              padding: "13px 28px",
              background: "#14142b",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Browse rentals
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "13px 28px",
              background: "#fff",
              color: "#14142b",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
