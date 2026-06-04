"use client";

import {
  NoFeesSearchBar,
  type LockedDestination,
} from "@/components/no-fees/no-fees-search-bar";

interface HeroSectionProps {
  bgImage: string;
  eyebrow: string;
  title: string;
  titleEm?: string;
  lede: string;
  lockedDestination: LockedDestination;
  directionsHref?: string;
  directionsLabel?: string;
  /** Optional "YYYY-MM-DD" dates to pre-fill the hero search (skip blank search). */
  initialCheckIn?: string;
  initialCheckOut?: string;
  /** Optional above-the-fold trust line, e.g. "No booking fees · Best rate direct". */
  trustBadge?: string;
}

export function NoFeesHeroSection({
  bgImage,
  eyebrow,
  title,
  titleEm,
  lede,
  lockedDestination,
  directionsHref = "#location",
  directionsLabel = "Get Directions",
  initialCheckIn,
  initialCheckOut,
  trustBadge,
}: HeroSectionProps) {
  return (
    <header className="hero-full">
      <div
        className="hero-bg"
        style={{ backgroundImage: `url('${bgImage}')` }}
      />
      <div className="hero-overlay" />
      <div className="hero-inner">
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          {titleEm ? (
            <>
              {" "}
              <em>{titleEm}</em>
            </>
          ) : null}
        </h1>
        <p className="hero-lede">{lede}</p>
        {trustBadge ? (
          <p
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              margin: "0 auto 0.9rem",
              padding: "0.32rem 0.9rem",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.16)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            {trustBadge}
          </p>
        ) : null}
        <div className="hero-search-wrap">
          <NoFeesSearchBar
            lockedDestination={lockedDestination}
            initialCheckIn={initialCheckIn}
            initialCheckOut={initialCheckOut}
          />
        </div>
        <div className="hero-cta hero-cta-stacked">
          <a href={directionsHref} className="btn btn-ghost-light">
            {directionsLabel}
          </a>
        </div>
      </div>
    </header>
  );
}
