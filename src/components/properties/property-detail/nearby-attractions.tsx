import {
  MapPin,
  UtensilsCrossed,
  Coffee,
  Trees,
  ShoppingBag,
  TrainFront,
  Landmark,
} from "lucide-react";
import type { NearbyPoi, PoiCategory } from "@/lib/portland-pois";

const CATEGORY_ICONS: Record<PoiCategory, React.ReactNode> = {
  dining: <UtensilsCrossed className="h-3.5 w-3.5" />,
  coffee: <Coffee className="h-3.5 w-3.5" />,
  parks: <Trees className="h-3.5 w-3.5" />,
  shopping: <ShoppingBag className="h-3.5 w-3.5" />,
  transit: <TrainFront className="h-3.5 w-3.5" />,
  attractions: <Landmark className="h-3.5 w-3.5" />,
};

interface NearbyAttractionsProps {
  pois: NearbyPoi[];
}

export function NearbyAttractions({ pois }: NearbyAttractionsProps) {
  if (pois.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-base font-semibold">What&apos;s nearby</h3>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {pois.map((poi) => (
          <div
            key={poi.name}
            className="flex items-center gap-2.5 rounded-lg py-1.5 text-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {CATEGORY_ICONS[poi.category]}
            </span>
            <span className="min-w-0 truncate text-foreground">{poi.name}</span>
            <span className="ml-auto shrink-0 flex items-center gap-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {poi.walkMinutes} min
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
