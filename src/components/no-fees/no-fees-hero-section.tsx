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
