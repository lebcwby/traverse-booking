"use client";

import { useEffect } from "react";
import { trackBehavior } from "@/lib/behavior-tracking";

interface BehaviorTrackerProps {
  eventType: string;
  properties: Record<string, unknown>;
}

export function BehaviorTracker({
  eventType,
  properties,
}: BehaviorTrackerProps) {
  useEffect(() => {
    trackBehavior(eventType, properties);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
