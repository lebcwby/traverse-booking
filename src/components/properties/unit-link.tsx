"use client";

// A unit link that carries the guest's persisted search selection (dates/guests)
// when the base href has none. Used for the homepage "Featured properties" (and
// any static unit link) so entering dates in the hero and clicking a unit keeps
// them. The base href renders server-side; the selection is appended AFTER mount
// (useEffect) so there's no hydration mismatch, and normal link behavior
// (middle-click, open-in-new-tab) still works with at least the base URL.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { readSearchSelection, buildSearchQuery } from "@/lib/search-selection";

export function UnitLink({
  href,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    if (href.includes("?")) return; // already has params — leave as-is
    const qs = buildSearchQuery(readSearchSelection());
    if (qs) setResolvedHref(`${href}?${qs}`);
  }, [href]);

  return (
    <Link href={resolvedHref} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
