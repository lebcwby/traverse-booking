"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Send, Loader2 } from "lucide-react";
import { identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";
import {
  readConfirmationSession,
  type ConfirmationSession,
} from "./lib/confirmation-session";

interface Props {
  reservationId: string;
  isOwner: boolean;
}

export function SubscribePrompt({ reservationId, isOwner }: Props) {
  const [session, setSession] = useState<ConfirmationSession | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    setSession(readConfirmationSession(reservationId));
  }, [reservationId]);

  const email = session?.guestEmail ?? "";
  const name = session?.guestFirstName ?? "";

  if (isOwner) return null;
  if (session?.marketingOptIn) return null;
  if (!email) return null;

  async function handleSubscribe() {
    setStatus("loading");
    try {
      identifyUser(email);
      const attribution = getEmailCaptureAttribution(
        "confirmation",
        "direct_savings"
      );
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, attribution }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        <span>
          You&apos;re in! We&apos;ll send Portland tips and deals to your inbox.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">
        {name ? `${name}, want` : "Want"} Portland travel tips &amp; deals?
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Local recommendations, seasonal guides, and deals for your next trip.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubscribe}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Yes, subscribe me
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-500">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
