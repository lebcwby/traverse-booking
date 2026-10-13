"use client";

import { useEffect, useState } from "react";
import { getSelectedUpsells } from "@/lib/upsells";
import { formatCurrency } from "@/lib/utils";

export function ConfirmationExtras() {
  const [extras, setExtras] = useState<
    Array<{ title: string; amount: number }>
  >([]);

  useEffect(() => {
    const stored = sessionStorage.getItem("booking_confirmation");
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (Array.isArray(data.upsells) && data.upsells.length > 0) {
        setExtras(
          getSelectedUpsells(data.upsells).map((u) => ({
            title: u.title,
            amount: u.amount,
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  if (extras.length === 0) return null;

  const total = extras.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Extras</h3>
      <div className="space-y-1">
        {extras.map((item) => (
          <div key={item.title} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.title}</span>
            <span>{formatCurrency(item.amount, { cents: true })}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-medium pt-1">
          <span>Extras total</span>
          <span>{formatCurrency(total, { cents: true })}</span>
        </div>
      </div>
    </div>
  );
}
