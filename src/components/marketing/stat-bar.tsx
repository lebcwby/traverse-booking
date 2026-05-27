import { Star } from "lucide-react";

export function StatBar({
  propertyLabel = "Properties across Colorado",
}: {
  propertyLabel?: string;
}) {
  const stats = [
    { value: "189", label: propertyLabel },
    { value: "80,000+", label: "Guests hosted" },
    { value: "4.8", label: "Star average", icon: true },
    { value: "35%", label: "Guests return" },
  ];

  return (
    <div className="my-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl bg-secondary/50 p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1">
            <span className="text-2xl font-bold text-foreground">
              {stat.value}
            </span>
            {stat.icon && (
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            )}
          </div>
          <span className="mt-1 text-xs text-muted-foreground">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
