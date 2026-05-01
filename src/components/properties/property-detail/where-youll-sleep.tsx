"use client";

import { BedDouble } from "lucide-react";

// BEAPI shape: bedArrangements.bedrooms[] with beds as object { KING_BED: 1, ... }
interface BeapiBedroom {
  name?: string;
  type?: string;
  roomNumber?: number;
  beds?: Record<string, number>;
}

interface BedArrangements {
  bedrooms?: BeapiBedroom[];
}

const bedTypeLabels: Record<string, string> = {
  KING_BED: "king bed",
  QUEEN_BED: "queen bed",
  DOUBLE_BED: "double bed",
  SINGLE_BED: "single bed",
  SOFA_BED: "sofa bed",
  AIR_MATTRESS: "air mattress",
  BUNK_BED: "bunk bed",
  FLOOR_MATTRESS: "floor mattress",
  WATER_BED: "water bed",
  TODDLER_BED: "toddler bed",
  CRIB: "crib",
};

function hasBeds(beds?: Record<string, number>): boolean {
  if (!beds) return false;
  return Object.values(beds).some((qty) => qty > 0);
}

function formatBedSummary(beds?: Record<string, number>): string {
  if (!beds) return "";
  return Object.entries(beds)
    .filter(([, qty]) => qty > 0)
    .map(([type, qty]) => {
      const label =
        bedTypeLabels[type] || type.toLowerCase().replace(/_/g, " ");
      return `${qty} ${label}${qty > 1 ? "s" : ""}`;
    })
    .join(", ");
}

export function WhereYoullSleep({
  bedArrangements,
}: {
  bedArrangements: BedArrangements;
}) {
  const bedrooms = bedArrangements?.bedrooms?.filter((room) =>
    hasBeds(room.beds)
  );
  if (!bedrooms?.length) return null;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Where you&apos;ll sleep</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {bedrooms.map((room, i) => {
          const bedSummary = formatBedSummary(room.beds);
          const roomName = room.name || `Bedroom ${(room.roomNumber ?? i) + 1}`;

          return (
            <div
              key={roomName + i}
              className="rounded-xl border border-border p-4"
            >
              <BedDouble className="mb-2 h-6 w-6 text-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {roomName}
              </p>
              {bedSummary && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {bedSummary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
