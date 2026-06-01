import { Star } from "lucide-react";

export function CredibilityBar({
  propertyLabel = "275+ properties",
}: {
  propertyLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-y-1 text-xs sm:text-sm text-muted-foreground">
      <span className="flex whitespace-nowrap items-center gap-1 px-2 sm:px-3">
        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        4.8-star average
      </span>
      <span className="whitespace-nowrap px-2 sm:px-3">
        &middot; {propertyLabel}
      </span>
      <span className="whitespace-nowrap px-2 sm:px-3">
        &middot; 80,000+ guests hosted
      </span>
      <span className="whitespace-nowrap px-2 sm:px-3">
        &middot; Colorado-based team
      </span>
    </div>
  );
}
