"use client";

import dynamic from "next/dynamic";

export const ClientNeighborhoodMap = dynamic(
  () =>
    import("@/components/where-to-stay/neighborhood-map").then((m) => ({
      default: m.NeighborhoodMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
    ),
  }
);
