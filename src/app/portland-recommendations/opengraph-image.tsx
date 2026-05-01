// Dynamic Open Graph image for /portland-recommendations. 1200x630 SP-
// branded card so iMessage / Slack / WhatsApp / Twitter / etc. unfurl the
// URL with a real preview instead of a blank box. Mirrors the brand palette
// + composition used by /plan/[id]/opengraph-image.tsx so social shares of
// either surface look like the same product.

import { ImageResponse } from "next/og";

export const alt = "Ask a Portland local for recommendations — Book Traverse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

export default function PortlandRecsOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #1c1d1d 0%, #2d3e2c 55%, #404f52 100%)",
        color: "#faf8f5",
        padding: "72px 80px",
        fontFamily: "system-ui, -apple-system, Helvetica, sans-serif",
      }}
    >
      {/* Top: gold accent + wordmark */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            height: "6px",
            width: "96px",
            backgroundColor: "#f2c070",
            marginBottom: "36px",
            borderRadius: "3px",
          }}
        />
        <div
          style={{
            fontSize: "24px",
            fontWeight: 600,
            letterSpacing: "6px",
            textTransform: "uppercase",
            color: "#f2c070",
          }}
        >
          Book Traverse
        </div>
      </div>

      {/* Middle: headline + subtitle.
            Satori (next/og) requires every <div> with >1 child to declare
            display: flex|contents|none — that's why the title is broken
            into two single-text divs instead of using inline <span>s for
            the gold accent on "local". */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: "92px",
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: "#faf8f5",
          }}
        >
          Ask a Portland
        </div>
        <div
          style={{
            fontSize: "104px",
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            color: "#f2c070",
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
            marginTop: "4px",
          }}
        >
          local.
        </div>
        <div
          style={{
            marginTop: "28px",
            fontSize: "30px",
            lineHeight: 1.35,
            maxWidth: "920px",
            color: "rgba(250, 248, 245, 0.85)",
          }}
        >
          Recommendations from the team that manages 275+ Portland homes.
        </div>
      </div>

      {/* Bottom: trust strip */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "center",
          fontSize: "20px",
          fontWeight: 500,
          color: "rgba(250, 248, 245, 0.65)",
        }}
      >
        <span>Restaurants</span>
        <span>·</span>
        <span>Coffee</span>
        <span>·</span>
        <span>Bars</span>
        <span>·</span>
        <span>Parks</span>
        <span>·</span>
        <span>Day trips</span>
        <span style={{ marginLeft: "auto", color: "#f2c070" }}>Free</span>
      </div>
    </div>,
    { ...size }
  );
}
