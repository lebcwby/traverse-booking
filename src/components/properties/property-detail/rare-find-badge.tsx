export function RareFindBadge({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border px-4 py-3 ${className ?? ""}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-7 w-7 shrink-0"
        aria-hidden="true"
      >
        {/* 4-pointed star burst */}
        <path
          d="M12 1l2.5 7.5L22 12l-7.5 2.5L12 23l-2.5-8.5L2 12l7.5-2.5z"
          fill="#f2c070"
        />
        <path
          d="M12 6l1.2 3.8L17 12l-3.8 1.2L12 18l-1.2-4.8L7 12l3.8-1.2z"
          fill="#fff"
          opacity="0.45"
        />
      </svg>
      <p className="text-sm leading-snug text-foreground">
        <span className="font-semibold">Rare find!</span> This place is usually
        booked.
      </p>
    </div>
  );
}
