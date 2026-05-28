"use client";

import Link from "next/link";
import { getLandingPagePath } from "@/lib/landing-page-paths";

const CATEGORIES = [
  { label: "Pet Friendly", slug: "pet-friendly" },
  { label: "Large Groups", slug: "large-groups" },
  { label: "Family Friendly", slug: "family-friendly" },
  { label: "Hot Tubs", slug: "hot-tubs" },
  { label: "Extended Stay", slug: "extended-stay" },
  { label: "Fireplace", slug: "fireplace" },
];

export function CategoryPills() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={getLandingPagePath(cat.slug)}
          className="whitespace-nowrap rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-primary/30"
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
