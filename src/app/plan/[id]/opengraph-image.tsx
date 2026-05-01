// Dynamic Open Graph image for /plan/[id]. Renders a 1200x630 SP-branded
// card keyed on the slug's h1, so social shares (iMessage / Slack /
// WhatsApp / Twitter) show a tailored preview per trip plan.
//
// Falls back to a generic Book Traverse card when the id doesn't match a
// known slug (UUID chat pages — those are noindex but may still be shared).

import { ImageResponse } from "next/og";
import { getPlanSlug } from "@/lib/plan/slug-map";

export const alt = "Book Traverse — Portland vacation rentals and trip plans";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlanOgImage({ params }: Props) {
  const { id } = await params;
  const entry = getPlanSlug(id);

  const title = entry?.h1 ?? "Book Traverse";
  const subtitle =
    entry?.subtitle ??
    "Portland vacation rentals — book direct. Always the lowest price.";

  // SP brand palette: dark #1c1d1d, teal #404f52, gold #f2c070, warm #faf8f5.
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #1c1d1d 0%, #404f52 55%, #2d3e2c 100%)",
        color: "#faf8f5",
        padding: "72px 80px",
        fontFamily: "system-ui, -apple-system, Helvetica, sans-serif",
      }}
    >
      {/* Top: gold accent + wordmark */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
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

      {/* Middle: big title + subtitle */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontSize: entry ? "84px" : "104px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: "1000px",
            color: "#faf8f5",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: "28px",
            fontSize: "26px",
            lineHeight: 1.35,
            maxWidth: "900px",
            color: "rgba(250, 248, 245, 0.82)",
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Bottom: trust line */}
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
        <span>275+ Portland homes</span>
        <span>·</span>
        <span>80,000+ guests hosted</span>
        <span>·</span>
        <span>Book direct. No fees.</span>
      </div>
    </div>,
    { ...size }
  );
}
