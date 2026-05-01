"use client";

import { MessageCircle } from "lucide-react";
import { openConduitWidget } from "@/components/conduit-widget";

export function InlineChatCta({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle: string;
}) {
  return (
    <div className="lg:hidden">
      <button
        onClick={() =>
          openConduitWidget({
            trigger: "inline_cta",
            pageType: "property_detail",
            listingId,
            listingTitle,
          })
        }
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4 text-left transition-colors hover:bg-muted"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Still have questions?
          </p>
          <p className="text-xs text-muted-foreground">
            Ask about parking, pets, check-in & more
          </p>
        </div>
      </button>
    </div>
  );
}
