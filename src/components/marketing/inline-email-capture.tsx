"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { identifyUser } from "@/lib/tracking";
import { getEmailCaptureAttribution } from "@/lib/attribution";

interface InlineEmailCaptureProps {
  headline: string;
  subtext?: string;
  buttonText?: string;
  variant?: "light" | "dark";
  className?: string;
  offerType?: string;
  listingId?: string;
}

export function InlineEmailCapture({
  headline,
  subtext,
  buttonText = "Subscribe",
  variant = "light",
  className = "",
  offerType = "direct_savings",
  listingId,
}: InlineEmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const attribution = getEmailCaptureAttribution(
        "inline",
        offerType,
        listingId
      );
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          attribution,
        }),
      });
      if (!res.ok) throw new Error();
      identifyUser(email.trim().toLowerCase());
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  const isDark = variant === "dark";

  if (status === "success") {
    return (
      <div
        className={`flex items-center justify-center gap-2 py-3 text-sm ${isDark ? "text-white/80" : "text-muted-foreground"} ${className}`}
      >
        <CheckCircle2 className="h-4 w-4" />
        <span>You&apos;re in! Look for Portland tips in your inbox.</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <p
        className={`text-sm font-medium ${isDark ? "text-white" : "text-foreground"}`}
      >
        {headline}
      </p>
      {subtext && (
        <p
          className={`mt-1 text-xs ${isDark ? "text-white/60" : "text-muted-foreground"}`}
        >
          {subtext}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-2.5 flex gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          className={`h-10 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-1 ${
            isDark
              ? "border-white/30 bg-white text-foreground placeholder:text-muted-foreground focus:border-white focus:ring-white/50"
              : "border-border bg-white text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          }`}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
            isDark
              ? "bg-white text-foreground hover:bg-white/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              {buttonText}
            </>
          )}
        </button>
      </form>
      {status === "error" && (
        <p
          className={`mt-1.5 text-xs ${isDark ? "text-red-300" : "text-red-500"}`}
        >
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}
