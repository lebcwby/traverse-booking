"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StickyCTAProps {
  href: string;
  label: string;
  sublabel?: string;
  /** Scroll threshold in pixels before the sticky CTA appears */
  threshold?: number;
}

export function StickyCTA({
  href,
  label,
  sublabel,
  threshold = 600,
}: StickyCTAProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur-sm px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href={href}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <span>{label}</span>
        {sublabel && (
          <span className="text-xs font-normal text-primary-foreground/70">
            {sublabel}
          </span>
        )}
      </Link>
    </div>
  );
}
