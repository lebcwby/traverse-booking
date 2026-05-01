"use client";

import { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useDateRange } from "./date-range-context";

interface StickyNavProps {
  displayRating: number | null;
  reviewTotal: number | null;
  basePrice: number;
}

const NAV_LINKS = [
  { id: "photos", label: "Photos" },
  { id: "amenities", label: "Amenities" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
];

export function StickyNav({
  displayRating,
  reviewTotal,
  basePrice,
}: StickyNavProps) {
  const [visible, setVisible] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const { quotePricing } = useDateRange();

  useEffect(() => {
    const photoEl = document.getElementById("photos");
    const sidebarEl = document.getElementById("booking-sidebar");
    if (!photoEl) return;

    const photoObserver = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    photoObserver.observe(photoEl);

    let sidebarObserver: IntersectionObserver | undefined;
    if (sidebarEl) {
      sidebarObserver = new IntersectionObserver(
        ([entry]) => setShowReserve(!entry.isIntersecting),
        { threshold: 0 }
      );
      sidebarObserver.observe(sidebarEl);
    }

    const sectionEls = NAV_LINKS.map((l) =>
      document.getElementById(l.id)
    ).filter(Boolean) as HTMLElement[];

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    sectionEls.forEach((el) => sectionObserver.observe(el));

    return () => {
      photoObserver.disconnect();
      sidebarObserver?.disconnect();
      sectionObserver.disconnect();
    };
  }, []);

  function scrollTo(id: string) {
    if (id === "photos") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const navHeight = navRef.current?.offsetHeight || 80;
      const y =
        el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  if (!visible) return null;

  return (
    <div
      ref={navRef}
      className="hidden lg:block fixed top-0 left-0 right-0 z-[90] bg-background border-b border-border shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="mx-auto max-w-7xl px-8 flex items-center justify-between h-[80px]">
        {/* Section links */}
        <nav className="flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className={`text-base font-medium transition-colors pb-1 ${
                activeSection === link.id
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right side: price + reserve when sidebar out of view */}
        {showReserve && (
          <div className="flex items-center gap-6 animate-in fade-in duration-200">
            <div>
              <div className="flex items-baseline gap-1.5">
                {quotePricing ? (
                  <>
                    <span className="text-lg font-bold">
                      {formatCurrency(quotePricing.total)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      for {quotePricing.nights}{" "}
                      {quotePricing.nights === 1 ? "night" : "nights"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold">
                      {formatCurrency(basePrice)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / night
                    </span>
                  </>
                )}
              </div>
              {displayRating && reviewTotal ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {displayRating >= 4.8 ? (
                    <img
                      src={`/badges/rose-b-${displayRating >= 4.95 ? "gold" : displayRating >= 4.85 ? "silver" : "bronze"}-left.png`}
                      alt=""
                      className="h-4 w-auto"
                      aria-hidden="true"
                    />
                  ) : (
                    <Star className="h-3 w-3 fill-current text-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    {displayRating.toFixed(2)}
                  </span>
                  {displayRating >= 4.8 && (
                    <img
                      src={`/badges/rose-b-${displayRating >= 4.95 ? "gold" : displayRating >= 4.85 ? "silver" : "bronze"}-right.png`}
                      alt=""
                      className="h-4 w-auto"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    · {reviewTotal} {reviewTotal === 1 ? "review" : "reviews"}
                  </span>
                </div>
              ) : null}
            </div>
            <Button
              className="rounded-full px-6 bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => scrollTo("booking-sidebar")}
            >
              Reserve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
