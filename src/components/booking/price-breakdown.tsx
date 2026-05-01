import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

const $ = (amount: number) => formatCurrency(amount, { cents: true });

interface PriceBreakdownProps {
  nights: number;
  accommodation: number;
  accommodationAdjusted: number;
  cleaning: number;
  taxes: number;
  total: number;
  promotion?: { name: string; type: string };
  upsells?: Array<{ title: string; amount: number }>;
}

export function PriceBreakdown({
  nights,
  accommodation,
  accommodationAdjusted,
  cleaning,
  taxes,
  total,
  promotion,
  upsells,
}: PriceBreakdownProps) {
  const accommodationWithCleaning = accommodationAdjusted + cleaning;
  const accommodationFullWithCleaning = accommodation + cleaning;
  const avgNightlyRate = nights > 0 ? accommodationWithCleaning / nights : 0;
  const hasDiscount = accommodationAdjusted < accommodation;
  const grandTotal =
    total + (upsells ? upsells.reduce((s, u) => s + u.amount, 0) : 0);
  const vrboSavings = Math.round(grandTotal * 0.16);

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          {$(avgNightlyRate)} x {nights} nights
        </span>
        <span>{$(accommodationFullWithCleaning)}</span>
      </div>
      {hasDiscount && promotion && (
        <div className="flex justify-between text-green-600">
          <span>{promotion.name}</span>
          <span>-{$(accommodation - accommodationAdjusted)}</span>
        </div>
      )}
      {taxes > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxes</span>
          <span>{$(taxes)}</span>
        </div>
      )}
      {upsells && upsells.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extras
          </p>
          {upsells.map((item) => (
            <div key={item.title} className="flex justify-between">
              <span className="text-muted-foreground">{item.title}</span>
              <span>{$(item.amount)}</span>
            </div>
          ))}
        </>
      )}
      <Separator />
      <div className="flex justify-between font-semibold text-base">
        <span>Total</span>
        <span>{$(grandTotal)}</span>
      </div>
      {vrboSavings >= 20 && (
        <p className="text-center text-xs text-green-600 font-medium mt-1">
          You&apos;re saving {$(vrboSavings)} vs VRBO
        </p>
      )}
    </div>
  );
}
