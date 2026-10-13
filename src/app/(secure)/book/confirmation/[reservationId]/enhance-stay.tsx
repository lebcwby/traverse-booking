"use client";

import { useEffect, useState } from "react";
import { Clock, PawPrint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { readConfirmationSession } from "./lib/confirmation-session";

interface UpsellItem {
  id: string;
  title: string;
  description: string;
  price: number;
  icon: "clock" | "paw";
}

// Early check-in / late checkout removed 2026-05-20 — these are request-only
// (handled post-booking via SuiteOp, not guaranteed at booking time). See
// src/lib/upsells.ts for the canonical UPSELLS list. Keep this file in sync.
const UPSELL_OPTIONS: UpsellItem[] = [
  {
    id: "pet-fee",
    title: "Pet Fee",
    description: "Bring your furry friend along for the stay.",
    price: 99,
    icon: "paw",
  },
];

function UpsellIcon({ type }: { type: "clock" | "paw" }) {
  if (type === "paw")
    return <PawPrint className="h-5 w-5 text-muted-foreground" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}

interface EnhanceStayProps {
  reservationId: string;
  existingUpsells?: string[];
}

export function EnhanceStay({
  reservationId,
  existingUpsells = [],
}: EnhanceStayProps) {
  const [knownExistingUpsells, setKnownExistingUpsells] = useState<
    string[] | null
  >(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = new Set(existingUpsells);
    const session = readConfirmationSession(reservationId);

    if (Array.isArray(session?.upsells)) {
      for (const upsell of session.upsells) {
        existing.add(upsell);
      }
    }

    if ((session?.pets ?? 0) > 0) {
      existing.add("pet-fee");
    }

    setKnownExistingUpsells(Array.from(existing));
  }, [existingUpsells, reservationId]);

  if (knownExistingUpsells === null) return null;

  const available = UPSELL_OPTIONS.filter(
    (upsell) =>
      !knownExistingUpsells.includes(upsell.id) &&
      !purchased.includes(upsell.id)
  );

  if (available.length === 0) return null;

  const total = available
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + item.price, 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePurchase = async () => {
    if (selected.size === 0) return;
    setPurchasing(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/upsells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upsellIds: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add extras");
      }

      setPurchased((prev) => [...prev, ...Array.from(selected)]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-1 text-base font-semibold">Enhance your stay</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Add extras to make your trip even better.
        </p>

        <div className="space-y-3">
          {available.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-foreground bg-foreground/[0.03]"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <UpsellIcon type={item.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium">
                  {formatCurrency(item.price, { cents: true })}
                </p>
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected
                      ? "border-foreground bg-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-background"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {selected.size > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <Button
              type="button"
              onClick={handlePurchase}
              disabled={purchasing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-6 text-base font-semibold text-background hover:bg-foreground/90"
            >
              {purchasing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add for ${formatCurrency(total, { cents: true })}`
              )}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-destructive">{error}</p>
        )}

        {purchased.length > 0 && (
          <p className="mt-3 text-center text-sm font-medium text-green-600">
            Extras added to your reservation!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
