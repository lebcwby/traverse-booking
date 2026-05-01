"use client";

import { UPSELLS } from "@/lib/upsells";
import { formatCurrency } from "@/lib/utils";
import { Clock, Moon, Shield, PawPrint } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  moon: Moon,
  shield: Shield,
  paw: PawPrint,
};

export function UpsellSelector({
  selectedUpsells,
  onToggle,
  hiddenIds,
}: {
  selectedUpsells: string[];
  onToggle: (id: string) => void;
  hiddenIds?: string[];
}) {
  const selectableUpsells = UPSELLS.filter((u) => !hiddenIds?.includes(u.id));

  if (selectableUpsells.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Extras</h4>
      <div className="space-y-1.5">
        {selectableUpsells.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isSelected = selectedUpsells.includes(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isSelected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(item.amount, { cents: true })}
                </span>
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-3 w-3 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
