import { CreditCard } from "lucide-react";

/**
 * Card brand logos for receipts / checkout UI.
 *
 * The four major US brands (Visa, Mastercard, Amex, Discover) use real
 * vendor artwork from public/card-brands/. Less common brands (Diners,
 * JCB, UnionPay) use compact inline SVG fallbacks. Unknown/null brands
 * fall back to a generic credit-card icon.
 *
 * Brand strings come from Stripe's
 * charge.payment_method_details.card.brand: visa, mastercard, amex,
 * discover, diners, jcb, unionpay, unknown.
 */
type Size = "sm" | "md";

interface Props {
  brand: string | null;
  className?: string;
  title?: string;
  /**
   * "sm" (default) — 16px tall, proportioned for text-xs body copy on
   * receipts. "md" — 24px tall, for the checkout "we accept" row where
   * logos sit next to a larger heading.
   */
  size?: Size;
}

interface SizeSpec {
  wrapperHeightClass: string;
  wrapperWidthClass: string;
  imgHeightPx: number;
  imgMaxWidthPx: number;
}

const SIZES: Record<Size, SizeSpec> = {
  sm: {
    wrapperHeightClass: "h-4",
    wrapperWidthClass: "w-[26px]",
    imgHeightPx: 16,
    imgMaxWidthPx: 32,
  },
  md: {
    wrapperHeightClass: "h-6",
    wrapperWidthClass: "w-[38px]",
    imgHeightPx: 24,
    imgMaxWidthPx: 48,
  },
};

interface LocalBrand {
  src: string;
  alt: string;
}

const LOCAL_BRANDS: Record<string, LocalBrand> = {
  visa: { src: "/card-brands/visa.png", alt: "Visa" },
  mastercard: { src: "/card-brands/mastercard.svg", alt: "Mastercard" },
  amex: { src: "/card-brands/amex.svg", alt: "American Express" },
  americanexpress: { src: "/card-brands/amex.svg", alt: "American Express" },
  discover: { src: "/card-brands/discover.png", alt: "Discover" },
};

function LocalBrandImage({
  brand,
  className,
  title,
  spec,
}: {
  brand: LocalBrand;
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${spec.wrapperHeightClass} ${className ?? ""}`}
      aria-label={title ?? brand.alt}
      role="img"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.src}
        alt={title ?? brand.alt}
        style={{
          height: `${spec.imgHeightPx}px`,
          width: "auto",
          maxWidth: `${spec.imgMaxWidthPx}px`,
        }}
        className="block object-contain"
      />
    </span>
  );
}

// --- Inline SVG fallbacks for brands we don't ship artwork for ---

function Frame({
  children,
  fill,
  className,
  title,
  spec,
}: {
  children: React.ReactNode;
  fill: string;
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <svg
      viewBox="0 0 32 20"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block rounded-sm ${spec.wrapperHeightClass} ${spec.wrapperWidthClass} ${className ?? ""}`}
      role="img"
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <rect width="32" height="20" rx="3" ry="3" fill={fill} />
      {children}
    </svg>
  );
}

function Diners({
  className,
  title,
  spec,
}: {
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <Frame fill="#0079BE" className={className} title={title} spec={spec}>
      <text
        x="16"
        y="13.5"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="5.5"
        textAnchor="middle"
        letterSpacing="0.2"
      >
        DINERS
      </text>
    </Frame>
  );
}

function Jcb({
  className,
  title,
  spec,
}: {
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <Frame fill="#0E4C96" className={className} title={title} spec={spec}>
      <text
        x="16"
        y="13.5"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="8"
        textAnchor="middle"
        letterSpacing="0.3"
      >
        JCB
      </text>
    </Frame>
  );
}

function UnionPay({
  className,
  title,
  spec,
}: {
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <Frame fill="#2E4A7D" className={className} title={title} spec={spec}>
      <text
        x="16"
        y="13.5"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="5.5"
        textAnchor="middle"
        letterSpacing="0.2"
      >
        UnionPay
      </text>
    </Frame>
  );
}

function Fallback({
  className,
  title,
  spec,
}: {
  className?: string;
  title?: string;
  spec: SizeSpec;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm bg-muted text-muted-foreground ${spec.wrapperHeightClass} ${spec.wrapperWidthClass} ${className ?? ""}`}
      aria-label={title}
      role="img"
    >
      <CreditCard className="h-3 w-3" />
    </span>
  );
}

export function CardBrandIcon({ brand, className, title, size = "sm" }: Props) {
  const normalized = brand?.toLowerCase().replace(/[\s_-]/g, "") ?? "";
  const label = title ?? (brand ? `${brand} card` : "Card");
  const spec = SIZES[size];

  const local = LOCAL_BRANDS[normalized];
  if (local) {
    return (
      <LocalBrandImage
        brand={local}
        className={className}
        title={label}
        spec={spec}
      />
    );
  }

  switch (normalized) {
    case "diners":
    case "dinersclub":
      return <Diners className={className} title={label} spec={spec} />;
    case "jcb":
      return <Jcb className={className} title={label} spec={spec} />;
    case "unionpay":
      return <UnionPay className={className} title={label} spec={spec} />;
    default:
      return <Fallback className={className} title={label} spec={spec} />;
  }
}

/**
 * Small helper: the ordered list of brands we accept, for rendering
 * things like the "we accept" strip on the checkout page.
 */
export const ACCEPTED_BRANDS: Array<keyof typeof LOCAL_BRANDS> = [
  "visa",
  "mastercard",
  "amex",
  "discover",
];
