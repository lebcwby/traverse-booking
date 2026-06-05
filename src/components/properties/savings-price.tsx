import { formatCurrency } from "@/lib/utils";
import { otaComparison } from "@/lib/savings";

/** Below this savings amount we skip the strikethrough to avoid trivial claims. */
const MIN_SAVINGS = 10;

/**
 * Direct-vs-OTA price display for property cards.
 *
 * Shows the comparable OTA price (Airbnb/VRBO/Booking with their guest service
 * fee) struck through, the direct price guests actually pay, and the savings
 * underneath — e.g.  ~~$568~~ $491 for 2 nights / "Save $77+ — no booking fees".
 *
 * Falls back to just the direct price when the savings would be trivial.
 */
export function SavingsPrice({
  directTotal,
  suffix,
  className = "",
  compact = false,
}: {
  /** What the guest pays booking direct (nightly base or stay total). */
  directTotal: number;
  /** Trailing unit, e.g. "for 2 nights", "total", "/ night". */
  suffix: string;
  className?: string;
  /** Smaller type for dense layouts (compact card variant). */
  compact?: boolean;
}) {
  if (!directTotal || directTotal <= 0) return null;
  const { otaPrice, savings } = otaComparison(directTotal);
  const showSavings = savings >= MIN_SAVINGS;
  const priceSize = compact ? "text-xs" : "text-sm";

  return (
    <div className={className}>
      <p className={priceSize}>
        {showSavings ? (
          <span className="mr-1 text-muted-foreground line-through">
            {formatCurrency(otaPrice)}
          </span>
        ) : null}
        <span className="font-semibold text-foreground">
          {formatCurrency(directTotal)}
        </span>
        <span className="text-muted-foreground">
          {suffix.startsWith("/") ? " " : " "}
          {suffix}
        </span>
      </p>
      {showSavings ? (
        <p className="text-xs font-medium text-[#2d7d46]">
          Save {formatCurrency(savings)}+ — no booking fees
        </p>
      ) : null}
    </div>
  );
}
