"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { notePageView } from "@/lib/qualified-engagement";

export function QualifiedEngagementTracker() {
  const pathname = usePathname();

  useEffect(() => {
    notePageView();
  }, [pathname]);

  return null;
}
