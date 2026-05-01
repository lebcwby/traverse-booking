"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Tag, X } from "lucide-react";

interface CouponInputProps {
  quoteId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCouponApplied: (updatedQuote: any, couponCode: string) => void;
  appliedCoupon?: string | null;
  onRemoveCoupon?: () => void;
}

export function CouponInput({
  quoteId,
  onCouponApplied,
  appliedCoupon,
  onRemoveCoupon,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const applyRes = await fetch(`/api/quotes/${quoteId}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon: code.trim() }),
      });

      if (!applyRes.ok) {
        const data = await applyRes.json();
        throw new Error(data.error || "Invalid coupon code");
      }

      const updatedQuote = await applyRes.json();
      onCouponApplied(updatedQuote, code.trim());
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
        <Tag className="h-4 w-4 text-green-600" />
        <span className="flex-1 text-sm font-medium text-green-700">
          {appliedCoupon}
        </span>
        {onRemoveCoupon && (
          <button
            onClick={onRemoveCoupon}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Discount code"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <Button
          variant="outline"
          onClick={handleApply}
          disabled={!code.trim() || loading}
          size="default"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
