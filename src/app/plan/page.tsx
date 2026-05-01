// src/app/plan/page.tsx
// Server component entry for /plan. Pure shell — all interactivity lives
// in <PlanClient />.

import type { Metadata } from "next";
import { PlanClient } from "@/components/plan/plan-client";

export const metadata: Metadata = {
  title: "Plan Your Portland Trip — Local Favorites",
  description:
    "Build your Portland trip from local favorites — day-by-day itineraries with maps, real places, and matching vacation rentals. Free, no booking fees.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PlanPage() {
  return <PlanClient />;
}
