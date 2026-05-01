import { WHERE_TO_STAY_FAQ } from "@/lib/where-to-stay-data";

export function WhereToStayFaq() {
  return (
    <div className="space-y-3">
      {WHERE_TO_STAY_FAQ.map((faq, i) => (
        <details key={i} className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
            {faq.question}
            <svg
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </summary>
          <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
